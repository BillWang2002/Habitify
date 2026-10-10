begin;
-- Restrict existing broker grants to the administrator's own Auth identity.
create or replace function public.admin_login_attempt(p_requester uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ident jsonb; k text; limits integer; n integer; t timestamptz:=clock_timestamp();
begin
 if p_requester is null or not exists(select 1 from auth.users where id=p_requester and (banned_until is null or banned_until<=now())) then return jsonb_build_object('code','LOGIN_REQUIRED'); end if;
 ident:=habitify_admin.identity();
 if ident is null then return jsonb_build_object('code','ADMIN_NOT_CONFIGURED'); end if;
 if (ident->>'adminId')::uuid is distinct from p_requester then return jsonb_build_object('code','ADMIN_FORBIDDEN'); end if;
 -- Lock global first, then requester, so concurrent attempts are serialized consistently.
 foreach k in array array['global',p_requester::text] loop
  limits:=case when k='global' then 50 else 5 end;
  insert into habitify_admin.attempts values(k,t,0) on conflict(bucket) do nothing;
  perform 1 from habitify_admin.attempts where bucket=k for update;
  update habitify_admin.attempts set window_start=t,count=0 where bucket=k and window_start<=t-interval '15 minutes';
  select count into n from habitify_admin.attempts where bucket=k;
  if n>=limits then return jsonb_build_object('code','ADMIN_RATE_LIMITED'); end if;
 end loop;
 update habitify_admin.attempts set count=count+1 where bucket in ('global',p_requester::text);
 insert into habitify_admin.audit(requester_id,operation) values(p_requester,'login_attempt');
 return ident;
end $$;

create or replace function public.admin_session_open(p_requester uuid,p_admin uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ident jsonb; expiry timestamptz:=now()+interval '30 minutes';
begin
 ident:=habitify_admin.identity();
 if ident is null or (ident->>'adminId')::uuid is distinct from p_admin then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_requester is null or not exists(select 1 from auth.users where id=p_requester and (banned_until is null or banned_until<=now())) then raise exception 'LOGIN_REQUIRED'; end if;
 if p_requester is distinct from p_admin then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST'; end if;
 -- One active grant per administrator account. No plaintext bearer value in the database.
 perform 1 from auth.users where id=p_requester for update;
 update habitify_admin.sessions set revoked_at=now() where requester_id=p_requester and revoked_at is null;
 insert into habitify_admin.sessions(token_hash,admin_id,requester_id,expires_at) values(p_hash,p_admin,p_requester,expiry);
 insert into habitify_admin.audit(admin_id,requester_id,operation) values(p_admin,p_requester,'login_success');
 return jsonb_build_object('expiresAt',expiry);
end $$;

create or replace function public.admin_session_check(p_requester uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s habitify_admin.sessions; ident jsonb;
begin
 select * into s from habitify_admin.sessions where token_hash=p_hash and requester_id=p_requester and revoked_at is null and expires_at>now();
 if not found then raise exception 'ADMIN_SESSION_EXPIRED'; end if;
 ident:=habitify_admin.identity();
 if p_requester is distinct from s.admin_id or ident is null or (ident->>'adminId')::uuid is distinct from s.admin_id then raise exception 'ADMIN_FORBIDDEN'; end if;
 if not exists(select 1 from auth.users where id=p_requester and (banned_until is null or banned_until<=now())) then raise exception 'LOGIN_REQUIRED'; end if;
 return jsonb_build_object('expiresAt',s.expires_at);
end $$;


update habitify_admin.sessions set revoked_at=now() where requester_id<>admin_id and revoked_at is null;
-- CREATE OR REPLACE preserves the existing service-role-only function grants.
commit;
