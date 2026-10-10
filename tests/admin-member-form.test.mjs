import test from 'node:test';import assert from 'node:assert/strict';import {memberFormErrors} from '../web/admin-member-form.js';
test('成员表单：字段提示、密码一致、删除邮箱严格确认及余额/原因',()=>{
 const values={email:'a@example.test',password:'example-password',passwordAgain:'example-password',confirmation:'a@example.test',balance:'100',reason:'奖励调整'};
 assert.deepEqual(memberFormErrors('create',values),{});assert.ok(memberFormErrors('create',{...values,passwordAgain:'different'})['admin-edit-password-again']);assert.ok(memberFormErrors('create',{...values,email:'wrong'})['admin-edit-email']);
 assert.deepEqual(memberFormErrors('delete',values,{email:'a@example.test'}),{});assert.ok(memberFormErrors('delete',{...values,confirmation:'A@example.test'},{email:'a@example.test'})['admin-edit-confirmation']);
 for(const balance of ['','-1','1.5','1000001'])assert.ok(memberFormErrors('coins',{...values,balance})['admin-edit-balance']);assert.ok(memberFormErrors('coins',{...values,reason:''})['admin-edit-reason']);assert.deepEqual(memberFormErrors('coins',values),{});
});
