-- Assert-based checks of the access rules. Run with supabase/tests/run-tests.sh.
\set ON_ERROR_STOP on

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'owner@a.co'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@a.co'),
  ('00000000-0000-0000-0000-00000000000c', 'owner@c.co');

create function pg_temp.act(u text, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'email', email)::text, false);
  execute 'set role authenticated';
end $$;

create function pg_temp.fails(sql text, expect text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute sql;
    ok := true;
  exception when others then
    if sqlerrm not like '%' || expect || '%' then
      raise exception 'expected "%" got "%" for: %', expect, sqlerrm, sql;
    end if;
  end;
  if ok then raise exception 'expected failure "%" but succeeded: %', expect, sql; end if;
end $$;

-- Owner A signs up, sets up the org and an approval-gated + register stamp.
select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@a.co');
select public.bootstrap() is not null as boot_a \gset
update public.orgs set name = 'Acme Ltd', ref_prefix = 'AC';
update public.members set display_name = 'Asha';
insert into public.stamps (id, design) values
  ('st_received', '{"name":"Received","label":"RECEIVED","orgName":"Acme Ltd","ink":"blue","register":true}'),
  ('st_approved', '{"name":"Approved","label":"APPROVED","orgName":"Acme Ltd","ink":"green","requiresApproval":true}');
insert into public.invites (email) values ('staff@a.co');
select pg_temp.fails($$update public.orgs set ref_counter = 99$$, 'permission denied');

-- Issue: reference numbers, register entry, use counts.
select public.issue_stamp(array['st_received'], 'letter.pdf', 'pdf', 2, 1000, repeat('a', 64)) as r1 \gset
do $$ begin
  assert (select ref from public.documents where file_name = 'letter.pdf') = 'AC-' || extract(year from now())::int || '-0001', 'ref';
  assert (select count(*) from public.register_entries where subject = 'letter.pdf') = 1, 'register entry';
  assert (select uses from public.stamps where id = 'st_received') = 1, 'uses';
end $$;
select (:'r1'::jsonb ->> 'id') as doc1 \gset
select public.complete_stamp(:'doc1', 'letter-stamped.pdf', 'pdf', 1200, repeat('b', 64), null, null);
-- The fingerprint can only be recorded once.
select pg_temp.fails(format($$select public.complete_stamp(%L, 'x.pdf', 'pdf', 1, %L, null, null)$$, :'doc1', repeat('c', 64)), 'not_found');
select pg_temp.fails($$insert into public.documents (org_id, ref, org_name, labels, stamp_ids, stamp_names, ink, file_name, kind, pages, size_bytes, original_hash) values (public.my_org(), 'x', 'x', 'x', '{}', '{}', 'blue', 'x', 'pdf', 1, 1, repeat('a',64))$$, 'permission denied');

-- Discard removes an unfinished record and its register entry.
select (public.issue_stamp(array['st_received'], 'oops.pdf', 'pdf', 1, 10, repeat('d', 64)) ->> 'id') as doc2 \gset
select public.discard_stamp(:'doc2');
do $$ begin
  assert not exists (select 1 from public.documents where file_name = 'oops.pdf'), 'discarded doc';
  assert not exists (select 1 from public.register_entries where subject = 'oops.pdf'), 'discarded register';
end $$;
reset role;

-- Staff B accepts the invite and becomes a member of A's org.
select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'staff@a.co');
select public.bootstrap();
do $$ begin
  assert (select role from public.members where user_id = auth.uid()) = 'member', 'invited as member';
  assert (select count(*) from public.stamps) = 2, 'member sees org stamps';
end $$;
do $$ begin
  update public.stamps set design = '{}' where id = 'st_approved';
  assert not found, 'member cannot edit stamps';
end $$;
select pg_temp.fails($$update public.members set role = 'admin'$$, 'permission denied');
select pg_temp.fails($$update public.register_entries set received_at = now() - interval '1 year'$$, 'permission denied');
select pg_temp.fails($$select public.revoke_stamp('x', 'no')$$, 'admins_only');

-- Approval-gated stamp: blocked until approved, for this exact file only.
select pg_temp.fails(format($$select public.issue_stamp(array['st_approved'], 'inv.pdf', 'pdf', 1, 10, %L)$$, repeat('e', 64)), 'approval_required');
insert into public.approvals (id, stamp_id, file_name, original_hash, file_path)
values ('00000000-0000-0000-0000-0000000000f1', 'st_approved', 'inv.pdf', repeat('e', 64), 'x');
do $$ begin
  assert (select status from public.approvals) = 'pending', 'pending';
  assert (select requester_name from public.approvals) = 'staff@a.co', 'requester name';
end $$;
select pg_temp.fails($$select public.decide_approval('00000000-0000-0000-0000-0000000000f1', true, '')$$, 'admins_only');
-- Storage: member uploads into own org folder only.
select public.my_org() as org_a \gset
insert into storage.objects (bucket_id, name) values ('approvals', :'org_a' || '/f1/inv.pdf');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('stamped', 'someone-else/x/y.pdf')$$, 'row-level security');
reset role;

select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@a.co');
select public.decide_approval('00000000-0000-0000-0000-0000000000f1', true, 'ok');
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'approvals') = 1, 'admin reads approval file';
end $$;
reset role;

