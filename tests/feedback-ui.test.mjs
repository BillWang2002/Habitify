import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {feedbackHtml,createFeedback} from '../web/feedback.js';import {createAdminFeedback} from '../web/admin-feedback.js';import {createFeedbackApi} from '../web/feedback-api.js';import {createInbox,inboxHtml} from '../web/inbox.js';
const tick=()=>new Promise(r=>setImmediate(r)),id='00000000-0000-4000-8000-000000000001';
const row={id,title:'反馈标题',body:'<img src=x onerror=alert(1)>',category:'bug',status:'pending',created_at:'2026-10-12T00:00:00Z',replies:[],email:'test@example.test',revision:1,internal_note:'',mail:{state:'uncertain',attempts:1},history:[]};
function dom(){return new JSDOM('<div id="root"></div>');}
function dialogs(d){d.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};d.window.HTMLDialogElement.prototype.close=function(){this.open=false;};}
test('成员反馈字段内提示、一次提交、纯文字安全渲染和结果未知重试保留原请求',async()=>{
 const d=dom(),root=d.window.document.querySelector('#root');root.innerHTML=feedbackHtml();let sent=[],network=true;
 const box=createFeedback(root,{request:async p=>{if(p.op==='feedback-list')return {total:0,items:[]};if(p.op==='feedback-get')return row;sent.push(p);if(network)throw Object.assign(new Error('unknown'),{code:'NETWORK_ERROR'});return{id,submitted:true};}});
 box.enter({id:'a'});box.show();await tick();root.querySelector('#feedback-submit').click();assert.equal(root.querySelector('#feedback-title-error').hidden,false);assert.equal(sent.length,0);
 root.querySelector('#feedback-title').value='标题';root.querySelector('#feedback-body').value='正文';root.querySelector('#feedback-submit').click();await tick();assert.equal(sent.length,1);assert.equal(root.querySelector('#feedback-title').disabled,true);
 network=false;root.querySelector('#feedback-retry').click();await tick();await tick();assert.deepEqual(sent[1],sent[0]);assert.equal(root.querySelector('#feedback-content img'),null);assert.ok(root.querySelector('#feedback-content').textContent.includes('<img'));
 box.clear();assert.equal(root.querySelector('#feedback-content').textContent,'');assert.equal(root.querySelector('#feedback-body').value,'');d.window.close();
});
test('切换账户和退出丢弃迟到反馈数据，不带出A的原文',async()=>{
 const d=dom(),root=d.window.document.querySelector('#root');root.innerHTML=feedbackHtml();let resolve;
 const box=createFeedback(root,{request:()=>new Promise(r=>resolve=r)});box.enter({id:'a'});box.show(id);box.clear();box.enter({id:'b'});resolve(row);await tick();assert.equal(root.querySelector('#feedback-content').textContent,'');assert.equal(root.querySelector('#feedback-status').textContent,'');box.clear();d.window.close();
});
test('管理员回复需要确认，断网后冻结原内容且同ID重试，退出清空成员信息',async()=>{
 const d=dom();dialogs(d);const root=d.window.document.querySelector('#root');let sent=[],network=true,current={...row};
 const page=createAdminFeedback(root,{api:{feedback:async p=>{if(p.op==='feedback-admin-list')return{total:1,items:[current]};if(p.op==='feedback-admin-get')return current;sent.push(p);if(network)throw Object.assign(new Error('lost'),{code:'NETWORK_ERROR'});current={...current,revision:2,replies:[{id:'reply',body:p.body,created_at:row.created_at}]};return{id,revision:2,completed:true};}}});
 page.show();await tick();root.querySelector('.feedback-list-item').click();await tick();await tick();root.querySelector('#af-reply').value='回复';root.querySelector('#af-send').click();await tick();assert.equal(sent.length,0);root.querySelector('dialog .primary').click();await tick();assert.equal(sent.length,1);assert.equal(root.querySelector('#af-reply').disabled,true);
 network=false;root.querySelector('#af-retry').click();await tick();assert.deepEqual(sent[1],sent[0]);assert.ok(root.querySelector('#af-content').textContent.includes('回复'));page.clear();assert.equal(root.querySelector('#af-member').textContent,'');assert.equal(root.querySelector('#af-reply').value,'');d.window.close();
});
test('反馈API携带本人身份、no-store且禁止匿名；反馈回复在收件箱按纯文字展示',async()=>{
 let options;const api=createFeedbackApi({auth:{getSession:async()=>({data:{session:{access_token:'own-token'}}})}},{url:'https://test.example',key:'public',fetcher:async(url,init)=>{options=init;return Response.json({data:{id,submitted:true}});}});
 await api({op:'feedback-submit',requestId:id,category:'bug',title:'标题',body:'正文'});assert.equal(options.cache,'no-store');assert.equal(options.headers.Authorization,'Bearer own-token');assert.equal(JSON.parse(options.body).user_id,undefined);
 await assert.rejects(createFeedbackApi({auth:{getSession:async()=>({data:{session:null}})}})({op:'feedback-list',page:1}),/登录/);
 const d=dom(),root=d.window.document.querySelector('#root');root.innerHTML=inboxHtml();const box=createInbox(root,{request:async p=>p.op==='inbox-count'?{unread:1}:{unread:0,message:{id,title:'反馈回复',body:'**原样文本** <img src=x>',kind:'feedback-reply',feedback_id:id,status:'published',received_at:row.created_at}}});
 box.enter({id:'a'});box.show(id);await tick();assert.equal(root.querySelector('#inbox-body strong'),null);assert.equal(root.querySelector('#inbox-body img'),null);assert.equal(root.querySelector('#inbox-feedback-link').getAttribute('href'),'#/feedback/'+id);box.clear();assert.equal(root.querySelector('#inbox-feedback-link').hidden,true);d.window.close();
});

test('后台回复写入确认后详情刷新失败会清空回复输入，不诱导再次发送',async()=>{
 const d=dom();dialogs(d);const root=d.window.document.querySelector('#root');let gets=0,writes=0;
 const page=createAdminFeedback(root,{api:{feedback:async p=>{if(p.op==='feedback-admin-list')return{total:1,items:[row]};if(p.op==='feedback-admin-get'){if(++gets>1)throw Object.assign(new Error('lost'),{code:'NETWORK_ERROR'});return row;}writes++;return{id,revision:2,completed:true};}}});
 page.show();await tick();root.querySelector('.feedback-list-item').click();await tick();root.querySelector('#af-reply').value='回复';root.querySelector('#af-send').click();await tick();root.querySelector('dialog .primary').click();await tick();assert.equal(writes,1);assert.equal(root.querySelector('#af-reply').value,'');assert.ok(root.querySelector('#af-message').textContent.includes('操作已保存'));assert.equal(root.querySelector('#af-retry').hidden,true);page.clear();d.window.close();
});
