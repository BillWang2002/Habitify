import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
test('完整迁移：露米后端权限、旧配置回退、管理员身份失效、重试与越权拒绝',async()=>{
 const db=new PGlite(),admin=randomUUID(),member=randomUUID();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('iat',nullif(current_setting('request.jwt.claim.iat',true),'')::bigint)$$;grant usage on schema auth to anon,authenticated;`);
 const dir=new URL('../supabase/migrations/',import.meta.url),files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 for(const f of files.filter(f=>!f.includes('017_')))await db.exec(await readFile(new URL(f,dir),'utf8'));
 for(const id of [admin,member])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@test.example']);
 await db.query('insert into habitify_admin.principals(user_id,expected_email) values($1,$2)',[admin,admin+'@test.example']);
 async function rpc(p,uid=member,iat=100){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.iat',$2,false)",[uid,String(iat)]);await db.exec('set role authenticated');try{return(await db.query('select public.appearance_request($1::jsonb) data',[JSON.stringify(p)])).rows[0].data;}finally{await db.exec('reset role');}}
 const lumi={theme:'lumi',background:'harbor',surface:'glass',avatar:'lumi-harbor',mode:'dark'},set=(settings,rev)=>({op:'appearance-set',settings,expectedRevision:rev,requestId:randomUUID()});
 const old=set(lumi,0);await rpc(old);const adminOld=set(lumi,0);await rpc(adminOld,admin);
 const migration=await readFile(new URL('202610140017_lumi_admin_access.sql',dir),'utf8');await db.exec(migration);
 const fallback=await rpc({op:'appearance-get'});assert.equal(fallback.settings.theme,'growth');assert.equal(fallback.settings.mode,'dark');assert.equal(fallback.revision,2);assert.deepEqual(fallback.allowedThemes,['growth','duckyo']);
 await assert.rejects(rpc(old),/THEME_FORBIDDEN/);await assert.rejects(rpc(set(lumi,2)),/THEME_FORBIDDEN/);
 const currentAdmin=await rpc({op:'appearance-get'},admin);assert.equal(currentAdmin.settings.theme,'lumi');assert.equal(currentAdmin.revision,1);assert.deepEqual(currentAdmin.allowedThemes,['growth','lumi','duckyo']);assert.deepEqual(await rpc(adminOld,admin),currentAdmin);
 const duck={theme:'duckyo',background:'duckyo-phone',surface:'glass',avatar:'duckyo-phone',mode:'light'},p=set(duck,2);const result=await rpc(p);assert.equal(result.revision,3);assert.deepEqual(await rpc(p),result);await assert.rejects(rpc({...p,requestId:randomUUID()}),/STALE_DATA/);
 await assert.rejects(rpc({...p,userId:admin}),/INVALID_REQUEST/);await assert.rejects(rpc({...p,settings:{...duck,avatar:'lumi'},expectedRevision:3,requestId:randomUUID()}),/INVALID_REQUEST/);
 await db.exec(migration);assert.equal((await rpc({op:'appearance-get'})).revision,3);assert.equal((await rpc({op:'appearance-get'},admin)).revision,1);
 await db.query('update auth.users set email=$2 where id=$1',[admin,'changed@test.example']);
 await assert.rejects(rpc(adminOld,admin),/THEME_FORBIDDEN/);assert.equal((await rpc({op:'appearance-get'},admin)).settings.theme,'growth');
 await db.query('update auth.users set email=$2 where id=$1',[admin,admin+'@test.example']);await db.exec('update habitify_admin.principals set enabled=false');assert.deepEqual((await rpc({op:'appearance-get'},admin)).allowedThemes,['growth','duckyo']);
 await db.query('insert into habitify_admin.member_access(user_id,revoked_before) values($1,100)',[member]);await assert.rejects(rpc({op:'appearance-get'}),/LOGIN_REQUIRED/);assert.equal((await rpc({op:'appearance-get'},member,101)).revision,3);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select public.appearance_request_before_theme_access('{\"op\":\"appearance-get\"}')"),/permission denied/);await assert.rejects(db.query('select habitify_admin.identity()'),/permission denied/);await assert.rejects(db.query('select * from public.account_appearance'),/permission denied/);if(role==='anon')await assert.rejects(db.query("select public.appearance_request('{\"op\":\"appearance-get\"}')"),/permission denied/);await db.exec('reset role');}
 await db.exec(await readFile(new URL('../docs/verification/2026-10-14-release-regression.sql',import.meta.url),'utf8'));
 }finally{await db.close();}
});