select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'staff@a.co');
select pg_temp.fails(format($$select public.issue_stamp(array['st_approved'], 'other.pdf', 'pdf', 1, 10, %L)$$, repeat('9', 64)), 'approval_required');
select (public.issue_stamp(array['st_approved'], 'inv.pdf', 'pdf', 1, 10, repeat('e', 64)) ->> 'id') as doc3 \gset
select public.complete_stamp(:'doc3', 'inv-stamped.pdf', 'pdf', 20, repeat('f', 64), null, null);
do $$ begin
  assert (select status from public.approvals) = 'used', 'approval used once';
  assert (select stamped_by from public.documents where file_name = 'inv.pdf') = '', 'stamped_by from profile';
end $$;
select (public.add_register_entry('TRA', 'Tax notice', '') ).reg_no as reg \gset
do $$ begin
  assert (select count(*) from public.register_entries) = 2, 'manual register entry';
end $$;
reset role;

-- Owner C, another org, sees nothing of A.
select pg_temp.act('00000000-0000-0000-0000-00000000000c', 'owner@c.co');
select public.bootstrap();
do $$ begin
  assert (select count(*) from public.stamps) = 0, 'no cross-org stamps';
  assert (select count(*) from public.documents) = 0, 'no cross-org docs';
  assert (select count(*) from public.register_entries) = 0, 'no cross-org register';
  assert (select count(*) from public.approvals) = 0, 'no cross-org approvals';
  assert (select count(*) from storage.objects) = 0, 'no cross-org files';
end $$;
select pg_temp.fails($$select public.issue_stamp(array['st_received'], 'x.pdf', 'pdf', 1, 1, repeat('a', 64))$$, 'unknown_stamp');
reset role;

-- Anyone (anon) can verify by id, and nothing else.
set role anon;
select public.verify_stamp(:'doc1') ->> 'output_hash' = repeat('b', 64) as verified \gset
\if :verified
\else
  \echo 'verify_stamp failed' \q
\endif
select pg_temp.fails($$select * from public.documents$$, 'permission denied');
select pg_temp.fails($$select public.bootstrap()$$, 'permission denied');
reset role;

-- Dashboard stats count only your own organisation.
select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@a.co');
do $$ declare st jsonb := public.org_stats(now() - interval '7 days', now() - interval '30 days'); begin
  assert (st ->> 'total')::int = 2, 'org total ' || st;
  assert jsonb_array_length(st -> 'team') = 2, 'two people stamped';
end $$;
reset role;
select pg_temp.act('00000000-0000-0000-0000-00000000000c', 'owner@c.co');
do $$ begin
  assert (public.org_stats(now(), now()) ->> 'total')::int = 0, 'other org sees 0';
end $$;
reset role;

-- API keys: admins only; the key lookup is server-only.
select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@a.co');
insert into public.api_keys (name, prefix, key_hash) values ('ERP', 'es_live_abcd1234', repeat('1', 64));
select pg_temp.fails($$update public.api_keys set key_hash = repeat('2', 64)$$, 'permission denied');
select pg_temp.fails($$select public.api_org(repeat('1', 64))$$, 'permission denied');
reset role;
select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'staff@a.co');
do $$ begin
  assert (select count(*) from public.api_keys) = 0, 'members cannot see API keys';
end $$;
select pg_temp.fails($$insert into public.api_keys (name, prefix, key_hash) values ('x', 'es_live_zzzz0000', repeat('3', 64))$$, 'row-level security');
reset role;
set role service_role;
select public.api_org(repeat('1', 64)) = (select org_id from public.members where user_id = '00000000-0000-0000-0000-00000000000a') as key_ok \gset
\if :key_ok
\else
  \echo 'api_org failed' \q
\endif
select (public.api_add_register_entry(public.api_org(repeat('1', 64)), 'KRA', 'From API', '')).reg_no like 'IN/%' as reg_ok \gset
\if :reg_ok
\else
  \echo 'api register failed' \q
\endif
reset role;

-- Billing: plan can't be set by the client; payments are server-only and paid once.
select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@a.co');
select pg_temp.fails($$update public.orgs set plan = 'business'$$, 'permission denied');
select pg_temp.fails($$insert into public.payments (org_id, plan, amount_tzs, phone, provider) values (public.my_org(), 'business', 1, '255700000000', 'x')$$, 'permission denied');
select pg_temp.fails($$select public.mark_payment_paid(gen_random_uuid(), 'x', 1)$$, 'permission denied');
select public.my_org() as org_a2 \gset
reset role;
set role service_role;
insert into public.payments (id, org_id, plan, amount_tzs, phone, provider)
values ('00000000-0000-0000-0000-0000000000a1'::text::uuid, :'org_a2', 'business', 25000, '255712345678', 'test');
do $$ begin
  assert not public.mark_payment_paid('00000000-0000-0000-0000-0000000000a1', 'r1', 100), 'wrong amount refused';
  assert public.mark_payment_paid('00000000-0000-0000-0000-0000000000a1', 'r1', 25000), 'paid';
  assert not public.mark_payment_paid('00000000-0000-0000-0000-0000000000a1', 'r1', 25000), 'second webhook ignored';
  assert (select o.plan from public.orgs o join public.payments p on p.org_id = o.id) = 'business', 'plan set';
  assert (select plan_until > now() + interval '27 days' and plan_until < now() + interval '32 days' from public.orgs o join public.payments p on p.org_id = o.id), 'one month';
end $$;
reset role;
select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'staff@a.co');
do $$ begin
  assert (select count(*) from public.payments) = 0, 'members cannot see payments';
end $$;
reset role;

\echo 'ALL RLS TESTS PASSED'
