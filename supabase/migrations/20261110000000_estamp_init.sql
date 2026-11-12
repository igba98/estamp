-- eStamp: organisations, stamps, issued-stamp records (server verification),
-- mail register and team approvals. Every table has row-level security; the
-- trusted steps (reference numbers, issuing, approving, revoking) run in
-- security-definer functions so the browser can't fake them.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.member_role as enum ('owner', 'admin', 'member');

/* ---------------------------------------------------------------- tables */

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Your Company Ltd' check (char_length(name) between 1 and 120),
  sub_text text not null default '' check (char_length(sub_text) <= 120),
  ref_prefix text not null default 'ES' check (char_length(ref_prefix) <= 12),
  ref_counter int not null default 0,
  register_year int not null default extract(year from now())::int,
  register_counter int not null default 0,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- shortcut: one organisation per user (unique user_id); drop the unique to allow several.
create table public.members (
  org_id uuid not null references public.orgs on delete cascade,
  user_id uuid not null unique references auth.users on delete cascade,
  role public.member_role not null default 'member',
  display_name text not null default '' check (char_length(display_name) <= 80),
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);


/* Runs as the table owner so RLS policies can call it without recursing into members. */
create function public.my_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.members where user_id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role in ('owner', 'admin'))
$$;

create table public.invites (
  org_id uuid not null default public.my_org() references public.orgs on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null default 'member' check (role <> 'owner'),
  invited_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);

create function private.short_id() returns text
language sql volatile set search_path = '' as $$
  -- 72 random bits, URL-safe: the public verify id printed in each QR.
  select translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')
$$;

create table public.stamps (
  id text primary key check (char_length(id) between 6 and 40),
  org_id uuid not null default public.my_org() references public.orgs on delete cascade,
  design jsonb not null check (jsonb_typeof(design) = 'object' and pg_column_size(design) < 16384),
  uses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stamps_org_idx on public.stamps (org_id);

create table public.documents (
  id text primary key default private.short_id(),
  org_id uuid not null references public.orgs on delete cascade,
  created_by uuid references auth.users on delete set null,
  ref text not null,
  org_name text not null,
  labels text not null,
  stamped_by text not null default '',
  stamp_ids text[] not null,
  stamp_names text[] not null,
  ink text not null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  kind text not null check (kind in ('pdf', 'docx', 'image')),
  pages int not null check (pages between 1 and 5000),
  size_bytes bigint not null check (size_bytes >= 0),
  original_hash text not null check (original_hash ~ '^[0-9a-f]{64}$'),
  stamped_at timestamptz not null default now(),
  output_name text check (char_length(output_name) <= 255),
  output_kind text check (output_kind in ('pdf', 'docx', 'png')),
  output_bytes bigint,
  output_hash text check (output_hash ~ '^[0-9a-f]{64}$'),
  output_path text,
  thumb text check (char_length(thumb) < 200000),
  revoked_at timestamptz,
  revoke_reason text not null default '' check (char_length(revoke_reason) <= 300)
);
create index documents_org_idx on public.documents (org_id, stamped_at desc);
create unique index documents_ref_idx on public.documents (org_id, ref);

create table public.register_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  year int not null,
  number int not null,
  reg_no text not null,
  received_at timestamptz not null default now(),
  sender text not null default '' check (char_length(sender) <= 200),
  subject text not null default '' check (char_length(subject) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  document_id text references public.documents on delete set null,
  received_by uuid references auth.users on delete set null,
  received_by_name text not null default '',
  unique (org_id, year, number)
);
create index register_doc_idx on public.register_entries (document_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  stamp_id text not null references public.stamps on delete cascade,
  requested_by uuid not null references auth.users on delete cascade,
  requester_name text not null default '',
  file_name text not null check (char_length(file_name) between 1 and 255),
  original_hash text not null check (original_hash ~ '^[0-9a-f]{64}$'),
  file_path text,
  size_bytes bigint not null default 0,
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'used')),
  decided_by uuid references auth.users on delete set null,
  decider_name text not null default '',
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 1000),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index approvals_org_idx on public.approvals (org_id, created_at desc);
create index approvals_lookup_idx on public.approvals (requested_by, original_hash) where status = 'approved';

/* --------------------------------------------------------------- triggers */

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger stamps_touch before update on public.stamps
  for each row execute function private.touch_updated_at();

