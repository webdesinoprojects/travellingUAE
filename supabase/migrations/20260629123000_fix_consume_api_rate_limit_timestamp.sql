create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_route_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  current_hits integer;
  current_window timestamptz;
begin
  if length(p_bucket_key) < 8 or length(p_bucket_key) > 128 then
    raise exception 'invalid rate-limit bucket';
  end if;

  if length(p_route_key) < 1 or length(p_route_key) > 80 then
    raise exception 'invalid rate-limit route';
  end if;

  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit configuration';
  end if;

  insert into public.api_rate_limit_windows (
    bucket_key,
    route_key,
    window_started_at,
    hits
  )
  values (p_bucket_key, p_route_key, v_now, 1)
  on conflict (bucket_key, route_key) do update
  set hits = case
        when api_rate_limit_windows.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then 1
        else api_rate_limit_windows.hits + 1
      end,
      window_started_at = case
        when api_rate_limit_windows.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then v_now
        else api_rate_limit_windows.window_started_at
      end
  returning hits, window_started_at into current_hits, current_window;

  return query select
    current_hits <= p_limit,
    greatest(p_limit - current_hits, 0),
    case
      when current_hits <= p_limit then 0
      else greatest(
        ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - v_now)))::integer,
        1
      )
    end;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
