import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('反馈SQL：本人隔离、一次提交/限流、回复事务、邮件移除/历史兼容、删除级联',async()=>{
 const db=new PGlite(),admin=randomUUID(),a=randomUUID(),b=randomUUID(),hash='a'.repeat(64);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('iat',nullif(current_setting('request.jwt.claim.iat',true),'')::bigint)$$;grant usage on schema auth to anon,authenticated;`);
  for(const f of ['202610030001_infrastructure.sql','202610040002_habits.sql','202610040003_statistics.sql','202610040004_delete_confirmation.sql','202610050005_admin_sessions.sql','202610050006_admin_members.sql','202610100007_admin_identity.sql','202610100008_admin_member_management.sql','202610120011_announcements.sql','202610120012_feedback.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  for(const id of [admin,a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@test.example']);
  await db.query('insert into habitify_admin.principals(user_id,expected_email) values($1,$2)',[admin,admin+'@test.example']);await db.query('select public.admin_session_open($1,$1,$2)',[admin,hash]);
  const legacy=(await db.query("insert into habitify_feedback.entries(user_id,category,title,body) values($1,'other','旧反馈','历史正文') returning id",[b])).rows[0].id;
  await db.query('insert into habitify_feedback.mail_tasks(feedback_id) values($1)',[legacy]);
  await db.exec(await readFile(new URL('../supabase/migrations/202610120013_remove_feedback_email.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select count(*)::int n from habitify_feedback.mail_tasks where feedback_id=$1',[legacy])).rows[0].n,1);
  assert.equal((await db.query('select body from habitify_feedback.entries where id=$1',[legacy])).rows[0].body,'历史正文');
  async function user(p,uid=a,fn='feedback_request'){
   await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.iat','100',false)",[uid]);await db.exec('set role authenticated');
   try{return(await db.query(`select public.${fn}($1::jsonb) as data`,[JSON.stringify(p)])).rows[0].data;}finally{await db.exec('reset role');}
  }
  async function manage(p){await db.exec('set role service_role');try{return(await db.query('select public.admin_feedback($1,$2,$3::jsonb) as data',[admin,hash,JSON.stringify(p)])).rows[0].data;}finally{await db.exec('reset role');}}
  const input={op:'feedback-submit',requestId:randomUUID(),category:'bug',title:'页面问题',body:'<script>不会执行</script>'};
  const submitted=await user(input);assert.deepEqual(await user(input),submitted);
  assert.equal((await user({op:'feedback-list',page:1})).total,1);assert.equal((await user({op:'feedback-list',page:1},b)).total,1);
  await assert.rejects(user(input,b),/REQUEST_REUSED/);await assert.rejects(user({...input,body:'changed'}),/REQUEST_REUSED/);
  await assert.rejects(user({...input,requestId:randomUUID()}),/FEEDBACK_RATE_LIMITED/);
  await db.query("update habitify_feedback.entries set created_at=now()-interval '2 minutes' where id=$1",[submitted.id]);
  for(let i=0;i<4;i++)await db.query("insert into habitify_feedback.entries(user_id,category,title,body,created_at) values($1,'other','limit','limit',now()-interval '2 minutes')",[a]);
  await assert.rejects(user({...input,requestId:randomUUID()}),/FEEDBACK_RATE_LIMITED/);
  await assert.rejects(user({op:'feedback-get',id:submitted.id},b),/FEEDBACK_NOT_FOUND/);
  await assert.rejects(user({...input,requestId:randomUUID(),userId:b}),/INVALID_REQUEST/);
  await assert.rejects(user({op:'feedback-update',id:submitted.id,status:'resolved'}),/INVALID_REQUEST/);
  let row=await manage({op:'feedback-admin-get',id:submitted.id});
  assert.equal((await manage({op:'feedback-admin-list',page:1,status:'all',search:'页面'})).total,1);
  assert.equal((await manage({op:'feedback-admin-list',page:1,status:'all',search:'%'})).total,0);
  const update={op:'feedback-update',id:row.id,expectedRevision:row.revision,requestId:randomUUID(),status:'processing',reason:'',note:'内部备注'};
  const saved=await manage(update);assert.deepEqual(await manage(update),saved);
  await assert.rejects(manage({...update,requestId:randomUUID()}),/STALE_DATA/);
  const own=await user({op:'feedback-get',id:row.id});assert.equal(own.internal_note,undefined);assert.equal(own.user_id,undefined);assert.equal(own.status,'processing');
  await assert.rejects(manage({...update,expectedRevision:saved.revision,requestId:randomUUID(),status:'closed'}),/CLOSE_REASON_REQUIRED/);
  const reply={op:'feedback-reply',id:row.id,expectedRevision:saved.revision,requestId:randomUUID(),body:'已修复，感谢反馈。'};
  const replied=await manage(reply);assert.deepEqual(await manage(reply),replied);
  assert.equal((await user({op:'feedback-get',id:row.id})).replies.length,1);
  let inbox=await user({op:'inbox-list',page:1,view:'inbox'},a,'inbox_request');assert.equal(inbox.unread,1);assert.equal(inbox.items[0].kind,'feedback-reply');
  const msg=inbox.items[0].id;assert.equal((await user({op:'inbox-count'},b,'inbox_request')).unread,0);
  await assert.rejects(user({op:'inbox-open',id:msg},b,'inbox_request'),/MESSAGE_NOT_FOUND/);
  assert.equal((await user({op:'inbox-open',id:msg},a,'inbox_request')).message.body,reply.body);
  await user({op:'inbox-trash',id:msg},a,'inbox_request');assert.equal((await user({op:'feedback-get',id:row.id})).replies.length,1);await user({op:'inbox-restore',id:msg},a,'inbox_request');
  // Announcement behavior still works in the new mixed inbox.
  let ann=(await db.query('select public.admin_announcements($1,$2,$3::jsonb) data',[admin,hash,JSON.stringify({op:'announcement-save',id:null,expectedRevision:0,requestId:randomUUID(),title:'公告',body:'正文',audience:'all',recipientId:null,continuous:false})])).rows[0].data;
  await db.query('select public.admin_announcements($1,$2,$3::jsonb)',[admin,hash,JSON.stringify({op:'announcement-publish',id:ann.id,expectedRevision:ann.revision,requestId:randomUUID()})]);
  inbox=await user({op:'inbox-list',page:1,view:'inbox'},a,'inbox_request');assert.equal(inbox.total,2);assert.equal(inbox.unread,1);await user({op:'inbox-read-all'},a,'inbox_request');assert.equal((await user({op:'inbox-count'},a,'inbox_request')).unread,0);
  assert.equal((await db.query('select count(*)::int n from habitify_feedback.mail_tasks')).rows[0].n,1);
  assert.equal((await manage({op:'feedback-admin-get',id:row.id})).mail,undefined);
  const list=await manage({op:'feedback-admin-list',page:1,status:'all',search:'页面'});
  assert.equal(list.items.length,1);assert.equal(list.items[0].mail_state,undefined);
  await assert.rejects(manage({op:'feedback-mail-retry',id:row.id,requestId:randomUUID(),expectedRevision:replied.revision,confirmUncertain:true}),/INVALID_REQUEST/);
  assert.equal((await db.query("select to_regprocedure('public.feedback_mail_claim(integer)') a,to_regprocedure('public.feedback_mail_finish(uuid,uuid,text,text)') b")).rows[0].a,null);
  assert.equal((await db.query("select to_regprocedure('public.feedback_mail_finish(uuid,uuid,text,text)') b")).rows[0].b,null);
  await manage({op:'feedback-update',id:row.id,requestId:randomUUID(),expectedRevision:replied.revision,status:'closed',reason:'已在新版处理',note:'管理员备注'});
  await db.exec('set role anon');await assert.rejects(db.query("select public.feedback_request('{\"op\":\"feedback-list\",\"page\":1}')"),/permission denied/);await db.exec('reset role');
  await db.exec('set role authenticated');for(const sql of ['select * from habitify_feedback.entries','select * from habitify_feedback.mail_tasks',"select public.admin_feedback(null,null,'{}')"])await assert.rejects(db.query(sql),/permission denied/);await db.exec('reset role');
  await db.query('insert into habitify_admin.member_access(user_id,revoked_before) values($1,100)',[a]);await assert.rejects(user({op:'feedback-list',page:1}),/LOGIN_REQUIRED/);
  await db.query('delete from auth.users where id=any($1::uuid[])',[[a,b]]);
  for(const table of ['entries','replies','history','requests','mail_tasks'])assert.equal((await db.query(`select count(*)::int n from habitify_feedback.${table}`)).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from habitify_messages.deliveries where feedback_reply_id is not null')).rows[0].n,0);
 }finally{await db.close();}
});
