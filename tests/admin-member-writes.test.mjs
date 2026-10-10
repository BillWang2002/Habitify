import test from 'node:test';import assert from 'node:assert/strict';import {createMemberWriter} from '../supabase/functions/admin/member-writes.js';
const p={op:'member-create',requestId:'request',email:'new@example.test',password:'private-new-password'},calls=[];
const fixture=(extra={})=>createMemberWriter({begin:async()=>({targetId:'new-id'}),finish:async()=>({completed:true}),fingerprint:async()=> 'f'.repeat(64),auth:{get:async()=>null,create:async()=>{},update:async()=>{},delete:async()=>{}},...extra});
test('成员写入先核验授权，拒绝时不会调用Auth；密码不进入数据库参数',async()=>{
 let called=0;const denied=fixture({begin:async()=>{throw new Error('ADMIN_FORBIDDEN');},auth:{create:async()=>called++}});await assert.rejects(denied('member','hash',p),/ADMIN_FORBIDDEN/);assert.equal(called,0);
 const writer=fixture({begin:async a=>{calls.push(a);return{targetId:'new-id'};},finish:async a=>{calls.push(a);return{completed:true};}});assert.equal((await writer('admin','hash',p)).completed,true);assert.equal(JSON.stringify(calls).includes(p.password),false);assert.equal(calls[0].execution,calls[1].execution);
});
test('新增账号重试使用同一ID并核对可信创建标记；已完成不再次改动Auth',async()=>{
 let created=0;const writer=fixture({auth:{get:async()=>({email:p.email,app_metadata:{habitify_created_request:p.requestId}}),create:async()=>created++}});await writer('admin','hash',p);assert.equal(created,0);
 const completed=fixture({begin:async()=>({result:{completed:true}}),auth:{get:async()=>{throw new Error('should not run');}}});assert.equal((await completed('admin','hash',p)).completed,true);
 await assert.rejects(fixture({auth:{get:async()=>({email:p.email,app_metadata:{}})}})('admin','hash',p),/MEMBER_EXISTS/);
});
test('Auth或结案失败明确待确认，永久删除已不存在目标时只结案',async()=>{
 let failed=0;await assert.rejects(fixture({auth:{get:async()=>null,create:async()=>{throw new Error('network');}},finish:async()=>failed++})('admin','hash',p),/ADMIN_WRITE_PENDING/);assert.equal(failed,0);
 await assert.rejects(fixture({finish:async()=>{throw new Error('database');}})('admin','hash',p),/ADMIN_WRITE_PENDING/);
 let deletes=0;await fixture({auth:{get:async()=>null,delete:async()=>deletes++}})('admin','hash',{op:'member-delete',requestId:'req',memberId:'id',confirmationEmail:p.email});assert.equal(deletes,0);
});

test('认证参数明确拒绝时结案；拒绝结案失败保留待确认状态',async()=>{
 let saved;const invalid={get:async()=>null,create:async()=>{throw new Error('INVALID_REQUEST');}};
 await assert.rejects(fixture({auth:invalid,finish:async a=>{saved=a;}})('admin','hash',p),/INVALID_REQUEST/);assert.equal(saved.success,false);assert.equal(saved.errorCode,'INVALID_REQUEST');
 await assert.rejects(fixture({auth:invalid,finish:async()=>{throw new Error('network');}})('admin','hash',p),/ADMIN_WRITE_PENDING/);
});
