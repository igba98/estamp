-- Billing: each organisation's plan, and mobile-money payments written only by
-- the server (/api/billing). A payment provider's webhook calls
-- mark_payment_paid(), which extends the plan exactly once per payment.

alter table public.orgs
  add column plan text not null default 'free' check (plan ~ '^[a-z0-9_]{1,30}$'),
  add column plan_until timestamptz;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  created_by uuid references auth.users on delete set null,
  plan text not null check (plan ~ '^[a-z0-9_]{1,30}$'),
  months int not null default 1 check (months between 1 and 12),
  amount_tzs int not null check (amount_tzs > 0),
  phone text not null check (phone ~ '^255[0-9]{9}$'),
  provider text not null,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_org_idx on public.payments (org_id, created_at desc);
create unique index payments_provider_ref_idx on public.payments (provider, provider_ref) where provider_ref is not null;

alter table public.payments enable row level security;
create policy "payments: admins read" on public.payments for select to authenticated
  using (org_id = (select public.my_org()) and (select public.is_admin()));
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

/* Idempotent: a repeated or late webhook for the same payment changes nothing. */
create function public.mark_payment_paid(p_id uuid, p_provider_ref text, p_amount_tzs int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v public.payments;
begin
  update public.payments
     set status = 'paid', paid_at = now(), provider_ref = coalesce(p_provider_ref, provider_ref)
   where id = p_id and status = 'pending' and amount_tzs = p_amount_tzs
  returning * into v;
  if not found then
    return false;
  end if;
  update public.orgs
     set plan = v.plan,
         plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(months => v.months)
   where id = v.org_id;
  return true;
end $$;

create function public.mark_payment_failed(p_id uuid) returns boolean
language sql security definer set search_path = '' as $$
  with u as (update public.payments set status = 'failed' where id = p_id and status = 'pending' returning 1)
  select exists (select 1 from u)
$$;

revoke execute on function public.mark_payment_paid(uuid, text, int), public.mark_payment_failed(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_payment_paid(uuid, text, int), public.mark_payment_failed(uuid) to service_role;
