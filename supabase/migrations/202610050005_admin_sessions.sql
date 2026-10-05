begin;
-- No credentials or public member-data access. Only the broker's service-role RPCs can enter.
create schema habitify_admin;
revoke all on schema habitify_admin from public,anon,authenticated;
create table habitify_admin.principals (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expected_email text not null, enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table habitify_admin.sessions (
 token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
 admin_id uuid not null references habitify_admin.principals(user_id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, check(expires_at>created_at)
);
create index on habitify_admin.sessions(requester_id);
create table habitify_admin.attempts (
 bucket text primary key, window_start timestamptz not null, count integer not null check(count>=0)
);
create table habitify_admin.audit (
 id bigint generated always as identity primary key,
 admin_id uuid, requester_id uuid not null, operation text not null,
 created_at timestamptz not null default now()
);
alter table habitify_admin.principals enable row level security;
alter table habitify_admin.sessions enable row level security;
alter table habitify_admin.attempts enable row level security;
alter table habitify_admin.audit enable row level security;
revoke all on all tables in schema habitify_admin from public,anon,authenticated;
revoke all on all sequences in schema habitify_admin from public,anon,authenticated;

create function habitify_admin.identity() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a record;
begin
 if (select count(*) from habitify_admin.principals where enabled)<>1 then return null; end if;
 select u.id,u.email into a from habitify_admin.principals p join auth.users u on u.id=p.user_id
 where p.enabled and lower(u.email)=lower(p.expected_email) and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<=now());
 if not found then return null; end if;
 return jsonb_build_object('adminId',a.id,'email',a.email);
end $$;
revoke all on function habitify_admin.identity() from public,anon,authenticated;

-- Attempts commit before the password check. No client-supplied IP can evade these limits.
create function public.admin_login_attempt(p_requester uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ident jsonb; k text; limits integer; n integer; t timestamptz:=clock_timestamp();
begin
 if p_requester is null or not exists(select 1 from auth.users where id=p_requester and (banned_until is null or banned_until<=now())) then return jsonb_build_object('code','LOGIN_REQUIRED'); end if;
 ident:=habitify_admin.identity();
 if ident is null then return jsonb_build_object('code','ADMIN_NOT_CONFIGURED'); end if;
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

create function public.admin_session_open(p_requester uuid,p_admin uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ident jsonb; expiry timestamptz:=now()+interval '30 minutes';
begin
 ident:=habitify_admin.identity();
 if ident is null or (ident->>'adminId')::uuid is distinct from p_admin then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_requester is null or not exists(select 1 from auth.users where id=p_requester and (banned_until is null or banned_until<=now())) then raise exception 'LOGIN_REQUIRED'; end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST'; end if;
 -- One active grant per ordinary-account requester. No plaintext bearer value in the database.
 perform 1 from auth.users where id=p_requester for update;
 update habitify_admin.sessions set revoked_at=now() where requester_id=p_requester and revoked_at is null;
 insert into habitify_admin.sessions(token_hash,admin_id,requester_id,expires_at) values(p_hash,p_admin,p_requester,expiry);
 insert into habitify_admin.audit(admin_id,requester_id,operation) values(p_admin,p_requester,'login_success');
 return jsonb_build_object('expiresAt',expiry);
end $$;

create function public.admin_session_check(p_requester uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s habitify_admin.sessions; ident jsonb;
begin
 select * into s from habitify_admin.sessions where token_hash=p_hash and requester_id=p_requester and revoked_at is null and expires_at>now();
 if not found then raise exception 'ADMIN_SESSION_EXPIRED'; end if;
 ident:=habitify_admin.identity();
 if ident is null or (ident->>'adminId')::uuid is distinct from s.admin_id then raise exception 'ADMIN_FORBIDDEN'; end if;
 if not exists(select 1 from auth.users where id=p_requester and (banned_until is null or banned_until<=now())) then raise exception 'LOGIN_REQUIRED'; end if;
 return jsonb_build_object('expiresAt',s.expires_at);
end $$;

create function public.admin_session_close(p_requester uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 update habitify_admin.sessions set revoked_at=now() where token_hash=p_hash and requester_id=p_requester and revoked_at is null returning admin_id into a;
 if found then insert into habitify_admin.audit(admin_id,requester_id,operation) values(a,p_requester,'logout'); end if;
 return jsonb_build_object('closed',true);
end $$;

revoke all on function public.admin_login_attempt(uuid),public.admin_session_open(uuid,uuid,text),public.admin_session_check(uuid,text),public.admin_session_close(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_login_attempt(uuid),public.admin_session_open(uuid,uuid,text),public.admin_session_check(uuid,text),public.admin_session_close(uuid,text) to service_role;
commit;
