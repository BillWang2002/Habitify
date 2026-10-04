import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
let db;
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
before(async()=> {
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${a}'),('${b}');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610040002_habits.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610040003_statistics.sql',import.meta.url),'utf8'));
});
after(async()=>db?.close());
async function rpc(p, uid=a) {
 await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);
 await db.exec('set role authenticated');
 try { return (await db.query('select public.habitify_request($1::jsonb) as data',[JSON.stringify(p)])).rows[0].data; }
 finally { await db.exec('reset role'); }
}
const snap=(uid=a)=>rpc({op:'snapshot',timezone:'Australia/Sydney'},uid);
async function act(values,uid=a) { const s=await snap(uid);return rpc({...values,day:s.today,revision:s.revision,requestId:randomUUID()},uid); }
const create=(name='读书',more={})=>act({op:'create',name,kind:'complete',goal:1,unit:'次',icon:'book',note:'',...more});
test('真实SQL：空账户、独立账户与禁止直接读写/私有RPC',async()=> {
 assert.deepEqual((await snap()).habits,[]);
 const s=await create(); assert.equal(s.balance,0); assert.equal((await snap(b)).habits.length,0);
 await assert.rejects(act({op:'progress',habitId:s.habits[0].id,value:1},b),/HABIT_NOT_FOUND/);
 await db.exec('set role authenticated');
 try { await assert.rejects(db.query('select * from public.habits'),/permission denied/);await assert.rejects(db.query('select public.habit_snapshot($1,current_date)',[b]),/permission denied/); }
 finally { await db.exec('reset role'); }
 await db.exec('set role anon');
 try { await assert.rejects(db.query(`select public.habitify_request('{"op":"snapshot"}')`),/permission denied/); }
 finally { await db.exec('reset role'); }
});
test('真实SQL：数量部分进度、达标发15、重试不重复、撤回与恢复',async()=> {
 let s=await create('喝水',{kind:'quantity',goal:8,unit:'杯',icon:'water'}); const id=s.habits.at(-1).id;
 s=await act({op:'progress',habitId:id,value:1});assert.equal(s.balance,0);assert.equal(s.actionDay,false);
 const p={op:'progress',habitId:id,value:8,day:s.today,revision:s.revision,requestId:randomUUID()};
 s=await rpc(p); assert.equal(s.balance,15); assert.equal(s.actionDay,true);
 assert.equal((await rpc(p)).balance,15);
 await assert.rejects(rpc({...p,value:7}),/REQUEST_REUSED/);
 s=await act({op:'progress',habitId:id,value:0});assert.equal(s.balance,0);assert.equal(s.actionDay,false);
 s=await act({op:'progress',habitId:id,value:8});assert.equal(s.balance,15);
 assert.equal((await db.query('select sum(delta)::integer as total from public.coin_ledger where user_id=$1',[a])).rows[0].total,15);
});
test('真实SQL：50上限含首次5、归档保留、删除清当日且8秒恢复',async()=> {
 for(let i=0;i<5;i++) { const s=await create(`行动${i}`);await act({op:'progress',habitId:s.habits.at(-1).id,value:1}); }
 let s=await snap(); assert.equal(s.balance,50); const id=s.habits.find(h=>h.name==='喝水').id;
 s=await act({op:'archive',habitId:id,archived:true});assert.equal(s.balance,50);assert.equal(s.actionDay,true);
 await assert.rejects(act({op:'progress',habitId:id,value:0}),/HABIT_ARCHIVED/);
 const active=s.habits.find(h=>h.name==='行动4').id;
 s=await act({op:'delete',habitId:active}); assert.equal(s.balance,50); assert.equal(s.habits.some(h=>h.id===active),false);
 s=await act({op:'restore',habitId:active}); assert.equal(s.habits.find(h=>h.id===active).progress,1);
 await act({op:'delete',habitId:active});
 await db.query(`update public.habits set deleted_at=now()-interval '9 seconds' where id=$1`,[active]);
 await assert.rejects(act({op:'restore',habitId:active}),/RESTORE_EXPIRED/);
});
test('真实SQL：跨日拒绝、冲突拒绝、无效输入事务回滚、不接受伪造金币',async()=> {
 let s=await snap();const id=s.habits.find(h=>!h.archived).id;
 await assert.rejects(rpc({op:'progress',habitId:id,value:1,day:'2000-01-01',revision:s.revision,requestId:randomUUID()}),/TODAY_CHANGED/);
 await assert.rejects(rpc({op:'progress',habitId:id,value:1,day:s.today,revision:s.revision-1,requestId:randomUUID()}),/STALE_DATA/);
 await assert.rejects(act({op:'progress',habitId:id,value:-1}),/INVALID_PROGRESS/);
 assert.equal((await snap()).revision,s.revision);
 s=await act({op:'progress',habitId:id,value:0,balance:100000,user_id:b});assert.ok(s.balance<=50);
 await assert.rejects(rpc({timezone:'Australia/Sydney'}),/INVALID_REQUEST/);
});
test('真实SQL：连续210日同时结算7日和30日，撤销再达标净收益不变',async()=> {
 let s=await act({op:'create',name:'连续测试',kind:'complete',icon:'leaf'},b);const id=s.habits[0].id;
 await db.query(`insert into public.habit_records(habit_id,user_id,day,goal,progress,completed_at)
 select $1,$2,$3::date-i,1,1,now() from generate_series(1,209) i`,[id,b,s.today]);
 s=await act({op:'progress',habitId:id,value:1},b);assert.equal(s.todayCoins,215);assert.equal(s.balance,215);
 s=await act({op:'progress',habitId:id,value:0},b);assert.equal(s.balance,0);
 s=await act({op:'progress',habitId:id,value:1},b);assert.equal(s.balance,215);
 await db.query(`delete from public.habit_records where user_id=$1 and day=$2::date-1`,[b,s.today]);
 s=await act({op:'progress',habitId:id,value:1},b);assert.equal(s.balance,15);
});
