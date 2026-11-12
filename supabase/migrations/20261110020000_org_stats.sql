-- Dashboard figures counted in the database (the app only loads recent documents).
-- Week and month start come from the browser so they follow the user's time zone.
create function public.org_stats(p_week_start timestamptz, p_month_start timestamptz) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total', count(*),
    'week', count(*) filter (where d.stamped_at >= p_week_start),
    'pages', coalesce(sum(d.pages), 0),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', t.created_by, 'count', t.n) order by t.n desc)
        from (select created_by, count(*) as n from public.documents
               where org_id = public.my_org() and stamped_at >= p_month_start
               group by created_by) t
    ), '[]'::jsonb)
  )
  from public.documents d
  where d.org_id = public.my_org()
$$;

revoke execute on function public.org_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.org_stats(timestamptz, timestamptz) to authenticated;
