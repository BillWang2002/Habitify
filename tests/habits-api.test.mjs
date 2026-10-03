import test from 'node:test';
import assert from 'node:assert/strict';
import { createHabitsApi } from '../web/habits-api.js';
const client={auth:{getSession:async()=>({data:{session:{access_token:'test-user-token'}}})}};
const data={revision:1,today:'2026-10-04',habits:[],records:[]};
test('网络重试保持相同幂等请求，使用用户token而非管理key',async()=> {
 const calls=[];const request=createHabitsApi(client,{url:'https://example.supabase.co',key:'sb_publishable_test',timezone:'Australia/Sydney',fetcher:async(url,init)=>{calls.push({url,...init});if(calls.length===1)throw new Error('offline');return Response.json({data});}});
 assert.deepEqual(await request({op:'create',requestId:'stable-id'}),data);
 assert.equal(calls[0].body,calls[1].body);assert.equal(calls[1].headers.Authorization,'Bearer test-user-token');assert.equal(calls[1].cache,'no-store');
});
test('权限失效与数据库冲突不重试写入，不回显服务器细节',async()=> {
 let count=0;
 const request=createHabitsApi(client,{url:'https://example.supabase.co',key:'sb_publishable_test',fetcher:async()=>{count++;return Response.json({code:'STALE_DATA',message:'private debug'},{status:409});}});
 await assert.rejects(request({op:'progress'}),error=>error.code==='STALE_DATA' && !error.message.includes('private'));
 assert.equal(count,1);
 const absent=createHabitsApi({auth:{getSession:async()=>({data:{session:null}})}});
 await assert.rejects(absent({op:'snapshot'}),error=>error.code==='LOGIN_REQUIRED');
});
