import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
test('真实SQL：删除名称确认、本人权限、幂等及禁止8秒恢复',async()=>{
 const db=new PGlite(),uid=randomUUID(),other=randomUUID();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${uid}'),('${other}');`);
 for(const file of ['202610040002_habits.sql','202610040003_statistics.sql','202610040004_delete_confirmation.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 async function rpc(p,user=uid){await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user]);await db.exec('set role authenticated');try{return(await db.query('select public.habitify_request($1::jsonb) as data',[JSON.stringify({timezone:"Australia/Sydney",...p})])).rows[0].data;}finally{await db.exec('reset role');}}
 async function act(p){const s=await rpc({op:'snapshot'});return rpc({...p,day:s.today,revision:s.revision,requestId:randomUUID()});}
 let s=await act({op:'create',name:'喝水',kind:'quantity',goal:8,unit:'杯',icon:'water',note:''});const id=s.habits[0].id;s=await act({op:'progress',habitId:id,value:8});assert.equal(s.balance,15);
 for(const confirmationName of [undefined,'','喝','喝水 '])await assert.rejects(act({op:'delete',habitId:id,confirmationName}),/DELETE_CONFIRMATION_REQUIRED/);
 assert.equal((await rpc({op:'snapshot'})).balance,15);
 await assert.rejects(rpc({op:'delete',habitId:id,confirmationName:'喝水'},other),/HABIT_NOT_FOUND/);
 const p={op:'delete',habitId:id,confirmationName:'喝水',day:s.today,revision:s.revision,requestId:randomUUID()};s=await rpc(p);assert.equal(s.balance,0);assert.equal(s.habits.length,0);assert.equal(s.statistics.habits[0].deleted,true);assert.equal(s.statistics.plans.at(-1).active,false);assert.ok(s.statistics.plans.at(-1).day>s.today);assert.equal((await rpc(p)).balance,0);
 await assert.rejects(act({op:'restore',habitId:id}),/INVALID_REQUEST/);
 await db.exec('set role authenticated');try{await assert.rejects(db.query(`select public.habitify_request_core('{"op":"restore"}')`),/permission denied/);}finally{await db.exec('reset role');}
 await db.exec('set role anon');try{await assert.rejects(db.query(`select public.habitify_request('{"op":"snapshot"}')`),/permission denied/);}finally{await db.exec('reset role');}
 }finally{await db.close();}
});
