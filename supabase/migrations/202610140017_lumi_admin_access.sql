begin;
-- Reuse the existing account lock and administrator identity, never client roles.
do $$ declare uid uuid; begin
 for uid in select id from auth.users order by id loop
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 end loop;
 if to_regprocedure('public.appearance_request_before_theme_access(jsonb)') is null then
  alter function public.appearance_request(jsonb) rename to appearance_request_before_theme_access;
 end if;
end $$;
revoke all on function public.appearance_request_before_theme_access(jsonb) from public,anon,authenticated;

create or replace function public.appearance_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); allowed jsonb; is_admin boolean;
begin
 if uid is null or not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED';end if;
 if p is null or jsonb_typeof(p)<>'object' or coalesce(p->>'op','') not in ('appearance-get','appearance-set') then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED';end if;
 is_admin:=coalesce((habitify_admin.identity()->>'adminId')::uuid=uid,false);
 allowed:=case when is_admin then '["growth","lumi","duckyo"]'::jsonb else '["growth","duckyo"]'::jsonb end;
 -- Permission precedes replay handling: an old successful request cannot restore access.
 if not is_admin and p->>'op'='appearance-set' and p->'settings'->>'theme'='lumi' then raise exception 'THEME_FORBIDDEN';end if;
 -- Lazy normalization also covers later administrator disablement or identity changes.
 if not is_admin then
  update public.account_appearance set settings=jsonb_build_object('theme','growth','background','plain','surface','paper','avatar','growth','mode',settings->>'mode'),
   revision=revision+1,last_request=null,last_payload=null,updated_at=now()
  where user_id=uid and settings->>'theme'='lumi';
 end if;
 return public.appearance_request_before_theme_access(p)||jsonb_build_object('allowedThemes',allowed);
end $$;
revoke all on function public.appearance_request(jsonb) from public,anon;
grant execute on function public.appearance_request(jsonb) to authenticated;

-- Preserve the valid administrator's saved theme; normalize ordinary members once.
update public.account_appearance set settings=jsonb_build_object('theme','growth','background','plain','surface','paper','avatar','growth','mode',settings->>'mode'),
 revision=revision+1,last_request=null,last_payload=null,updated_at=now()
where settings->>'theme'='lumi' and user_id is distinct from (habitify_admin.identity()->>'adminId')::uuid;
commit;
