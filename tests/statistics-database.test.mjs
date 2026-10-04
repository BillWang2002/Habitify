import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
const uid='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
test('统计迁移还原历史归档；真实RPC追踪归档/恢复/删除且权限不扩大',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;insert into auth.users values('${uid}'),('${other}');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610040002_habits.sql',import.meta.url),'utf8'));
 const id=randomUUID();
 await db.query(`insert into public.habit_profiles(user_id,timezone) values($1,'Australia/Sydney'),($2,'Australia/Sydney')`,[uid,other]);
 await db.query(`insert into public.habits(id,user_id,name,kind,goal,unit,icon,position,start_day) values($1,$2,'历史','complete',1,'次','leaf',0,'2026-09-01')`,[id,uid]);
 for(const [day,op,archived,rev] of [['2026-09-03','archive',true,1],['2026-09-05','archive',false,2],['2026-09-05','delete',null,3],['2026-09-05','restore',null,4]]) {
 await db.query(`insert into public.habit_requests(user_id,id,payload,created_at) values($1,$2,$3,$4)`,[uid,randomUUID(),JSON.stringify({habitId:id,day,op,archived,revision:rev}),`${day}T12:00:00Z`]);
 }
 await db.exec(await readFile(new URL('../supabase/migrations/202610040003_statistics.sql',import.meta.url),'utf8'));
 let plans=(await db.query('select day::text,active from public.habit_plan_events where habit_id=$1 order by day',[id])).rows;
 assert.deepEqual(plans,[{day:'2026-09-01',active:true},{day:'2026-09-04',active:false},{day:'2026-09-05',active:true}]);
 async function rpc(p,user=uid){await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user]);await db.exec('set role authenticated');try{return (await db.query('select public.habitify_request($1::jsonb) as data',[JSON.stringify(p)])).rows[0].data;}finally{await db.exec('reset role');}}
 async function act(p){const s=await rpc({op:'snapshot'});return rpc({...p,day:s.today,revision:s.revision,requestId:randomUUID()});}
 let s=await rpc({op:'snapshot'});const today=s.today;assert.equal(s.statistics.habits.length,1);assert.equal((await rpc({op:'snapshot'},other)).statistics.habits.length,0);
 s=await act({op:'archive',habitId:id,archived:true});assert.equal(s.statistics.plans.at(-1).active,false);assert.ok(s.statistics.plans.at(-1).day>today);
 s=await act({op:'archive',habitId:id,archived:false});assert.equal(s.statistics.plans.at(-1).day,today);assert.equal(s.statistics.plans.at(-1).active,true);
 s=await act({op:'progress',habitId:id,value:1});const count=s.statistics.plans.length;
 s=await act({op:'archive',habitId:id,archived:true});s=await act({op:'delete',habitId:id});assert.equal(s.habits.length,0);assert.equal(s.statistics.habits[0].deleted,true);
 s=await act({op:'restore',habitId:id});assert.equal(s.statistics.plans.at(-1).active,false);assert.equal(s.statistics.habits[0].archived,true);assert.equal(s.statistics.plans.length,count+1);
 await db.exec('set role authenticated');try {await assert.rejects(db.query('select * from public.habit_plan_events'),/permission denied/);await assert.rejects(db.query('select public.habit_statistics_data($1)',[other]),/permission denied/);}finally{await db.exec('reset role');}
 await assert.rejects(db.query("update public.habits set kind='quantity',goal=2 where id=$1",[id]),/PLAN_EDIT_NOT_SUPPORTED/);
 } finally{await db.close();}
});
