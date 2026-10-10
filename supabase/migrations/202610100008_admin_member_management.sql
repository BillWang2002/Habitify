begin;
-- Passwords and Auth tokens never enter this operation journal.
create table habitify_admin.member_requests (
 request_id uuid primary key, requester_id uuid not null,
 operation text not null check(operation in ('member-create','member-password','member-delete','member-coins')),
 target_id uuid not null, email text not null, fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 execution_id uuid not null, leased_until timestamptz not null,
 status text not null default 'pending' check(status in ('pending','done','failed')),
 result jsonb, created_at timestamptz not null default now()
);
create index on habitify_admin.member_requests(target_id,status);
alter table habitify_admin.member_requests enable row level security;
revoke all on habitify_admin.member_requests from public,anon,authenticated;
create table habitify_admin.member_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revoked_before bigint not null
);
alter table habitify_admin.member_access enable row level security;
revoke all on habitify_admin.member_access from public,anon,authenticated;
alter table habitify_admin.audit add column request_id uuid, add column details jsonb;

create function public.habit_account_allowed(p_uid uuid,p_iat bigint) returns boolean
language sql security definer set search_path='' as $$
 select p_uid is not null
 and exists(select 1 from auth.users where id=p_uid and (banned_until is null or banned_until<=now()))
 and not exists(select 1 from habitify_admin.member_access where user_id=p_uid and (p_iat is null or p_iat<=revoked_before))
 and not exists(select 1 from habitify_admin.member_requests where target_id=p_uid and status='pending' and operation in ('member-password','member-delete'));
$$;
revoke all on function public.habit_account_allowed(uuid,bigint) from public,anon;
grant execute on function public.habit_account_allowed(uuid,bigint) to authenticated;

-- Also reject old JWTs through direct RPC access, rather than only through the Edge API.
create or replace function public.habitify_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); expected text;
begin
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 if p->>'op'='restore' then raise exception 'INVALID_REQUEST'; end if;
 if p->>'op'='delete' then
  select name into expected from public.habits where id=(p->>'habitId')::uuid and user_id=uid;
  if not found then raise exception 'HABIT_NOT_FOUND'; end if;
  if p->>'confirmationName' is distinct from expected then raise exception 'DELETE_CONFIRMATION_REQUIRED'; end if;
 end if;
 return public.habitify_request_core(p);
end $$;
-- The remaining public diagnostic data path follows the same session gate.
drop policy "read own probes" on public.infra_probes;
drop policy "write own probes" on public.infra_probes;
create policy "read own probes" on public.infra_probes for select to authenticated
 using(user_id=(select auth.uid()) and public.habit_account_allowed((select auth.uid()),((select auth.jwt())->>'iat')::bigint));
create policy "write own probes" on public.infra_probes for insert to authenticated
 with check(user_id=(select auth.uid()) and public.habit_account_allowed((select auth.uid()),((select auth.jwt())->>'iat')::bigint));

