begin;
create schema habitify_messages;
revoke all on schema habitify_messages from public,anon,authenticated;
create table habitify_messages.announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 80),
 body text not null check(char_length(body) between 1 and 10000),
 audience text not null check(audience in ('all','member')), recipient_id uuid,
 continuous boolean not null default false, status text not null default 'draft' check(status in ('draft','published','withdrawn')),
 replaces_id uuid references habitify_messages.announcements(id), revision bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 check((audience='all' and recipient_id is null) or (audience='member' and recipient_id is not null)),
 check(not continuous or audience='all')
);
create table habitify_messages.deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 announcement_id uuid not null references habitify_messages.announcements(id),
 received_at timestamptz not null default now(), read_at timestamptz, trashed_at timestamptz,
 unique(user_id,announcement_id)
);
create index on habitify_messages.deliveries(user_id,received_at desc,id);
create table habitify_messages.requests (
 request_id uuid primary key, requester_id uuid not null, payload jsonb not null, result jsonb not null
);
alter table habitify_messages.announcements enable row level security;
alter table habitify_messages.deliveries enable row level security;
alter table habitify_messages.requests enable row level security;
revoke all on all tables in schema habitify_messages from public,anon,authenticated;

-- Registration and publishing share a lock: welcome deliveries happen once,
-- regardless of whether the account was created in Auth Dashboard or our admin API.
create function habitify_messages.welcome_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('habitify-announcements',0));
 if new.email is not null and (new.banned_until is null or new.banned_until<=now()) then
  insert into habitify_messages.deliveries(user_id,announcement_id)
  select new.id,id from habitify_messages.announcements where status='published' and audience='all' and continuous
  on conflict(user_id,announcement_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function habitify_messages.welcome_member() from public,anon,authenticated;
create trigger habitify_welcome_member after insert on auth.users for each row execute function habitify_messages.welcome_member();

create function public.admin_announcements(p_requester uuid,p_hash text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op text:=p->>'op'; a habitify_messages.announcements; rid uuid; aid uuid; result jsonb; prior habitify_messages.requests; n integer; pg integer; ident jsonb;
begin
 perform public.admin_session_check(p_requester,p_hash);
 if jsonb_typeof(p) is distinct from 'object' or op is null or op not in ('announcement-list','announcement-get','announcement-save','announcement-publish','announcement-stop','announcement-withdraw') then raise exception 'INVALID_REQUEST'; end if;
 if op='announcement-list' then
  if p - array['op','page'] <> '{}'::jsonb or jsonb_typeof(p->'page') is distinct from 'number' then raise exception 'INVALID_REQUEST'; end if;
  pg:=(p->>'page')::integer; if pg<1 or pg>100000 then raise exception 'INVALID_REQUEST'; end if;
  select count(*) into n from habitify_messages.announcements;
  return jsonb_build_object('page',pg,'pageSize',20,'total',n,'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id) from (select * from habitify_messages.announcements order by updated_at desc,id limit 20 offset (pg-1)*20)t),'[]'::jsonb));
 end if;
 if op='announcement-get' then
  if p - array['op','id'] <> '{}'::jsonb then raise exception 'INVALID_REQUEST'; end if;
  select * into a from habitify_messages.announcements where id=(p->>'id')::uuid;
  if not found then raise exception 'ANNOUNCEMENT_NOT_FOUND'; end if;
  return to_jsonb(a)||jsonb_build_object('recipient_email',(select email from auth.users where id=a.recipient_id));
 end if;
 if p - (case when op='announcement-save' then array['op','id','expectedRevision','requestId','title','body','audience','recipientId','continuous','sourceId'] else array['op','id','expectedRevision','requestId'] end) <> '{}'::jsonb
 or jsonb_typeof(p->'requestId') is distinct from 'string' or jsonb_typeof(p->'expectedRevision') is distinct from 'number' then raise exception 'INVALID_REQUEST'; end if;
 rid:=(p->>'requestId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('habitify-announcements',0));
 perform public.admin_session_check(p_requester,p_hash);
 select * into prior from habitify_messages.requests where request_id=rid;
 if found then
  if prior.requester_id<>p_requester or prior.payload<>p then raise exception 'REQUEST_REUSED'; end if;
  return prior.result;
 end if;
 aid:=(p->>'id')::uuid;
 if aid is not null then
  select * into a from habitify_messages.announcements where id=aid for update;
  if not found then raise exception 'ANNOUNCEMENT_NOT_FOUND'; end if;
  if a.revision<>(p->>'expectedRevision')::bigint then raise exception 'STALE_DATA'; end if;
 elsif op<>'announcement-save' or (p->>'expectedRevision')::bigint<>0 then raise exception 'INVALID_REQUEST';
 end if;
 if op='announcement-save' then
  if jsonb_typeof(p->'title') is distinct from 'string' or jsonb_typeof(p->'body') is distinct from 'string' or jsonb_typeof(p->'continuous') is distinct from 'boolean'
  or jsonb_typeof(p->'audience') is distinct from 'string' or p->>'audience' not in ('all','member') or nullif(btrim(p->>'title'),'') is null or nullif(btrim(p->>'body'),'') is null then raise exception 'INVALID_REQUEST'; end if;
  if (p->>'audience'='all' and p->>'recipientId' is not null) or (p->>'audience'='member' and ((p->>'continuous')::boolean or p->>'recipientId' is null)) then raise exception 'INVALID_REQUEST'; end if;
  if p->>'audience'='member' and not exists(select 1 from auth.users where id=(p->>'recipientId')::uuid and email is not null and (banned_until is null or banned_until<=now()) and not exists(select 1 from habitify_admin.principals where user_id=auth.users.id)) then raise exception 'MEMBER_NOT_FOUND'; end if;
  if p->>'sourceId' is not null and not exists(select 1 from habitify_messages.announcements where id=(p->>'sourceId')::uuid and status in ('published','withdrawn')) then raise exception 'INVALID_REQUEST'; end if;
  if aid is not null and a.replaces_id is distinct from (p->>'sourceId')::uuid then raise exception 'INVALID_REQUEST'; end if;
  if aid is null then
   insert into habitify_messages.announcements(title,body,audience,recipient_id,continuous,replaces_id) values(btrim(p->>'title'),p->>'body',p->>'audience',(p->>'recipientId')::uuid,(p->>'continuous')::boolean,(p->>'sourceId')::uuid) returning * into a;
  else
   if a.status<>'draft' then raise exception 'ANNOUNCEMENT_IMMUTABLE'; end if;
   update habitify_messages.announcements set title=btrim(p->>'title'),body=p->>'body',audience=p->>'audience',recipient_id=(p->>'recipientId')::uuid,continuous=(p->>'continuous')::boolean,revision=revision+1,updated_at=now() where id=aid returning * into a;
  end if;
 elsif op='announcement-publish' then
  if a.replaces_id is not null and exists(select 1 from habitify_messages.announcements where id=a.replaces_id and status<>'withdrawn') then raise exception 'REPLACEMENT_REQUIRES_WITHDRAWAL'; end if;
  if a.status<>'draft' then raise exception 'ANNOUNCEMENT_IMMUTABLE'; end if;
  if a.audience='member' and not exists(select 1 from auth.users where id=a.recipient_id and email is not null and (banned_until is null or banned_until<=now()) and not exists(select 1 from habitify_admin.principals where user_id=auth.users.id)) then raise exception 'MEMBER_NOT_FOUND'; end if;
  update habitify_messages.announcements set status='published',published_at=now(),updated_at=now(),revision=revision+1 where id=a.id returning * into a;
  insert into habitify_messages.deliveries(user_id,announcement_id)
  select id,a.id from auth.users u where email is not null and (banned_until is null or banned_until<=now()) and not exists(select 1 from habitify_admin.principals where user_id=u.id) and (a.audience='all' or u.id=a.recipient_id)
  on conflict(user_id,announcement_id) do nothing;
 else
  if a.status<>'published' then raise exception 'ANNOUNCEMENT_IMMUTABLE'; end if;
  update habitify_messages.announcements set continuous=false,status=case when op='announcement-withdraw' then 'withdrawn' else status end,revision=revision+1,updated_at=now() where id=a.id returning * into a;
 end if;
 result:=to_jsonb(a);
 insert into habitify_messages.requests values(rid,p_requester,p,result);
 ident:=habitify_admin.identity();
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id,request_id,details) values((ident->>'adminId')::uuid,p_requester,op,a.id,rid,jsonb_build_object('audience',a.audience,'continuous',a.continuous,'revision',a.revision));
 return result;
end $$;
revoke all on function public.admin_announcements(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_announcements(uuid,text,jsonb) to service_role;

create function public.inbox_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); op text:=p->>'op'; mid uuid; result jsonb; n integer; unread integer; pg integer; trash boolean; affected integer;
begin
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 if jsonb_typeof(p) is distinct from 'object' or op is null or op not in ('inbox-count','inbox-list','inbox-open','inbox-read-all','inbox-trash','inbox-restore') then raise exception 'INVALID_REQUEST'; end if;
 if op in ('inbox-count','inbox-read-all') then
  if p - 'op'<>'{}'::jsonb then raise exception 'INVALID_REQUEST'; end if;
 elsif op='inbox-list' then
  if p - array['op','page','view']<>'{}'::jsonb or jsonb_typeof(p->'page') is distinct from 'number' or jsonb_typeof(p->'view') is distinct from 'string' or p->>'view' not in ('inbox','trash') then raise exception 'INVALID_REQUEST'; end if;
  pg:=(p->>'page')::integer; if pg<1 or pg>100000 then raise exception 'INVALID_REQUEST'; end if; trash:=p->>'view'='trash';
 else
  if p - array['op','id']<>'{}'::jsonb or jsonb_typeof(p->'id') is distinct from 'string' then raise exception 'INVALID_REQUEST'; end if; mid:=(p->>'id')::uuid;
  perform 1 from habitify_messages.deliveries where id=mid and user_id=uid for update;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
 end if;
 if op='inbox-read-all' then
  update habitify_messages.deliveries d set read_at=now() from habitify_messages.announcements a where d.announcement_id=a.id and d.user_id=uid and d.trashed_at is null and d.read_at is null and a.status='published';
 elsif op='inbox-open' then
  update habitify_messages.deliveries set read_at=coalesce(read_at,now()) where id=mid and user_id=uid;
 elsif op='inbox-trash' then
  update habitify_messages.deliveries set trashed_at=coalesce(trashed_at,now()) where id=mid and user_id=uid;
 elsif op='inbox-restore' then
  update habitify_messages.deliveries set trashed_at=null where id=mid and user_id=uid;
 end if;
 select count(*) into unread from habitify_messages.deliveries d join habitify_messages.announcements a on a.id=d.announcement_id where d.user_id=uid and d.read_at is null and d.trashed_at is null and a.status='published';
 if op='inbox-list' then
  select count(*) into n from habitify_messages.deliveries where user_id=uid and (trashed_at is not null)=trash;
  result:=jsonb_build_object('unread',unread,'page',pg,'pageSize',20,'total',n,'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.received_at desc,t.id) from (
   select d.id,a.title,d.received_at,d.read_at,d.trashed_at,a.status,case when a.status='published' then left(a.body,120) else null end as summary from habitify_messages.deliveries d join habitify_messages.announcements a on a.id=d.announcement_id where d.user_id=uid and (d.trashed_at is not null)=trash order by d.received_at desc,d.id limit 20 offset (pg-1)*20
  )t),'[]'::jsonb));
 elsif op='inbox-open' then
  select jsonb_build_object('unread',unread,'message',jsonb_build_object('id',d.id,'title',a.title,'body',case when a.status='published' then a.body else null end,'status',a.status,'received_at',d.received_at,'read_at',d.read_at,'trashed_at',d.trashed_at)) into result from habitify_messages.deliveries d join habitify_messages.announcements a on a.id=d.announcement_id where d.id=mid and d.user_id=uid;
 else result:=jsonb_build_object('unread',unread); end if;
 return result;
end $$;
revoke all on function public.inbox_request(jsonb) from public,anon;
grant execute on function public.inbox_request(jsonb) to authenticated;
commit;
