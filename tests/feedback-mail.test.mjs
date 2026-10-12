import test from 'node:test';import assert from 'node:assert/strict';
import {createFeedbackMailHandler,authorizeWorkerKey} from '../supabase/functions/feedback-mail/handler.js';
const task={id:'task',leaseId:'lease',feedbackId:'feedback',category:'bug',title:'<img onerror=alert(1)>',summary:'正文 & 摘要',createdAt:'2026-10-12'};
const config=()=>({serviceId:'service',templateId:'template',publicKey:'public',privateKey:'private',recipient:'admin@example.test'});
const req=()=>new Request('https://example.test/worker',{method:'POST',headers:{Authorization:'Bearer worker-key'}});
function setup(extra={}){const finishes=[],calls=[];return{finishes,calls,handler:createFeedbackMailHandler({authorize:async h=>h==='Bearer worker-key',config,claim:async()=>[task],finish:async(...args)=>finishes.push(args),fetcher:async(url,options)=>{calls.push({url,options});return new Response('OK');},...extra})};}
test('生产Worker授权拒绝缺配置、弱密钥、普通JWT和错误凭据',async()=>{
 const key='a'.repeat(64);assert.equal(await authorizeWorkerKey('Bearer '+key,key),true);
 for(const [header,expected] of [[null,key],['Bearer ordinary.jwt',key],['Bearer '+'b'.repeat(64),key],['Basic '+key,key],['Bearer short','short'],['Bearer '+key,undefined]])assert.equal(await authorizeWorkerKey(header,expected),false);
});
test('邮件Worker仅限私密任务授权，缺配置不领取或发送，响应无私密数据',async()=>{
 const f=setup();assert.equal((await f.handler(new Request('https://example.test',{method:'POST'}))).status,401);assert.equal(f.calls.length,0);
 let claimed=0;const missing=setup({config:()=>({}),claim:async()=>{claimed++;return[task];}});assert.equal((await missing.handler(req())).status,503);assert.equal(claimed,0);
 const r=await f.handler(req());assert.deepEqual(await r.json(),{processed:1});assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(f.finishes[0],['task','lease','accepted',null]);
 const payload=JSON.parse(f.calls[0].options.body);assert.equal(payload.template_params.to_email,'admin@example.test');assert.equal(payload.template_params.feedback_title,'&lt;img onerror=alert(1)&gt;');assert.equal(payload.template_params.userId,undefined);assert.ok(!payload.template_params.admin_url.includes('worker-key'));
});
test('发送429退避，确定拒绝失败，超时/5xx标为待确认，绝不自动盲目重发',async()=>{
 for(const [status,result,error] of [[429,'retry','RATE_LIMITED'],[400,'failed','REJECTED'],[503,'uncertain','RESULT_UNKNOWN']]){const f=setup({fetcher:async()=>new Response('private error text',{status})});await f.handler(req());assert.deepEqual(f.finishes[0],['task','lease',result,error]);}
 const lost=setup({fetcher:async()=>{throw new Error('credential and private data');}});await lost.handler(req());assert.deepEqual(lost.finishes[0],['task','lease','uncertain','RESULT_UNKNOWN']);
});
