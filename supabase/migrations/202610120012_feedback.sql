begin;
create schema habitify_feedback;
revoke all on schema habitify_feedback from public,anon,authenticated;
create table habitify_feedback.entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('bug','idea','other')),
 title text not null check(char_length(title) between 1 and 80), body text not null check(char_length(body) between 1 and 3000),
 status text not null default 'pending' check(status in ('pending','processing','resolved','closed')),
 close_reason text not null default '' check(char_length(close_reason)<=1000), internal_note text not null default '' check(char_length(internal_note)<=1000),
 revision bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on habitify_feedback.entries(user_id,created_at desc,id);
create table habitify_feedback.replies (
 id uuid primary key default gen_random_uuid(), feedback_id uuid not null references habitify_feedback.entries(id) on delete cascade,
 admin_id uuid references auth.users(id) on delete set null, body text not null check(char_length(body) between 1 and 3000), created_at timestamptz not null default now()
);
create table habitify_feedback.history (
 id bigint generated always as identity primary key, feedback_id uuid not null references habitify_feedback.entries(id) on delete cascade,
 admin_id uuid references auth.users(id) on delete set null, status text not null, created_at timestamptz not null default now()
);
create table habitify_feedback.requests (
 request_id uuid primary key, requester_id uuid not null references auth.users(id) on delete cascade,
 feedback_id uuid not null references habitify_feedback.entries(id) on delete cascade, payload jsonb not null, result jsonb not null
);
create table habitify_feedback.mail_tasks (
 id uuid primary key default gen_random_uuid(), feedback_id uuid not null unique references habitify_feedback.entries(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','processing','accepted','failed','uncertain')),
 attempts integer not null default 0, next_at timestamptz not null default now(), lease_id uuid, lease_until timestamptz,
 error_code text, accepted_at timestamptz, created_at timestamptz not null default now()
);
alter table habitify_feedback.entries enable row level security;
alter table habitify_feedback.replies enable row level security;
alter table habitify_feedback.history enable row level security;
alter table habitify_feedback.requests enable row level security;
alter table habitify_feedback.mail_tasks enable row level security;
revoke all on all tables in schema habitify_feedback from public,anon,authenticated;
revoke all on all sequences in schema habitify_feedback from public,anon,authenticated;

-- A delivery is either an announcement or a private feedback reply.
alter table habitify_messages.deliveries alter column announcement_id drop not null;
alter table habitify_messages.deliveries add column feedback_reply_id uuid references habitify_feedback.replies(id) on delete cascade;
alter table habitify_messages.deliveries add constraint delivery_one_source check(num_nonnulls(announcement_id,feedback_reply_id)=1);
create unique index on habitify_messages.deliveries(user_id,feedback_reply_id);
create view habitify_messages.received_content as
 select d.id,d.user_id,d.received_at,d.read_at,d.trashed_at,
 case when a.id is not null then a.title else '反馈回复 · '||f.title end as title,
 case when a.id is not null then case when a.status='published' then a.body end else r.body end as body,
 coalesce(a.status,'published') as status,
 case when a.id is not null then 'announcement' else 'feedback-reply' end as kind,
 r.feedback_id
 from habitify_messages.deliveries d left join habitify_messages.announcements a on a.id=d.announcement_id
 left join habitify_feedback.replies r on r.id=d.feedback_reply_id left join habitify_feedback.entries f on f.id=r.feedback_id;
revoke all on habitify_messages.received_content from public,anon,authenticated;

create function public.feedback_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); op text:=p->>'op'; rid uuid; row habitify_feedback.entries; prior habitify_feedback.requests; result jsonb; pg integer; n integer;
begin
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 if jsonb_typeof(p) is distinct from 'object' or op not in ('feedback-list','feedback-get','feedback-submit') or op is null then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 if op='feedback-list' then
  if p-array['op','page']<>'{}'::jsonb or jsonb_typeof(p->'page') is distinct from 'number' then raise exception 'INVALID_REQUEST'; end if;
  pg:=(p->>'page')::integer;if pg<1 or pg>100000 then raise exception 'INVALID_REQUEST'; end if;
  select count(*) into n from habitify_feedback.entries where user_id=uid;
  return jsonb_build_object('page',pg,'pageSize',20,'total',n,'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from
   (select id,category,title,status,created_at,updated_at from habitify_feedback.entries where user_id=uid order by created_at desc,id limit 20 offset (pg-1)*20)t),'[]'::jsonb));
 elsif op='feedback-get' then
  if p-array['op','id']<>'{}'::jsonb or jsonb_typeof(p->'id') is distinct from 'string' then raise exception 'INVALID_REQUEST'; end if;
  select * into row from habitify_feedback.entries where id=(p->>'id')::uuid and user_id=uid;
  if not found then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  return (to_jsonb(row)-array['user_id','internal_note','revision'])||jsonb_build_object('replies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at) order by created_at,id) from habitify_feedback.replies where feedback_id=row.id),'[]'::jsonb));
 end if;
 if p-array['op','requestId','category','title','body']<>'{}'::jsonb or jsonb_typeof(p->'requestId') is distinct from 'string'
 or jsonb_typeof(p->'category') is distinct from 'string' or p->>'category' not in ('bug','idea','other')
 or jsonb_typeof(p->'title') is distinct from 'string' or char_length(btrim(p->>'title')) not between 1 and 80
 or jsonb_typeof(p->'body') is distinct from 'string' or char_length(btrim(p->>'body')) not between 1 and 3000 then raise exception 'INVALID_REQUEST'; end if;
 rid:=(p->>'requestId')::uuid;
 select * into prior from habitify_feedback.requests where request_id=rid;
 if found then if prior.requester_id<>uid or prior.payload<>p then raise exception 'REQUEST_REUSED'; end if;return prior.result;end if;
 -- Rolling limits are server-time based, separate from habit action dates.
 if (select count(*) from habitify_feedback.entries where user_id=uid and created_at>now()-interval '24 hours')>=5
 or exists(select 1 from habitify_feedback.entries where user_id=uid and created_at>now()-interval '60 seconds') then raise exception 'FEEDBACK_RATE_LIMITED'; end if;
 insert into habitify_feedback.entries(user_id,category,title,body) values(uid,p->>'category',btrim(p->>'title'),btrim(p->>'body')) returning * into row;
 insert into habitify_feedback.mail_tasks(feedback_id) values(row.id);
 result:=jsonb_build_object('id',row.id,'submitted',true);
 insert into habitify_feedback.requests values(rid,uid,row.id,p,result);
 return result;
end $$;
revoke all on function public.feedback_request(jsonb) from public,anon;
grant execute on function public.feedback_request(jsonb) to authenticated;

create function public.admin_feedback(p_requester uuid,p_hash text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op text:=p->>'op'; row habitify_feedback.entries; prior habitify_feedback.requests; task habitify_feedback.mail_tasks;
 rid uuid; pg integer; n integer; result jsonb; reply_id uuid; ident jsonb;
begin
 perform public.admin_session_check(p_requester,p_hash);
 if jsonb_typeof(p) is distinct from 'object' or op is null or op not in ('feedback-admin-list','feedback-admin-get','feedback-update','feedback-reply','feedback-mail-retry') then raise exception 'INVALID_REQUEST'; end if;
 if op='feedback-admin-list' then
  if p-array['op','page','status','search']<>'{}'::jsonb or jsonb_typeof(p->'page') is distinct from 'number'
  or jsonb_typeof(p->'status') is distinct from 'string' or p->>'status' not in ('all','pending','processing','resolved','closed')
  or jsonb_typeof(p->'search') is distinct from 'string' or char_length(p->>'search')>100 then raise exception 'INVALID_REQUEST'; end if;
  pg:=(p->>'page')::integer;if pg<1 or pg>100000 then raise exception 'INVALID_REQUEST';end if;
  select count(*) into n from habitify_feedback.entries f join auth.users u on u.id=f.user_id
   where (p->>'status'='all' or f.status=p->>'status') and position(lower(p->>'search') in lower(f.title||' '||f.id::text||' '||coalesce(u.email,'')))>0;
  return jsonb_build_object('page',pg,'pageSize',20,'total',n,'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from
   (select f.id,f.category,f.title,f.status,f.revision,f.created_at,u.email,m.state as mail_state from habitify_feedback.entries f join auth.users u on u.id=f.user_id join habitify_feedback.mail_tasks m on m.feedback_id=f.id
    where (p->>'status'='all' or f.status=p->>'status') and position(lower(p->>'search') in lower(f.title||' '||f.id::text||' '||coalesce(u.email,'')))>0 order by f.created_at desc,f.id limit 20 offset (pg-1)*20)t),'[]'::jsonb));
 end if;
 if jsonb_typeof(p->'id') is distinct from 'string' then raise exception 'INVALID_REQUEST';end if;
 if op='feedback-admin-get' then
  if p-array['op','id']<>'{}'::jsonb then raise exception 'INVALID_REQUEST';end if;
  select * into row from habitify_feedback.entries where id=(p->>'id')::uuid;
  if not found then raise exception 'FEEDBACK_NOT_FOUND';end if;
  return to_jsonb(row)||jsonb_build_object('email',(select email from auth.users where id=row.user_id),
   'mail',(select to_jsonb(m)-array['lease_id','lease_until'] from habitify_feedback.mail_tasks m where feedback_id=row.id),
   'replies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at) order by created_at,id) from habitify_feedback.replies where feedback_id=row.id),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(jsonb_build_object('status',status,'created_at',created_at) order by created_at,id) from habitify_feedback.history where feedback_id=row.id),'[]'::jsonb));
 end if;
 if p-(case when op='feedback-update' then array['op','id','requestId','expectedRevision','status','reason','note'] when op='feedback-reply' then array['op','id','requestId','expectedRevision','body'] else array['op','id','requestId','expectedRevision','confirmUncertain'] end)<>'{}'::jsonb
 or jsonb_typeof(p->'requestId') is distinct from 'string' or jsonb_typeof(p->'expectedRevision') is distinct from 'number' then raise exception 'INVALID_REQUEST';end if;
 rid:=(p->>'requestId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('habitify-feedback-admin',0));perform public.admin_session_check(p_requester,p_hash);
 select * into prior from habitify_feedback.requests where request_id=rid;
 if found then if prior.requester_id<>p_requester or prior.payload<>p then raise exception 'REQUEST_REUSED';end if;return prior.result;end if;
 select * into row from habitify_feedback.entries where id=(p->>'id')::uuid for update;
 if not found then raise exception 'FEEDBACK_NOT_FOUND';end if;
 if row.revision<>(p->>'expectedRevision')::bigint then raise exception 'STALE_DATA';end if;
 if op='feedback-update' then
  if jsonb_typeof(p->'status') is distinct from 'string' or p->>'status' not in ('pending','processing','resolved','closed')
  or jsonb_typeof(p->'reason') is distinct from 'string' or char_length(p->>'reason')>1000
  or jsonb_typeof(p->'note') is distinct from 'string' or char_length(p->>'note')>1000 then raise exception 'INVALID_REQUEST';end if;
  if p->>'status'='closed' and nullif(btrim(p->>'reason'),'') is null then raise exception 'CLOSE_REASON_REQUIRED';end if;
  update habitify_feedback.entries set status=p->>'status',close_reason=case when p->>'status'='closed' then btrim(p->>'reason') else '' end,internal_note=p->>'note',revision=revision+1,updated_at=now() where id=row.id returning * into row;
  insert into habitify_feedback.history(feedback_id,admin_id,status) values(row.id,p_requester,row.status);
 elsif op='feedback-reply' then
  if jsonb_typeof(p->'body') is distinct from 'string' or char_length(btrim(p->>'body')) not between 1 and 3000 then raise exception 'INVALID_REQUEST';end if;
  insert into habitify_feedback.replies(feedback_id,admin_id,body) values(row.id,p_requester,btrim(p->>'body')) returning id into reply_id;
  insert into habitify_messages.deliveries(user_id,feedback_reply_id) values(row.user_id,reply_id);
  update habitify_feedback.entries set revision=revision+1,updated_at=now() where id=row.id returning * into row;
 else
  if jsonb_typeof(p->'confirmUncertain') is distinct from 'boolean' then raise exception 'INVALID_REQUEST';end if;
  select * into task from habitify_feedback.mail_tasks where feedback_id=row.id for update;
  if task.state not in ('failed','uncertain') then raise exception 'MAIL_NOT_RETRYABLE';end if;
  if task.state='uncertain' and not (p->>'confirmUncertain')::boolean then raise exception 'MAIL_CONFIRMATION_REQUIRED';end if;
  update habitify_feedback.mail_tasks set state='pending',attempts=0,next_at=now(),lease_id=null,lease_until=null,error_code=null where id=task.id;
  update habitify_feedback.entries set revision=revision+1,updated_at=now() where id=row.id returning * into row;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'completed',true);
 insert into habitify_feedback.requests values(rid,p_requester,row.id,p,result);
 ident:=habitify_admin.identity();
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id,request_id,details) values((ident->>'adminId')::uuid,p_requester,op,row.id,rid,jsonb_build_object('status',row.status,'revision',row.revision));
 return result;
