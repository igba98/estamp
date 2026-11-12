-- API keys for /api/v1. The key itself is shown once in the browser; only its
-- SHA-256 hash is stored. The server resolves a key to its organisation with
-- api_org(), which only the secret (service_role) key may call.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.my_org() references public.orgs on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null check (char_length(prefix) between 8 and 24),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_org_idx on public.api_keys (org_id);

alter table public.api_keys enable row level security;
create policy "api_keys: admins read" on public.api_keys for select to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));
create policy "api_keys: admins create" on public.api_keys for insert to authenticated
  with check (org_id = (select public.my_org()) and (select public.is_admin()));
create policy "api_keys: admins revoke" on public.api_keys for update to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));

revoke all on public.api_keys from anon, authenticated;
grant select on public.api_keys to authenticated;
grant insert (name, prefix, key_hash) on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

/* Server-only: which organisation does this key belong to? Also records its last use. */
create function public.api_org(p_key_hash text) returns uuid
language sql volatile security definer set search_path = '' as $$
  update public.api_keys set last_used_at = now()
   where key_hash = p_key_hash and revoked_at is null
  returning org_id
$$;

create function public.api_add_register_entry(p_org uuid, p_sender text, p_subject text, p_notes text)
returns public.register_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_reg record;
  v_row public.register_entries;
begin
  select * into v_reg from private.take_register_no(p_org);
  if v_reg.number is null then
    raise exception 'unknown_org' using errcode = 'P0002';
  end if;
  insert into public.register_entries (org_id, year, number, reg_no, sender, subject, notes, received_by_name)
  values (p_org, v_reg.year, v_reg.number, v_reg.reg_no, left(coalesce(p_sender, ''), 200),
          left(coalesce(p_subject, ''), 300), left(coalesce(p_notes, ''), 2000), 'API')
  returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.api_org(text), public.api_add_register_entry(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.api_org(text), public.api_add_register_entry(uuid, text, text, text) to service_role;
grant usage on schema private to service_role;
grant execute on function private.take_register_no(uuid) to service_role;