/* Requests are always filed as the caller, in the caller's org, as pending. */
create function private.approvals_stamp_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.org_id := public.my_org();
  new.requested_by := auth.uid();
  new.requester_name := coalesce((select nullif(display_name, '') from public.members where user_id = auth.uid()),
                                 (select email from public.members where user_id = auth.uid()), '');
  new.status := 'pending';
  new.decided_by := null;
  new.decided_at := null;
  new.used_at := null;
  if not exists (select 1 from public.stamps where id = new.stamp_id and org_id = new.org_id) then
    raise exception 'unknown_stamp' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger approvals_before_insert before insert on public.approvals
  for each row execute function private.approvals_stamp_insert();

/* ------------------------------------------------------- row-level security */

alter table public.orgs enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.stamps enable row level security;
alter table public.documents enable row level security;
alter table public.register_entries enable row level security;
alter table public.approvals enable row level security;

create policy "orgs: members read" on public.orgs for select to authenticated
  using (id = (select public.my_org()));
create policy "orgs: admins edit" on public.orgs for update to authenticated
  using (id = (select public.my_org()) and (select public.is_admin()));

create policy "members: org reads" on public.members for select to authenticated
  using (org_id = (select public.my_org()));
create policy "members: edit own name" on public.members for update to authenticated
  using (user_id = (select auth.uid()));

create policy "invites: admins" on public.invites for all to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()))
  with check (org_id = (select public.my_org()) and (select public.is_admin()));

create policy "stamps: org reads" on public.stamps for select to authenticated
  using (org_id = (select public.my_org()));
create policy "stamps: admins insert" on public.stamps for insert to authenticated
  with check (org_id = (select public.my_org()) and (select public.is_admin()));
create policy "stamps: admins update" on public.stamps for update to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));
create policy "stamps: admins delete" on public.stamps for delete to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));

-- Documents are only created through issue_stamp(); admins may delete records.
create policy "documents: org reads" on public.documents for select to authenticated
  using (org_id = (select public.my_org()));
create policy "documents: admins delete" on public.documents for delete to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));

-- Register numbers come from issue_stamp() / add_register_entry(); anyone in the org fills in details.
create policy "register: org reads" on public.register_entries for select to authenticated
  using (org_id = (select public.my_org()));
create policy "register: org edits" on public.register_entries for update to authenticated
  using (org_id = (select public.my_org()));
create policy "register: admins delete" on public.register_entries for delete to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));

create policy "approvals: admins and requester read" on public.approvals for select to authenticated
  using (org_id = (select public.my_org()) and ((select public.is_admin()) or requested_by = (select auth.uid())));
create policy "approvals: members request" on public.approvals for insert to authenticated
  with check (org_id = (select public.my_org()) and requested_by = (select auth.uid()));
create policy "approvals: cancel own pending, admins delete" on public.approvals for delete to authenticated
  using (org_id = (select public.my_org())
         and ((select public.is_admin()) or (requested_by = (select auth.uid()) and status = 'pending')));

/* Column privileges: counters, roles, status and ownership never come from the client.
   Grants are explicit because newer projects don't expose new tables to the API by default. */
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke insert, update on public.orgs, public.members, public.documents, public.register_entries, public.approvals from authenticated;
grant update (name, sub_text, ref_prefix, onboarded) on public.orgs to authenticated;
grant update (display_name) on public.members to authenticated;
grant update (sender, subject, notes) on public.register_entries to authenticated;
grant insert (id, stamp_id, file_name, original_hash, file_path, size_bytes, note) on public.approvals to authenticated;

/* ------------------------------------------------------------------- RPCs */

/* First call after sign-in: join the org that invited this email, or start a new one. */
create function public.bootstrap() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  -- Email sign-in only (magic link / code), so the address is verified.
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv public.invites;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- Two tabs signing in at once must not both create an organisation.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select org_id into v_org from public.members where user_id = auth.uid();
  if found then
    return v_org;
  end if;
  select * into v_inv from public.invites where email = v_email and v_email <> '' order by created_at limit 1;
  if found then
    insert into public.members (org_id, user_id, role, email) values (v_inv.org_id, auth.uid(), v_inv.role, v_email);
    delete from public.invites where email = v_email;
    return v_inv.org_id;
  end if;
  insert into public.orgs default values returning id into v_org;
  insert into public.members (org_id, user_id, role, email) values (v_org, auth.uid(), 'owner', v_email);
  return v_org;
end $$;

create function private.take_register_no(p_org uuid, out year int, out number int, out reg_no text)
language plpgsql set search_path = '' as $$
declare
  y int := extract(year from now())::int;
begin
  update public.orgs
     set register_counter = case when register_year = y then register_counter + 1 else 1 end,
         register_year = y
   where id = p_org
  returning register_year, register_counter into year, number;
  reg_no := 'IN/' || year || '/' || lpad(number::text, 4, '0');
end $$;