end $$;
revoke all on function public.admin_feedback(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_feedback(uuid,text,jsonb) to service_role;

-- Only a server worker may lease mail; an expired lease is ambiguous, never blindly resend.
create function public.feedback_mail_claim(p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_limit<1 or p_limit>10 or p_limit is null then raise exception 'INVALID_REQUEST';end if;
 update habitify_feedback.mail_tasks set state='uncertain',error_code='LEASE_EXPIRED',lease_id=null,lease_until=null where state='processing' and lease_until<now();
 with due as (select id from habitify_feedback.mail_tasks where state='pending' and next_at<=now() order by created_at,id for update skip locked limit p_limit),
 leased as (update habitify_feedback.mail_tasks m set state='processing',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes' from due where m.id=due.id returning m.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'leaseId',m.lease_id,'attempts',m.attempts,'feedbackId',f.id,'category',f.category,'title',f.title,'summary',left(f.body,200),'createdAt',f.created_at)),'[]'::jsonb) into result from leased m join habitify_feedback.entries f on f.id=m.feedback_id;
 return result;
end $$;
create function public.feedback_mail_finish(p_id uuid,p_lease uuid,p_result text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare task habitify_feedback.mail_tasks;
begin
 if p_result is null or p_result not in ('accepted','retry','failed','uncertain') or p_error is not null and p_error not in ('RATE_LIMITED','REJECTED','RESULT_UNKNOWN') then raise exception 'INVALID_REQUEST';end if;
 select * into task from habitify_feedback.mail_tasks where id=p_id and state='processing' and lease_id=p_lease for update;
 if not found then return jsonb_build_object('completed',false);end if;
 update habitify_feedback.mail_tasks set state=case when p_result='retry' then case when attempts<5 then 'pending' else 'failed' end else p_result end,
 next_at=now()+case when attempts=1 then interval '1 minute' when attempts=2 then interval '5 minutes' else interval '30 minutes' end,
 error_code=p_error,accepted_at=case when p_result='accepted' then now() end,lease_id=null,lease_until=null where id=task.id;
 return jsonb_build_object('completed',true);
end $$;
revoke all on function public.feedback_mail_claim(integer),public.feedback_mail_finish(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.feedback_mail_claim(integer),public.feedback_mail_finish(uuid,uuid,text,text) to service_role;

create or replace function public.inbox_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();op text:=p->>'op';mid uuid;n integer;unread integer;pg integer;trash boolean;result jsonb;
begin
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED';end if;
 if jsonb_typeof(p) is distinct from 'object' or op is null or op not in ('inbox-count','inbox-list','inbox-open','inbox-read-all','inbox-trash','inbox-restore') then raise exception 'INVALID_REQUEST';end if;
 if op in ('inbox-count','inbox-read-all') then if p-'op'<>'{}'::jsonb then raise exception 'INVALID_REQUEST';end if;
 elsif op='inbox-list' then
  if p-array['op','page','view']<>'{}'::jsonb or jsonb_typeof(p->'page') is distinct from 'number' or jsonb_typeof(p->'view') is distinct from 'string' or p->>'view' not in ('inbox','trash') then raise exception 'INVALID_REQUEST';end if;
  pg:=(p->>'page')::integer;if pg<1 or pg>100000 then raise exception 'INVALID_REQUEST';end if;trash:=p->>'view'='trash';
 else
  if p-array['op','id']<>'{}'::jsonb or jsonb_typeof(p->'id') is distinct from 'string' then raise exception 'INVALID_REQUEST';end if;
  mid:=(p->>'id')::uuid;perform 1 from habitify_messages.deliveries where id=mid and user_id=uid for update;
  if not found then raise exception 'MESSAGE_NOT_FOUND';end if;
 end if;
 if op='inbox-read-all' then
  update habitify_messages.deliveries d set read_at=now() from habitify_messages.received_content c where c.id=d.id and d.user_id=uid and d.trashed_at is null and d.read_at is null and c.status='published';
 elsif op='inbox-open' then update habitify_messages.deliveries set read_at=coalesce(read_at,now()) where id=mid and user_id=uid;
 elsif op='inbox-trash' then update habitify_messages.deliveries set trashed_at=coalesce(trashed_at,now()) where id=mid and user_id=uid;
 elsif op='inbox-restore' then update habitify_messages.deliveries set trashed_at=null where id=mid and user_id=uid;end if;
 select count(*) into unread from habitify_messages.received_content where user_id=uid and read_at is null and trashed_at is null and status='published';
 if op='inbox-list' then
  select count(*) into n from habitify_messages.deliveries where user_id=uid and (trashed_at is not null)=trash;
  result:=jsonb_build_object('unread',unread,'page',pg,'pageSize',20,'total',n,'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.received_at desc,t.id) from
   (select id,title,received_at,read_at,trashed_at,status,kind,feedback_id,left(body,120) as summary from habitify_messages.received_content where user_id=uid and (trashed_at is not null)=trash order by received_at desc,id limit 20 offset (pg-1)*20)t),'[]'::jsonb));
 elsif op='inbox-open' then
  select jsonb_build_object('unread',unread,'message',to_jsonb(c)-'user_id') into result from habitify_messages.received_content c where id=mid and user_id=uid;
 else result:=jsonb_build_object('unread',unread);end if;
 return result;
end $$;
commit;
