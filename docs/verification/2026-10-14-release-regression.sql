-- Habitify-dev only. All identities, role bindings, business writes and deliveries
-- exist inside this rollback transaction; no real member is edited or charged.
begin;
create function pg_temp.test_identity(uid uuid) returns void language plpgsql as $$
declare iat bigint:=extract(epoch from now())::bigint+2;
begin
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claim.iat',iat::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','iat',iat)::text,true);
end $$;
create function pg_temp.must_reject(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;raise exception 'UNEXPECTED_ACCEPT: %',expected;
 exception when raise_exception then if sqlerrm<>expected then raise;end if;end;
end $$;
do $$
declare admin uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();
 hash text:=repeat('a',64);s jsonb;r jsonb;p jsonb;cfg jsonb;ann jsonb;feedback jsonb;
 habit uuid;message uuid;announcement uuid;request uuid;execution uuid;job jsonb;
begin
 if has_function_privilege('anon','public.appearance_request(jsonb)','execute')
 or not has_function_privilege('authenticated','public.appearance_request(jsonb)','execute')
 or has_function_privilege('authenticated','public.appearance_request_before_theme_access(jsonb)','execute')
 or has_function_privilege('authenticated','habitify_admin.identity()','execute')
 or has_function_privilege('authenticated','public.admin_member_coins(uuid,text,uuid,uuid,integer,bigint,text)','execute')
 or has_table_privilege('authenticated','public.account_appearance','select')
 or has_table_privilege('authenticated','public.coin_ledger','insert')
 or has_table_privilege('authenticated','public.reward_purchases','select') then raise exception 'ACL_FAILED';end if;
 -- Uncommitted binding is invisible to other sessions and is restored by rollback.
 update habitify_admin.principals set enabled=false;
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values
 (admin,'regression-admin-'||admin||'@example.invalid',now(),now(),now()),
 (a,'regression-a-'||a||'@example.invalid',now(),now(),now()),
 (b,'regression-b-'||b||'@example.invalid',now(),now(),now());
 insert into habitify_admin.principals(user_id,expected_email) values(admin,'regression-admin-'||admin||'@example.invalid');
 perform public.admin_session_open(admin,admin,hash);
 perform pg_temp.test_identity(a);
 r:=public.appearance_request('{"op":"appearance-get"}');
 if r->'allowedThemes'<>'["growth","duckyo"]'::jsonb or exists(select 1 from public.habit_profiles where user_id=a) then raise exception 'MEMBER_THEME_FAILED';end if;
 cfg:='{"theme":"lumi","background":"harbor","surface":"glass","avatar":"lumi-harbor","mode":"dark"}';
 p:=jsonb_build_object('op','appearance-set','settings',cfg,'expectedRevision',0,'requestId',gen_random_uuid());
 perform pg_temp.must_reject(format('select public.appearance_request(%L::jsonb)',p),'THEME_FORBIDDEN');
 perform pg_temp.test_identity(admin);r:=public.appearance_request(p);
 if r->'settings'<>cfg or r->'allowedThemes'<>'["growth","lumi","duckyo"]'::jsonb or public.appearance_request(p)<>r then raise exception 'ADMIN_THEME_FAILED';end if;
 perform pg_temp.test_identity(a);
 -- Legacy member Lumi, including its old replay fingerprint, must fall back.
 insert into public.account_appearance(user_id,settings,revision,last_request,last_payload) values(a,cfg,1,(p->>'requestId')::uuid,p);
 r:=public.appearance_request('{"op":"appearance-get"}');
 if r->'settings'->>'theme'<>'growth' or r->'settings'->>'mode'<>'dark' or (r->>'revision')::int<>2 then raise exception 'FALLBACK_FAILED';end if;
 perform pg_temp.must_reject(format('select public.appearance_request(%L::jsonb)',p),'THEME_FORBIDDEN');
 s:=public.habitify_request('{"op":"snapshot","timezone":"Australia/Sydney"}');
 p:=jsonb_build_object('op','create','name','综合测试喝水','kind','quantity','goal',8,'unit','杯','icon','water','day',s->>'today','revision',s->'revision','requestId',gen_random_uuid());
 s:=public.habitify_request(p);habit:=(s->'habits'->0->>'id')::uuid;
 p:=jsonb_build_object('op','progress','habitId',habit,'value',1,'day',s->>'today','revision',s->'revision','requestId',gen_random_uuid());s:=public.habitify_request(p);
 if (s->>'balance')::int<>0 or (s->>'actionDay')::boolean then raise exception 'PARTIAL_REWARD_FAILED';end if;
 p:=p||jsonb_build_object('value',8,'revision',s->'revision','requestId',gen_random_uuid());s:=public.habitify_request(p);
 if (s->>'balance')::int<>15 or not (s->>'actionDay')::boolean or public.habitify_request(p)<>s then raise exception 'COMPLETION_RETRY_FAILED';end if;
 perform pg_temp.must_reject(format('select public.habitify_request(%L::jsonb)',p||jsonb_build_object('requestId',gen_random_uuid(),'day','2000-01-01')),'TODAY_CHANGED');
 r:=public.admin_member_coins(admin,hash,gen_random_uuid(),a,155,15,'回滚综合测试');
 s:=public.habitify_request('{"op":"snapshot","timezone":"Australia/Sydney"}');
 p:=jsonb_build_object('op','reward-purchase','productId','snack','expectedPrice',155,'day',s->>'today','revision',s->'revision','requestId',gen_random_uuid(),'timezone','Australia/Sydney');
 r:=public.reward_request(p);if (r->>'balance')::int<>0 or jsonb_array_length(r->'purchases')<>1 or public.reward_request(p)<>r then raise exception 'REDEMPTION_FAILED';end if;
 perform pg_temp.must_reject(format('select public.reward_request(%L::jsonb)',p||jsonb_build_object('requestId',gen_random_uuid(),'revision',r->'revision')),'INSUFFICIENT_COINS');
 s:=public.habitify_request(jsonb_build_object('op','progress','habitId',habit,'value',0,'day',r->>'today','revision',r->'revision','requestId',gen_random_uuid()));
 if (s->>'balance')::int<>-15 or jsonb_array_length(s->'purchases')<>1 then raise exception 'SPENT_REWARD_REVOCATION_FAILED';end if;
 s:=public.habitify_request(jsonb_build_object('op','progress','habitId',habit,'value',8,'day',s->>'today','revision',s->'revision','requestId',gen_random_uuid()));
 if (s->>'balance')::int<>0 then raise exception 'RECOMPLETION_FAILED';end if;
 s:=public.habitify_request(jsonb_build_object('op','archive','habitId',habit,'archived',true,'day',s->>'today','revision',s->'revision','requestId',gen_random_uuid()));
 if not exists(select 1 from public.habit_plan_events where habit_id=habit and day=(s->>'today')::date+1 and not active) then raise exception 'ARCHIVE_PLAN_FAILED';end if;
 r:=public.admin_member_statistics(admin,hash,a);if jsonb_array_length(r->'snapshot'->'records')<>1 then raise exception 'ADMIN_STATS_FAILED';end if;
 perform pg_temp.test_identity(b);r:=public.habitify_request('{"op":"snapshot","timezone":"Australia/Sydney"}');
 if (r->>'balance')::int<>0 or jsonb_array_length(r->'habits')<>0 or jsonb_array_length(r->'purchases')<>0 then raise exception 'ACCOUNT_ISOLATION_FAILED';end if;
 perform pg_temp.must_reject(format('select public.habitify_request(%L::jsonb)',jsonb_build_object('op','progress','habitId',habit,'value',1,'day',r->>'today','revision',r->'revision','requestId',gen_random_uuid())),'HABIT_NOT_FOUND');
 ann:=public.admin_announcements(admin,hash,jsonb_build_object('op','announcement-save','id',null,'expectedRevision',0,'requestId',gen_random_uuid(),'title','回滚持续公告','body','## 回滚公告','audience','all','recipientId',null,'continuous',true));announcement:=(ann->>'id')::uuid;
 ann:=public.admin_announcements(admin,hash,jsonb_build_object('op','announcement-publish','id',announcement,'expectedRevision',ann->'revision','requestId',gen_random_uuid()));
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values(c,'regression-new-'||c||'@example.invalid',now(),now(),now());
 if not exists(select 1 from habitify_messages.deliveries where user_id=c and announcement_id=announcement) then raise exception 'CONTINUOUS_DELIVERY_FAILED';end if;
 select id into message from habitify_messages.deliveries where user_id=a and announcement_id=announcement;
 perform pg_temp.must_reject(format('select public.inbox_request(%L::jsonb)',jsonb_build_object('op','inbox-open','id',message)),'MESSAGE_NOT_FOUND');
 perform pg_temp.test_identity(a);r:=public.inbox_request(jsonb_build_object('op','inbox-open','id',message));
 if r->'message'->>'read_at' is null then raise exception 'READ_FAILED';end if;
 perform public.inbox_request(jsonb_build_object('op','inbox-trash','id',message));perform public.inbox_request(jsonb_build_object('op','inbox-restore','id',message));
 ann:=public.admin_announcements(admin,hash,jsonb_build_object('op','announcement-stop','id',announcement,'expectedRevision',ann->'revision','requestId',gen_random_uuid()));
 ann:=public.admin_announcements(admin,hash,jsonb_build_object('op','announcement-withdraw','id',announcement,'expectedRevision',ann->'revision','requestId',gen_random_uuid()));
 r:=public.inbox_request(jsonb_build_object('op','inbox-open','id',message));if r->'message'->>'body' is not null or r->'message'->>'status'<>'withdrawn' then raise exception 'WITHDRAW_FAILED';end if;
 feedback:=public.feedback_request(jsonb_build_object('op','feedback-submit','category','bug','title','回滚综合反馈','body','纯文字测试','requestId',gen_random_uuid()));
 feedback:=public.admin_feedback(admin,hash,jsonb_build_object('op','feedback-admin-get','id',feedback->>'id'));
 r:=public.admin_feedback(admin,hash,jsonb_build_object('op','feedback-reply','id',feedback->>'id','expectedRevision',feedback->'revision','requestId',gen_random_uuid(),'body','已记录'));
 if not exists(select 1 from habitify_messages.deliveries where user_id=a and feedback_reply_id is not null) then raise exception 'FEEDBACK_REPLY_FAILED';end if;
 if to_regprocedure('public.feedback_mail_claim(integer)') is not null or exists(select 1 from habitify_feedback.mail_tasks where feedback_id=(feedback->>'id')::uuid) then raise exception 'MAIL_REMOVAL_FAILED';end if;
 perform public.inbox_request('{"op":"inbox-read-all"}');if (public.inbox_request('{"op":"inbox-count"}')->>'unread')::int<>0 then raise exception 'READ_ALL_FAILED';end if;
 -- Management creation/password/deletion journal; Auth side-effects stay synthetic.
 request:=gen_random_uuid();execution:=gen_random_uuid();job:=public.admin_member_write_begin(admin,hash,request,repeat('b',64),execution,'member-create',null,'regression-created-'||request||'@example.invalid','');
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values((job->>'targetId')::uuid,'regression-created-'||request||'@example.invalid',now(),now(),now());
 perform public.admin_member_write_finish(admin,request,execution,true,null);
 request:=gen_random_uuid();execution:=gen_random_uuid();perform public.admin_member_write_begin(admin,hash,request,repeat('b',64),execution,'member-password',a,'','');
 perform pg_temp.must_reject('select public.appearance_request(''{"op":"appearance-get"}'')','LOGIN_REQUIRED');perform public.admin_member_write_finish(admin,request,execution,true,null);
 perform pg_temp.test_identity(a);
 s:=public.habitify_request('{"op":"snapshot","timezone":"Australia/Sydney"}');
 perform pg_temp.must_reject(format('select public.habitify_request(%L::jsonb)',jsonb_build_object('op','delete','habitId',habit,'confirmationName','错误名称','day',s->>'today','revision',s->'revision','requestId',gen_random_uuid())),'DELETE_CONFIRMATION_REQUIRED');
 request:=gen_random_uuid();execution:=gen_random_uuid();perform public.admin_member_write_begin(admin,hash,request,repeat('b',64),execution,'member-delete',a,'','regression-a-'||a||'@example.invalid');
 delete from auth.users where id=a;perform public.admin_member_write_finish(admin,request,execution,true,null);
 if exists(select 1 from public.habits where user_id=a) or exists(select 1 from public.coin_ledger where user_id=a) or exists(select 1 from public.reward_purchases where user_id=a) or exists(select 1 from public.account_appearance where user_id=a) or exists(select 1 from habitify_messages.deliveries where user_id=a) or exists(select 1 from habitify_feedback.entries where user_id=a) then raise exception 'DELETE_CASCADE_FAILED';end if;
end $$;
rollback;
select 'PASS: theme permissions/fallback, check-ins/coins, redemption, isolation, statistics, announcements/inbox, feedback, member management/cascade; all rolled back' as verification;