/*
 * Reserve the record a stamp's QR points to, before the file is made.
 * Checks approvals, takes the next reference (and register number), counts stamp use.
 */
create function public.issue_stamp(
  p_stamp_ids text[],
  p_file_name text,
  p_kind text,
  p_pages int,
  p_size_bytes bigint,
  p_original_hash text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.members;
  v_org public.orgs;
  v_ids text[] := array(select distinct unnest(p_stamp_ids));
  v_found int;
  v_register boolean;
  v_doc public.documents;
  v_reg record;
  v_reg_no text;
begin
  select * into v_me from public.members where user_id = auth.uid();
  if not found then
    raise exception 'not_member' using errcode = '42501';
  end if;

  select count(*), bool_or(coalesce((design ->> 'register')::boolean, false))
    into v_found, v_register
    from public.stamps where org_id = v_me.org_id and id = any(v_ids);
  if cardinality(v_ids) = 0 or v_found <> cardinality(v_ids) then
    raise exception 'unknown_stamp' using errcode = '23503';
  end if;

  -- Members need an approved request for this exact file for every stamp that requires one.
  if v_me.role = 'member' and exists (
    select 1 from public.stamps s
     where s.org_id = v_me.org_id and s.id = any(v_ids)
       and coalesce((s.design ->> 'requiresApproval')::boolean, false)
       and not exists (
         select 1 from public.approvals a
          where a.stamp_id = s.id and a.requested_by = auth.uid()
            and a.status = 'approved' and a.original_hash = p_original_hash)
  ) then
    raise exception 'approval_required' using errcode = '42501',
      hint = 'Ask a manager to approve this stamp for this file first.';
  end if;

  update public.orgs set ref_counter = ref_counter + 1 where id = v_me.org_id returning * into v_org;

  insert into public.documents (
    org_id, created_by, ref, org_name, labels, stamped_by, stamp_ids, stamp_names, ink,
    file_name, kind, pages, size_bytes, original_hash
  )
  select v_me.org_id, auth.uid(),
         coalesce(nullif(btrim(v_org.ref_prefix), ''), 'ES') || '-' || extract(year from now())::int || '-' || lpad(v_org.ref_counter::text, 4, '0'),
         coalesce(nullif((array_agg(s.design ->> 'orgName' order by o.n))[1], ''), v_org.name),
         string_agg(s.design ->> 'label', ' + ' order by o.n),
         v_me.display_name,
         array_agg(s.id order by o.n),
         array_agg(coalesce(s.design ->> 'name', s.id) order by o.n),
         coalesce((array_agg(s.design ->> 'ink' order by o.n))[1], 'blue'),
         p_file_name, p_kind, p_pages, p_size_bytes, p_original_hash
    from unnest(p_stamp_ids) with ordinality as o(id, n)
    join public.stamps s on s.id = o.id and s.org_id = v_me.org_id
  returning * into v_doc;

  update public.stamps set uses = uses + 1 where org_id = v_me.org_id and id = any(v_ids);

  if v_register then
    select * into v_reg from private.take_register_no(v_me.org_id);
    insert into public.register_entries (org_id, year, number, reg_no, subject, document_id, received_by, received_by_name)
    values (v_me.org_id, v_reg.year, v_reg.number, v_reg.reg_no, p_file_name, v_doc.id, auth.uid(),
            coalesce(nullif(v_me.display_name, ''), v_me.email));
    v_reg_no := v_reg.reg_no;
  end if;

  return jsonb_build_object(
    'id', v_doc.id, 'ref', v_doc.ref, 'stamped_at', v_doc.stamped_at, 'org_name', v_doc.org_name,
    'labels', v_doc.labels, 'stamped_by', v_doc.stamped_by, 'register_no', v_reg_no
  );
end $$;

/* Record the finished file's fingerprint once; after that the record is fixed. */
create function public.complete_stamp(
  p_id text,
  p_output_name text,
  p_output_kind text,
  p_output_bytes bigint,
  p_output_hash text,
  p_output_path text,
  p_thumb text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  update public.documents
     set output_name = p_output_name, output_kind = p_output_kind, output_bytes = p_output_bytes,
         output_hash = p_output_hash, output_path = p_output_path, thumb = p_thumb
   where id = p_id and created_by = auth.uid() and output_hash is null
     and (p_output_path is null or p_output_path like org_id::text || '/' || id || '/%')
  returning * into v_doc;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.approvals
     set status = 'used', used_at = now()
   where requested_by = auth.uid() and status = 'approved'
     and original_hash = v_doc.original_hash and stamp_id = any(v_doc.stamp_ids);
end $$;

/* Undo issue_stamp() when making the file failed. Only unfinished records of your own. */
create function public.discard_stamp(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.register_entries
   where document_id = p_id
     and exists (select 1 from public.documents where id = p_id and created_by = auth.uid() and output_hash is null);
  delete from public.documents where id = p_id and created_by = auth.uid() and output_hash is null;
end $$;

create function public.revoke_stamp(p_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  update public.documents
     set revoked_at = coalesce(revoked_at, now()), revoke_reason = left(coalesce(p_reason, ''), 300)
   where id = p_id and org_id = public.my_org();
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

/* Public lookup behind the QR code. Callable without signing in. */
create function public.verify_stamp(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id, 'ref', d.ref, 'org_name', d.org_name, 'labels', d.labels, 'stamped_by', d.stamped_by,
    'stamped_at', d.stamped_at, 'file_name', d.file_name, 'pages', d.pages,
    'original_hash', d.original_hash, 'output_hash', d.output_hash,
    'revoked_at', d.revoked_at, 'revoke_reason', d.revoke_reason
  )
  from public.documents d
  where d.id = p_id and char_length(p_id) <= 40
$$;

create function public.add_register_entry(p_sender text, p_subject text, p_notes text) returns public.register_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.members;
  v_reg record;
  v_row public.register_entries;
begin
  select * into v_me from public.members where user_id = auth.uid();
  if not found then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into v_reg from private.take_register_no(v_me.org_id);
  insert into public.register_entries (org_id, year, number, reg_no, sender, subject, notes, received_by, received_by_name)
  values (v_me.org_id, v_reg.year, v_reg.number, v_reg.reg_no, coalesce(p_sender, ''), coalesce(p_subject, ''),
          coalesce(p_notes, ''), auth.uid(), coalesce(nullif(v_me.display_name, ''), v_me.email))
  returning * into v_row;
  return v_row;
end $$;

create function public.decide_approval(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.members;
begin
  select * into v_me from public.members where user_id = auth.uid() and role in ('owner', 'admin');
  if not found then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  update public.approvals
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(),
         decider_name = coalesce(nullif(v_me.display_name, ''), v_me.email),
         decision_note = left(coalesce(p_note, ''), 1000)
   where id = p_id and org_id = v_me.org_id and status = 'pending';
  if not found then
    raise exception 'not_pending' using errcode = 'P0002';
  end if;
end $$;

create function public.set_member_role(p_user uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'cannot_make_owner' using errcode = '42501';
  end if;
  update public.members set role = p_role
   where user_id = p_user and org_id = public.my_org() and role <> 'owner';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

create function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  delete from public.members
   where user_id = p_user and org_id = public.my_org() and role <> 'owner';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

/* Functions are executable by PUBLIC by default; open only what each role needs. */
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.short_id() to authenticated;
grant execute on function public.verify_stamp(text) to anon, authenticated;
grant execute on function
  public.my_org(), public.is_admin(), public.bootstrap(),
  public.issue_stamp(text[], text, text, int, bigint, text),
  public.complete_stamp(text, text, text, bigint, text, text, text),
  public.discard_stamp(text), public.revoke_stamp(text, text),
  public.add_register_entry(text, text, text), public.decide_approval(uuid, boolean, text),
  public.set_member_role(uuid, public.member_role), public.remove_member(uuid)
to authenticated;

/* ---------------------------------------------------------------- storage */

-- Stamped outputs: {org_id}/{document_id}/{file}. Approval files: {org_id}/{approval_id}/{file}.
insert into storage.buckets (id, name, public, file_size_limit)
values ('stamped', 'stamped', false, 52428800), ('approvals', 'approvals', false, 52428800)
on conflict (id) do nothing;

create policy "stamped: org reads" on storage.objects for select to authenticated
  using (bucket_id = 'stamped' and (storage.foldername(name))[1] = (select public.my_org())::text);
create policy "stamped: org uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'stamped' and (storage.foldername(name))[1] = (select public.my_org())::text);
create policy "stamped: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'stamped' and (storage.foldername(name))[1] = (select public.my_org())::text
         and (select public.is_admin()));

create policy "approvals: admins and uploader read" on storage.objects for select to authenticated
  using (bucket_id = 'approvals' and (storage.foldername(name))[1] = (select public.my_org())::text
         and ((select public.is_admin()) or owner_id = (select auth.uid())::text));
create policy "approvals: org uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'approvals' and (storage.foldername(name))[1] = (select public.my_org())::text);
create policy "approvals: admins and uploader delete" on storage.objects for delete to authenticated
  using (bucket_id = 'approvals' and (storage.foldername(name))[1] = (select public.my_org())::text
         and ((select public.is_admin()) or owner_id = (select auth.uid())::text));
