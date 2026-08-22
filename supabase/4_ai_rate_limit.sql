-- Serverless-safe fixed-window limiter for authenticated AI requests.
-- Apply after the existing schema files. The function derives the caller from
-- auth.uid(), so clients cannot consume or reset another user's quota.

create table if not exists public.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, route)
);

alter table public.ai_rate_limits enable row level security;

revoke all on public.ai_rate_limits from anon, authenticated;

create or replace function public.consume_ai_rate_limit(
  p_route text,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_row public.ai_rate_limits%rowtype;
  v_allowed boolean;
  v_remaining integer;
  v_reset_at bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_route is null or length(trim(p_route)) = 0 then
    raise exception 'route required';
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  insert into public.ai_rate_limits (user_id, route, window_started_at, request_count)
  values (v_user_id, p_route, v_now, 0)
  on conflict (user_id, route) do nothing;

  select * into v_row
  from public.ai_rate_limits
  where user_id = v_user_id and route = p_route
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    v_row.window_started_at := v_now;
    v_row.request_count := 0;
  end if;

  v_allowed := v_row.request_count < p_limit;
  if v_allowed then
    v_row.request_count := v_row.request_count + 1;
  end if;

  update public.ai_rate_limits
  set window_started_at = v_row.window_started_at,
      request_count = v_row.request_count
  where user_id = v_user_id and route = p_route;

  v_remaining := greatest(p_limit - v_row.request_count, 0);
  v_reset_at := extract(epoch from (v_row.window_started_at + make_interval(secs => p_window_seconds)))::bigint;

  return jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at
  );
end;
$$;

grant execute on function public.consume_ai_rate_limit(text, integer, integer) to authenticated;
