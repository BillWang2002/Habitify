begin;
-- Only the existing, password-verified grant can read these narrow projections.
alter table habitify_admin.audit add column target_id uuid;
create function public.admin_members(p_requester uuid,p_hash text,p_page integer default 1,p_search text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; ident jsonb; total integer;
begin
 perform public.admin_session_check(p_requester,p_hash);
 if p_page is null or p_page<1 or p_page>100000 or p_search is null or char_length(p_search)>100 then raise exception 'INVALID_REQUEST'; end if;
 ident:=habitify_admin.identity();
 select count(*) into total from auth.users u where u.email is not null and not exists(select 1 from habitify_admin.principals a where a.user_id=u.id) and strpos(lower(u.email),lower(p_search))>0;
 select jsonb_build_object('page',p_page,'pageSize',20,'total',total,'members',coalesce(jsonb_agg(m.data order by m.created_at desc,m.id),'[]'::jsonb)) into result from (
 select u.id,u.created_at,jsonb_build_object('id',u.id,'email',u.email,'createdAt',u.created_at,'confirmed',u.email_confirmed_at is not null,'enabled',u.banned_until is null or u.banned_until<=now(),'timezone',p.timezone) as data
 from auth.users u left join public.habit_profiles p on p.user_id=u.id
 where u.email is not null and not exists(select 1 from habitify_admin.principals a where a.user_id=u.id) and strpos(lower(u.email),lower(p_search))>0
 order by u.created_at desc,u.id limit 20 offset (p_page-1)*20) m;
 insert into habitify_admin.audit(admin_id,requester_id,operation) values((ident->>'adminId')::uuid,p_requester,'members_read');
 return result;
end $$;
create function public.admin_member_statistics(p_requester uuid,p_hash text,p_member uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u record; tz text; ident jsonb; result jsonb;
begin
 perform public.admin_session_check(p_requester,p_hash);
 select id,email,created_at,email_confirmed_at,banned_until into u from auth.users where id=p_member and email is not null and not exists(select 1 from habitify_admin.principals where user_id=p_member);
 if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
 select timezone into tz from public.habit_profiles where user_id=p_member;
 ident:=habitify_admin.identity();
 -- A missing profile stays missing. UTC is an explicit empty-account fallback, not a write.
 result:=jsonb_build_object('member',jsonb_build_object('id',u.id,'email',u.email,'createdAt',u.created_at,'confirmed',u.email_confirmed_at is not null,'enabled',u.banned_until is null or u.banned_until<=now(),'timezone',tz),
 'snapshot',jsonb_build_object('today',(now() at time zone coalesce(tz,'UTC'))::date,'serverTime',now(),'timezone',coalesce(tz,'UTC'),'statistics',public.habit_statistics_data(p_member),
 'records',coalesce((select jsonb_agg(jsonb_build_object('habitId',habit_id,'day',day,'goal',goal,'progress',progress) order by day,habit_id) from public.habit_records where user_id=p_member),'[]'::jsonb)));
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id) values((ident->>'adminId')::uuid,p_requester,'member_statistics_read',p_member);
 return result;
end $$;
revoke all on function public.admin_members(uuid,text,integer,text),public.admin_member_statistics(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_members(uuid,text,integer,text),public.admin_member_statistics(uuid,text,uuid) to service_role;
commit;