create function public.admin_member_write_begin(p_requester uuid,p_hash text,p_request uuid,p_fingerprint text,p_execution uuid,p_op text,p_member uuid,p_email text,p_confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j habitify_admin.member_requests; target uuid; v_email text; k text;
begin
 perform public.admin_session_check(p_requester,p_hash);
 if p_request is null or p_execution is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_op not in ('member-create','member-password','member-delete') or p_op is null then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-request:'||p_request::text,0));
 select * into j from habitify_admin.member_requests where request_id=p_request for update;
 if found then
  if j.requester_id<>p_requester or j.fingerprint<>p_fingerprint or j.operation<>p_op then raise exception 'REQUEST_REUSED'; end if;
  if j.status='done' then return jsonb_build_object('result',j.result); end if;
  if j.status='failed' then raise exception '%',j.result->>'code'; end if;
  if j.leased_until>now() then raise exception 'ADMIN_WRITE_BUSY'; end if;
  target:=j.target_id;v_email:=j.email;
 else
  if (select count(*) from habitify_admin.member_requests where requester_id=p_requester and created_at>now()-interval '1 hour')>=30 then raise exception 'ADMIN_RATE_LIMITED'; end if;
  if p_op='member-create' then
   v_email:=lower(btrim(p_email));
   if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_REQUEST'; end if;
   if exists(select 1 from auth.users where lower(auth.users.email)=v_email) then raise exception 'MEMBER_EXISTS'; end if;
   target:=gen_random_uuid();
  else
   select u.id,u.email into target,v_email from auth.users u where u.id=p_member;
   if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
   if exists(select 1 from habitify_admin.principals where user_id=target) or target=p_requester then raise exception 'ADMIN_FORBIDDEN'; end if;
   if p_op='member-delete' and p_confirmation is distinct from v_email then raise exception 'DELETE_CONFIRMATION_REQUIRED'; end if;
  end if;
 end if;
 k:=case when p_op='member-create' then 'admin-email:'||v_email else target::text end;
 perform pg_advisory_xact_lock(hashtextextended(k,0));
 if exists(select 1 from habitify_admin.member_requests where request_id<>p_request and status='pending' and (target_id=target or (p_op='member-create' and member_requests.email=v_email))) then raise exception 'ADMIN_WRITE_BUSY'; end if;
 if p_op<>'member-create' and (exists(select 1 from habitify_admin.principals where user_id=target) or target=p_requester) then raise exception 'ADMIN_FORBIDDEN'; end if;
 insert into habitify_admin.member_requests(request_id,requester_id,operation,target_id,email,fingerprint,execution_id,leased_until)
 values(p_request,p_requester,p_op,target,v_email,p_fingerprint,p_execution,now()+interval '60 seconds')
 on conflict(request_id) do update set execution_id=p_execution,leased_until=excluded.leased_until;
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id,request_id) values(p_requester,p_requester,p_op||'_attempt',target,p_request);
 return jsonb_build_object('targetId',target);
end $$;

create function public.admin_member_write_finish(p_requester uuid,p_request uuid,p_execution uuid,p_success boolean,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j habitify_admin.member_requests; v_result jsonb;
begin
 -- Finalization may record an already-issued Auth result after the grant expires; no new access is granted.
 select * into j from habitify_admin.member_requests where request_id=p_request and requester_id=p_requester and execution_id=p_execution for update;
 if not found then raise exception 'ADMIN_WRITE_BUSY'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'pending' then raise exception 'REQUEST_REUSED'; end if;
 if not p_success then
  if p_error not in ('MEMBER_EXISTS','PASSWORD_POLICY','MEMBER_NOT_FOUND','INVALID_REQUEST') or p_error is null then raise exception 'INVALID_REQUEST'; end if;
  v_result:=jsonb_build_object('code',p_error);
 else
  perform pg_advisory_xact_lock(hashtextextended(j.target_id::text,0));
  if j.operation='member-delete' then
   if exists(select 1 from auth.users where id=j.target_id) then raise exception 'ADMIN_WRITE_PENDING'; end if;
  else
   if not exists(select 1 from auth.users where id=j.target_id and lower(email)=lower(j.email)) then raise exception 'ADMIN_WRITE_PENDING'; end if;
   if j.operation='member-password' then
    insert into habitify_admin.member_access values(j.target_id,floor(extract(epoch from clock_timestamp()))::bigint)
    on conflict(user_id) do update set revoked_before=excluded.revoked_before;
   end if;
  end if;
  v_result:=jsonb_build_object('memberId',j.target_id,'operation',j.operation,'completed',true);
 end if;
 if p_success and j.operation='member-delete' then update habitify_admin.member_requests set email='' where target_id=j.target_id; end if;
 update habitify_admin.member_requests set status=case when p_success then 'done' else 'failed' end,result=v_result where request_id=p_request;
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id,request_id,details)
 values(p_requester,p_requester,j.operation||case when p_success then '_success' else '_failed' end,j.target_id,p_request,case when p_success then null else jsonb_build_object('code',p_error) end);
 return v_result;
end $$;

