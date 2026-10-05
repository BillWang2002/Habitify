import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
const hash=s=>createHash('sha256').update(s).digest('hex');
test('后台SQL：角色绑定、限流、会话隔离/过期/撤销及直接客户端拒绝',async()=>{
 const db=new PGlite(),admin=randomUUID(),a=randomUUID(),b=randomUUID();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);`);
  await db.query('insert into auth.users values($1,$2,now(),null),($3,$4,now(),null),($5,$6,now(),null)',[admin,'admin@example.test',a,'a@example.test',b,'b@example.test']);
  await db.exec(await readFile(new URL('../supabase/migrations/202610050005_admin_sessions.sql',import.meta.url),'utf8'));
  const rpc=async(sql,args=[])=>{await db.exec('set role service_role');try{return(await db.query(sql,args)).rows[0]?.data;}finally{await db.exec('reset role');}};
  assert.equal((await rpc('select public.admin_login_attempt($1) as data',[a])).code,'ADMIN_NOT_CONFIGURED');
  await db.query('insert into habitify_admin.principals(user_id,expected_email) values($1,$2)',[admin,'admin@example.test']);
  for(let i=0;i<5;i++)assert.equal((await rpc('select public.admin_login_attempt($1) as data',[a])).adminId,admin);
  assert.equal((await rpc('select public.admin_login_attempt($1) as data',[a])).code,'ADMIN_RATE_LIMITED');
  assert.equal((await rpc('select public.admin_login_attempt($1) as data',[b])).adminId,admin);
  await db.exec("update habitify_admin.attempts set window_start=now()-interval '16 minutes'");
  assert.equal((await rpc('select public.admin_login_attempt($1) as data',[a])).adminId,admin);
  await assert.rejects(rpc('select public.admin_session_open($1,$2,$3) as data',[a,b,hash('wrong')]),/ADMIN_FORBIDDEN/);
  const h=hash('token1'),next=hash('token2');
  const opened=await rpc('select public.admin_session_open($1,$2,$3) as data',[a,admin,h]);assert.ok(Date.parse(opened.expiresAt)>Date.now());
  assert.equal((await rpc('select public.admin_session_check($1,$2) as data',[a,h])).expiresAt,opened.expiresAt);
  await assert.rejects(rpc('select public.admin_session_check($1,$2) as data',[b,h]),/ADMIN_SESSION_EXPIRED/);
  await db.exec('update habitify_admin.principals set enabled=false');await assert.rejects(rpc('select public.admin_session_check($1,$2) as data',[a,h]),/ADMIN_FORBIDDEN/);
  await db.exec('update habitify_admin.principals set enabled=true');
  await db.query('update auth.users set email=$2 where id=$1',[admin,'changed@example.test']);await assert.rejects(rpc('select public.admin_session_check($1,$2) as data',[a,h]),/ADMIN_FORBIDDEN/);
  await db.query('update auth.users set email=$2 where id=$1',[admin,'admin@example.test']);
  await rpc('select public.admin_session_open($1,$2,$3) as data',[a,admin,next]);await assert.rejects(rpc('select public.admin_session_check($1,$2) as data',[a,h]),/ADMIN_SESSION_EXPIRED/);
  await rpc('select public.admin_session_close($1,$2) as data',[b,next]);assert.ok(await rpc('select public.admin_session_check($1,$2) as data',[a,next]));
  await rpc('select public.admin_session_close($1,$2) as data',[a,next]);await assert.rejects(rpc('select public.admin_session_check($1,$2) as data',[a,next]),/ADMIN_SESSION_EXPIRED/);
  const expired=hash('expired');await rpc('select public.admin_session_open($1,$2,$3) as data',[a,admin,expired]);await db.query("update habitify_admin.sessions set created_at=now()-interval '1 hour',expires_at=now()-interval '1 minute' where token_hash=$1",[expired]);await assert.rejects(rpc('select public.admin_session_check($1,$2) as data',[a,expired]),/ADMIN_SESSION_EXPIRED/);
  for(const role of ['anon','authenticated']) {await db.exec('set role '+role);try{await assert.rejects(db.query('select * from habitify_admin.principals'),/permission denied/);await assert.rejects(db.query('select public.admin_login_attempt($1)',[a]),/permission denied/);await assert.rejects(db.query('select public.admin_session_check($1,$2)',[a,h]),/permission denied/);await assert.rejects(db.query('select habitify_admin.identity()'),/permission denied/);}finally{await db.exec('reset role');}}
  const records=(await db.query('select * from habitify_admin.sessions')).rows;assert.ok(records.every(s=>/^[a-f0-9]{64}$/.test(s.token_hash)));assert.equal(records.some(s=>'password' in s),false);
  assert.ok((await db.query("select * from habitify_admin.audit where operation='login_success'")).rows.length>0);
 }finally{await db.close();}
});
