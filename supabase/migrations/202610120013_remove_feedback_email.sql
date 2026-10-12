-- Retire external email notifications; feedback and inbox replies remain active.
-- Keep the private legacy queue as inert history. No personal data is purged.
begin;
create or replace function public.feedback_request(p jsonb) returns jsonb
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
 result:=jsonb_build_object('id',row.id,'submitted',true);
 insert into habitify_feedback.requests values(rid,uid,row.id,p,result);
 return result;
end $$;
revoke all on function public.feedback_request(jsonb) from public,anon;
grant execute on function public.feedback_request(jsonb) to authenticated;

create or replace function public.admin_feedback(p_requester uuid,p_hash text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op text:=p->>'op'; row habitify_feedback.entries; prior habitify_feedback.requests;
 rid uuid; pg integer; n integer; result jsonb; reply_id uuid; ident jsonb;
begin
 perform public.admin_session_check(p_requester,p_hash);
 if jsonb_typeof(p) is distinct from 'object' or op is null or op not in ('feedback-admin-list','feedback-admin-get','feedback-update','feedback-reply') then raise exception 'INVALID_REQUEST'; end if;
 if op='feedback-admin-list' then
  if p-array['op','page','status','search']<>'{}'::jsonb or jsonb_typeof(p->'page') is distinct from 'number'
  or jsonb_typeof(p->'status') is distinct from 'string' or p->>'status' not in ('all','pending','processing','resolved','closed')
  or jsonb_typeof(p->'search') is distinct from 'string' or char_length(p->>'search')>100 then raise exception 'INVALID_REQUEST'; end if;
  pg:=(p->>'page')::integer;if pg<1 or pg>100000 then raise exception 'INVALID_REQUEST';end if;
  select count(*) into n from habitify_feedback.entries f join auth.users u on u.id=f.user_id
   where (p->>'status'='all' or f.status=p->>'status') and position(lower(p->>'search') in lower(f.title||' '||f.id::text||' '||coalesce(u.email,'')))>0;
  return jsonb_build_object('page',pg,'pageSize',20,'total',n,'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from
   (select f.id,f.category,f.title,f.status,f.revision,f.created_at,u.email from habitify_feedback.entries f join auth.users u on u.id=f.user_id
    where (p->>'status'='all' or f.status=p->>'status') and position(lower(p->>'search') in lower(f.title||' '||f.id::text||' '||coalesce(u.email,'')))>0 order by f.created_at desc,f.id limit 20 offset (pg-1)*20)t),'[]'::jsonb));
 end if;
 if jsonb_typeof(p->'id') is distinct from 'string' then raise exception 'INVALID_REQUEST';end if;
 if op='feedback-admin-get' then
  if p-array['op','id']<>'{}'::jsonb then raise exception 'INVALID_REQUEST';end if;
  select * into row from habitify_feedback.entries where id=(p->>'id')::uuid;
  if not found then raise exception 'FEEDBACK_NOT_FOUND';end if;
  return to_jsonb(row)||jsonb_build_object('email',(select email from auth.users where id=row.user_id),
   'replies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at) order by created_at,id) from habitify_feedback.replies where feedback_id=row.id),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(jsonb_build_object('status',status,'created_at',created_at) order by created_at,id) from habitify_feedback.history where feedback_id=row.id),'[]'::jsonb));
 end if;
 if p-(case when op='feedback-update' then array['op','id','requestId','expectedRevision','status','reason','note'] else array['op','id','requestId','expectedRevision','body'] end)<>'{}'::jsonb
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
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'completed',true);
 insert into habitify_feedback.requests values(rid,p_requester,row.id,p,result);
 ident:=habitify_admin.identity();
 insert into habitify_admin.audit(admin_id,requester_id,operation,target_id,request_id,details) values((ident->>'adminId')::uuid,p_requester,op,row.id,rid,jsonb_build_object('status',row.status,'revision',row.revision));
 return result;
end $$;
revoke all on function public.admin_feedback(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_feedback(uuid,text,jsonb) to service_role;


drop function public.feedback_mail_claim(integer);
drop function public.feedback_mail_finish(uuid,uuid,text,text);
commit;
