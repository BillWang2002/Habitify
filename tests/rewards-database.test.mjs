import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('兑换SQL：可信价格、余额、幂等、请求冲突、失效会话、账户隔离与奖励撤回',async()=>{
 const db=new PGlite(),a=randomUUID(),b=randomUUID();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,created_at timestamptz default now(),updated_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('iat',nullif(current_setting('request.jwt.claim.iat',true),'')::bigint)$$;grant usage on schema auth to anon,authenticated;`);
 for(const f of ['202610030001_infrastructure.sql','202610040002_habits.sql','202610040003_statistics.sql','202610040004_delete_confirmation.sql','202610050005_admin_sessions.sql','202610050006_admin_members.sql','202610100007_admin_identity.sql','202610100008_admin_member_management.sql','202610130016_reward_redemption.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$3,now()),($2,$4,now())',[a,b,a+'@test.example',b+'@test.example']);
 async function rpc(p,uid=a,fn='reward_request',iat=100){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.iat',$2,false)",[uid,String(iat)]);await db.exec('set role authenticated');try{return(await db.query(`select public.${fn}($1::jsonb) as data`,[JSON.stringify(p)])).rows[0].data;}finally{await db.exec('reset role');}}
 const snap=uid=>rpc({op:'snapshot',timezone:'Australia/Sydney'},uid,'habitify_request',101);
 let s=await snap(a);assert.deepEqual(s.purchases,[]);assert.deepEqual(s.rewardCatalog.map(x=>[x.id,x.price]),[['coffee',310],['milk-tea',310],['snack',155]]);
 await snap(b);await db.query("insert into public.coin_ledger(user_id,node,day,delta,rule_version) values($1,'test-funding',current_date,500,1),($2,'test-funding',current_date,500,1)",[a,b]);
 s=await snap(a);const p={op:'reward-purchase',productId:'snack',expectedPrice:155,requestId:randomUUID(),day:s.today,revision:s.revision,timezone:'Australia/Sydney'};
 const bought=await rpc(p);assert.equal(bought.balance,345);assert.equal(bought.purchases.length,1);assert.equal(bought.purchaseId,bought.purchases[0].id);assert.equal((await snap(b)).purchases.length,0);
 assert.equal((await rpc(p)).balance,345);assert.equal((await rpc(p)).purchaseId,bought.purchaseId);
 await assert.rejects(rpc({...p,productId:'coffee',expectedPrice:310}),/REQUEST_REUSED/);
 await assert.rejects(rpc({...p,requestId:randomUUID(),revision:s.revision}),/STALE_DATA/);
 await assert.rejects(rpc({...p,op:'create',name:'reused',kind:'complete',icon:'leaf'},a,'habitify_request'),/REQUEST_REUSED/);
 s=await snap(a);await assert.rejects(rpc({...p,requestId:randomUUID(),revision:s.revision,expectedPrice:1}),/PRICE_CHANGED/);
 await assert.rejects(rpc({...p,requestId:randomUUID(),revision:s.revision,userId:b}),/INVALID_REQUEST/);
 await assert.rejects(rpc({...p,requestId:randomUUID(),revision:s.revision,productId:'missing'}),/PRODUCT_UNAVAILABLE/);
 await assert.rejects(rpc({...p,requestId:randomUUID(),revision:s.revision,day:'2000-01-01'}),/TODAY_CHANGED/);
 const second={...p,productId:'coffee',expectedPrice:310,revision:s.revision,requestId:randomUUID()};s=await rpc(second);assert.equal(s.balance,35);assert.equal(s.purchases.length,2);
 await assert.rejects(rpc({...p,requestId:randomUUID(),revision:s.revision}),/INSUFFICIENT_COINS/);assert.equal((await snap(a)).revision,s.revision);
 await db.query("update public.reward_catalog set price=999,active=false where id='snack'");assert.equal((await rpc(p)).purchaseId,bought.purchaseId);assert.equal((await rpc(p)).balance,35);
 assert.equal((await rpc(p)).purchases.find(x=>x.productId==='snack').price,155);
 await db.exec('set role authenticated');for(const table of ['reward_catalog','reward_purchases'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);await assert.rejects(db.query('select public.habit_snapshot($1,current_date)',[b]),/permission denied/);await db.exec('reset role');
 await db.exec('set role anon');await assert.rejects(db.query("select public.reward_request('{}')"),/permission denied/);await db.exec('reset role');
 await db.query('insert into habitify_admin.member_access(user_id,revoked_before) values($1,100)',[a]);await assert.rejects(rpc(p),/LOGIN_REQUIRED/);assert.equal((await rpc(p,a,'reward_request',101)).purchaseId,bought.purchaseId);
 // Exercise actual earned-reward reconciliation after spending, without refunding the purchase.
 const c=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[c,c+'@test.example']);
 await db.query("update public.reward_catalog set price=155,active=true where id='snack'");
 let cs=await snap(c);const act=async values=>{cs=await snap(c);return rpc({...values,day:cs.today,revision:cs.revision,requestId:randomUUID(),timezone:'Australia/Sydney'},c,'habitify_request');};
 cs=await act({op:'create',name:'行动',kind:'complete',icon:'leaf'});const habit=cs.habits[0].id;cs=await act({op:'progress',habitId:habit,value:1});assert.equal(cs.balance,15);
 await db.query("insert into public.coin_ledger(user_id,node,day,delta,rule_version) values($1,'test-funding',current_date,140,1)",[c]);
 cs=await snap(c);cs=await rpc({...p,requestId:randomUUID(),day:cs.today,revision:cs.revision},c);assert.equal(cs.balance,0);
 cs=await act({op:'progress',habitId:habit,value:0});assert.equal(cs.balance,-15);assert.equal(cs.purchases.length,1);
 await assert.rejects(rpc({...p,requestId:randomUUID(),revision:cs.revision,day:cs.today},c),/INSUFFICIENT_COINS/);
 cs=await act({op:'progress',habitId:habit,value:1});assert.equal(cs.balance,0);assert.equal(cs.purchases.length,1);
 await db.exec(await readFile(new URL('../docs/verification/2026-10-13-redemption.sql',import.meta.url),'utf8'));
 await db.query('delete from auth.users where id=$1',[a]);assert.equal((await db.query('select count(*)::int n from public.reward_purchases where user_id=$1',[a])).rows[0].n,0);
 }finally{await db.close();}
});
