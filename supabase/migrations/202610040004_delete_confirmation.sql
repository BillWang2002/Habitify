begin;
-- Preserve the tested transaction and reward reconciliation behind a private entry.
alter function public.habitify_request(jsonb) rename to habitify_request_core;
revoke all on function public.habitify_request_core(jsonb) from public,anon,authenticated;

create function public.habitify_request(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); expected text;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p->>'op'='restore' then raise exception 'INVALID_REQUEST'; end if;
 if p->>'op'='delete' then
  select name into expected from public.habits where id=(p->>'habitId')::uuid and user_id=uid;
  if not found then raise exception 'HABIT_NOT_FOUND'; end if;
  if p->>'confirmationName' is distinct from expected then raise exception 'DELETE_CONFIRMATION_REQUIRED'; end if;
 end if;
 return public.habitify_request_core(p);
end;
$$;
revoke all on function public.habitify_request(jsonb) from public,anon,authenticated;
grant execute on function public.habitify_request(jsonb) to authenticated;
commit;
