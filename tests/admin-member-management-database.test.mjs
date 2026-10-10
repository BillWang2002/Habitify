import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
test('成员管理SQL：权限、操作幂等、密码旧会话、金币与打卡共存、永久删除级联及审计',async()=>{
 const db=new PGlite(),admin=randomUUID(),member=randomUUID(),other=randomUUID(),grant='a'.repeat(64),fingerprint='b'.repeat(64);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('iat',nullif(current_setting('request.jwt.claim.iat',true),'')::bigint)$$;grant usage on schema auth to anon,authenticated;`);
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,now())',[admin,'admin@example.test',member,'member@example.test',other,'other@example.test']);
 for(const file of ['202610030001_infrastructure.sql','202610040002_habits.sql','202610040003_statistics.sql','202610040004_delete_confirmation.sql','202610050005_admin_sessions.sql','202610050006_admin_members.sql','202610100007_admin_identity.sql','202610100008_admin_member_management.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query("insert into habitify_admin.principals(user_id,expected_email) values($1,'admin@example.test')",[admin]);
 async function rpc(sql,args){await db.exec('set role service_role');try{return(await db.query(sql,args)).rows[0]?.data;}finally{await db.exec('reset role');}}
 await rpc('select public.admin_session_open($1,$2,$3) as data',[admin,admin,grant]);
 const begin=(op,id,request=randomUUID(),execution=randomUUID(),email='',confirm='',fp=fingerprint)=>rpc('select public.admin_member_write_begin($1,$2,$3,$4,$5,$6,$7,$8,$9) as data',[admin,grant,request,fp,execution,op,id,email,confirm]);
 const finish=(request,execution,success=true,error=null)=>rpc('select public.admin_member_write_finish($1,$2,$3,$4,$5) as data',[admin,request,execution,success,error]);
 const coin=(request,balance,expected,reason='测试调整',id=member)=>rpc('select public.admin_member_coins($1,$2,$3,$4,$5,$6,$7) as data',[admin,grant,request,id,balance,expected,reason]);
 await assert.rejects(begin('member-password',admin),/ADMIN_FORBIDDEN/);await assert.rejects(begin('member-delete',member,randomUUID(),randomUUID(),'','wrong'),/DELETE_CONFIRMATION_REQUIRED/);
 await assert.rejects(coin(randomUUID(),50,0,'',member),/INVALID_REQUEST/);await assert.rejects(coin(randomUUID(),50,0,'reason',admin),/ADMIN_FORBIDDEN/);
 // Auth creation is simulated outside the transaction; journal retries reuse one target ID.
 const createId=randomUUID(),exec=randomUUID(),job=await begin('member-create',null,createId,exec,'new@example.test');
 await assert.rejects(begin('member-create',null,createId,randomUUID(),'new@example.test'),/ADMIN_WRITE_BUSY/);
 await assert.rejects(begin('member-create',null,createId,randomUUID(),'new@example.test','','c'.repeat(64)),/REQUEST_REUSED/);
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[job.targetId,'new@example.test']);
 assert.equal((await finish(createId,exec)).completed,true);assert.equal((await begin('member-create',null,createId,randomUUID(),'new@example.test')).result.memberId,job.targetId);
 await assert.rejects(begin('member-create',null,randomUUID(),randomUUID(),'NEW@example.test'),/MEMBER_EXISTS/);
 async function user(p,iat=1,uid=member){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.iat',$2,false)",[uid,String(iat)]);await db.exec('set role authenticated');try{return(await db.query('select public.habitify_request($1::jsonb) as data',[JSON.stringify(p)])).rows[0].data;}finally{await db.exec('reset role');}}
 let s=await user({op:'snapshot',timezone:'UTC'});s=await user({op:'create',name:'喝水',kind:'complete',icon:'water',requestId:randomUUID(),day:s.today,revision:s.revision});const habit=s.habits[0].id;
 s=await user({op:'progress',habitId:habit,value:1,requestId:randomUUID(),day:s.today,revision:s.revision});assert.equal(s.balance,15);
 const coinId=randomUUID();assert.equal((await coin(coinId,100,15)).balance,100);assert.equal((await coin(coinId,100,15)).balance,100);await assert.rejects(coin(coinId,101,15),/REQUEST_REUSED/);await assert.rejects(coin(randomUUID(),50,15),/BALANCE_CHANGED/);
 s=await user({op:'snapshot',timezone:'UTC'});s=await user({op:'progress',habitId:habit,value:0,requestId:randomUUID(),day:s.today,revision:s.revision});assert.equal(s.balance,85);
 s=await user({op:'progress',habitId:habit,value:1,requestId:randomUUID(),day:s.today,revision:s.revision});assert.equal(s.balance,100);assert.equal((await db.query("select count(*)::int as n from public.coin_ledger where node like 'admin:%'")).rows[0].n,1);
 const passId=randomUUID(),passExec=randomUUID();await begin('member-password',member,passId,passExec);await assert.rejects(user({op:'snapshot',timezone:'UTC'}),/LOGIN_REQUIRED/);
 await assert.rejects(coin(randomUUID(),60,100),/ADMIN_WRITE_BUSY/);await assert.rejects(begin('member-delete',member,randomUUID(),randomUUID(),'','member@example.test'),/ADMIN_WRITE_BUSY/);
 await finish(passId,passExec);await assert.rejects(user({op:'snapshot',timezone:'UTC'}),/LOGIN_REQUIRED/);assert.equal((await user({op:'snapshot',timezone:'UTC'},Math.floor(Date.now()/1000)+2)).balance,100);
 await db.query('insert into public.infra_probes(id,user_id) values($1,$2)',[randomUUID(),member]);await db.query("select set_config('request.jwt.claim.iat','1',false)");await db.exec('set role authenticated');assert.equal((await db.query('select * from public.infra_probes')).rows.length,0);await db.exec('reset role');
 const deletion=randomUUID(),delExec=randomUUID();await begin('member-delete',member,deletion,delExec,'','member@example.test');await assert.rejects(finish(deletion,delExec),/ADMIN_WRITE_PENDING/);
 await db.query('delete from auth.users where id=$1',[member]);assert.equal((await finish(deletion,delExec)).completed,true);
 for(const table of ['habit_profiles','habits','habit_records','habit_logs','coin_ledger','coin_entitlements','habit_requests','habit_plan_events','infra_probes'])assert.equal((await db.query('select count(*)::int as n from public.'+table+' where user_id=$1',[member])).rows[0].n,0,table);
 assert.equal((await db.query("select count(*)::int as n from habitify_admin.audit where operation='member-delete_success'")).rows[0].n,1);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from habitify_admin.member_requests'),/permission denied/);await assert.rejects(db.query('select public.admin_member_pending($1,$2)',[admin,grant]),/permission denied/);await assert.rejects(db.query('select public.admin_member_coins($1,$2,$3,$4,20,0,\'x\')',[admin,grant,randomUUID(),other]),/permission denied/);await db.exec('reset role');}
 await db.exec('update habitify_admin.principals set enabled=false');await assert.rejects(begin('member-password',other),/ADMIN_FORBIDDEN/);
 }finally{await db.close();}
});