create function public.admin_member_coins(p_requester uuid,p_hash text,p_request uuid,p_member uuid,p_balance integer,p_expected bigint,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare before bigint; stamp text; old habitify_admin.member_requests; v_result jsonb; tz text;
begin
 perform public.admin_session_check(p_requester,p_hash);
 if p_request is null or p_balance is null or p_balance<0 or p_balance>1000000 or p_expected is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 200 then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-request:'||p_request::text,0));
 stamp:=md5(jsonb_build_array(p_member,p_balance,p_expected,p_reason)::text);
 select * into old from habitify_admin.member_requests where request_id=p_request;
 if found then
  if old.requester_id<>p_requester or old.operation<>'member-coins' or old.fingerprint<>repeat(stamp,2) then raise exception 'REQUEST_REUSED'; end if;
  return old.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_member::text,0));
 if p_member=p_requester or exists(select 1 from habitify_admin.principals where user_id=p_member) then raise exception 'ADMIN_FORBIDDEN'; end if;
 if not exists(select 1 from auth.users where id=p_member) then raise exception 'MEMBER_NOT_FOUND'; end if;
 if exists(select 1 from habitify_admin.member_requests where target_id=p_member and status='pending') then raise exception 'ADMIN_WRITE_BUSY'; end if;
 select coalesce(sum(delta),0) into before from public.coin_ledger where user_id=p_member;
 if before<>p_expected then raise exception 'BALANCE_CHANGED'; end if;
 select timezone into tz from public.habit_profiles where user_id=p_member;
 if abs(p_balance::bigint-before)>2147483647 then raise exception 'INVALID_REQUEST'; end if;
 if p_balance<>before then
  insert into public.coin_ledger(user_id,node,day,delta,rule_version) values(p_member,'admin:'||p_request::text,(now() at time zone coalesce(tz,'UTC'))::date,(p_balance-before)::integer,1);
 end if;
 update public.habit_profiles set revision=revision+1 where user_id=p_member;
 v_result:=jsonb_build_object('memberId',p_member,'operation','member-coins','completed',true,'balance',p_balance);
 insert into habitify_admin.member_requests(request_id,requester_id,operation,target_id,email,fingerprint,execution_id,leased_until,status,result)
 select p_request,p_requester,'member-coins',p_member,email,repeat(stamp,2),p_request,now(),'done',v_result from auth.users where id=p_member;
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id,request_id,details)
 values(p_requester,p_requester,'member-coins_success',p_member,p_request,jsonb_build_object('before',before,'after',p_balance,'delta',p_balance-before,'reason',btrim(p_reason)));
 return v_result;
end $$;

create function public.admin_member_pending(p_requester uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.admin_session_check(p_requester,p_hash);
 return jsonb_build_object('jobs',coalesce((select jsonb_agg(jsonb_build_object('requestId',request_id,'memberId',target_id,'email',email,'operation',operation,'createdAt',created_at) order by created_at) from habitify_admin.member_requests where requester_id=p_requester and status='pending'),'[]'::jsonb));
end $$;
revoke all on function public.admin_member_pending(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_member_pending(uuid,text) to service_role;

-- Return the current balance for the selected member without exposing the ledger.
alter function public.admin_member_statistics(uuid,text,uuid) rename to admin_member_statistics_read;
revoke all on function public.admin_member_statistics_read(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.admin_member_statistics(p_requester uuid,p_hash text,p_member uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.admin_member_statistics_read(p_requester,p_hash,p_member);
 return jsonb_set(result,'{member,balance}',to_jsonb(coalesce((select sum(delta) from public.coin_ledger where user_id=p_member),0)));
end $$;
revoke all on function public.admin_member_write_begin(uuid,text,uuid,text,uuid,text,uuid,text,text),public.admin_member_write_finish(uuid,uuid,uuid,boolean,text),public.admin_member_coins(uuid,text,uuid,uuid,integer,bigint,text),public.admin_member_statistics(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_member_write_begin(uuid,text,uuid,text,uuid,text,uuid,text,text),public.admin_member_write_finish(uuid,uuid,uuid,boolean,text),public.admin_member_coins(uuid,text,uuid,uuid,integer,bigint,text),public.admin_member_statistics(uuid,text,uuid) to service_role;
commit;
