import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
test('管理员本人限制：升级撤销旧成员会话、成员拒绝、本人可用和角色变化即时生效',async()=>{
 const db=new PGlite(),admin=randomUUID(),member=randomUUID(),legacy='a'.repeat(64),current='b'.repeat(64);
 try{
 await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);');
 await db.query('insert into auth.users values($1,$2,now(),null),($3,$4,now(),null)',[admin,'admin@example.test',member,'member@example.test']);
 await db.exec(await readFile(new URL('../supabase/migrations/202610050005_admin_sessions.sql',import.meta.url),'utf8'));
 await db.query('insert into habitify_admin.principals(user_id,expected_email) values($1,$2)',[admin,'admin@example.test']);
 await db.query('select public.admin_session_open($1,$2,$3)',[member,admin,legacy]);
 await db.exec(await readFile(new URL('../supabase/migrations/202610100007_admin_identity.sql',import.meta.url),'utf8'));
 assert.ok((await db.query('select revoked_at from habitify_admin.sessions where token_hash=$1',[legacy])).rows[0].revoked_at);
 await db.exec('set role service_role');
 assert.equal((await db.query('select public.admin_login_attempt($1) as data',[member])).rows[0].data.code,'ADMIN_FORBIDDEN');
 await assert.rejects(db.query('select public.admin_session_open($1,$2,$3)',[member,admin,current]),/ADMIN_FORBIDDEN/);
 await assert.rejects(db.query('select public.admin_session_check($1,$2)',[member,legacy]),/ADMIN_SESSION_EXPIRED/);
 assert.equal((await db.query('select public.admin_login_attempt($1) as data',[admin])).rows[0].data.adminId,admin);
 await db.query('select public.admin_session_open($1,$2,$3)',[admin,admin,current]);
 assert.ok((await db.query('select public.admin_session_check($1,$2) as data',[admin,current])).rows[0].data.expiresAt);
 await db.exec('reset role');
 // A forged legacy row cannot pass even if its revocation flag is reset.
 await db.query('update habitify_admin.sessions set revoked_at=null where token_hash=$1',[legacy]);
 await assert.rejects(db.query('select public.admin_session_check($1,$2)',[member,legacy]),/ADMIN_FORBIDDEN/);
 await db.exec('update habitify_admin.principals set enabled=false');
 await assert.rejects(db.query('select public.admin_session_check($1,$2)',[admin,current]),/ADMIN_FORBIDDEN/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.admin_login_attempt($1)',[admin]),/permission denied/);await assert.rejects(db.query('select public.admin_session_open($1,$2,$3)',[admin,admin,current]),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();}
});
