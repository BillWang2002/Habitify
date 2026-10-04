import test from 'node:test';
import assert from 'node:assert/strict';
import {checkinErrors} from '../web/form-validation.js';
const values={name:'喝水',kind:'quantity',goal:'8',unit:'杯',note:'',progress:'0'};
test('打卡字段验证拒绝空白名称、空目标和空单位，错误归属具体填写框',()=>{
 assert.deepEqual(Object.keys(checkinErrors('create',{...values,name:'  ',goal:'',unit:' '})),['habit-name','habit-goal','habit-unit']);
 assert.deepEqual(checkinErrors('create',values),{});
 assert.deepEqual(checkinErrors('create',{...values,kind:'complete',goal:'',unit:''}),{});
});
test('数量与进度必须为范围内整数，空输入不能当作合法零进度',()=>{
 for(const goal of ['0','1.5','100001','bad']) assert.ok(checkinErrors('create',{...values,goal})['habit-goal']);
 for(const progress of ['','-1','1.5','9']) assert.ok(checkinErrors('progress',{...values,progress},8)['habit-progress']);
 assert.deepEqual(checkinErrors('progress',values,8),{});assert.deepEqual(checkinErrors('progress',{...values,progress:'8'},8),{});
 assert.deepEqual(checkinErrors('undo',{...values,name:''}),{});
});
