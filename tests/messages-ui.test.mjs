import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {markdownFragment} from '../web/markdown.js';
import {createInbox,inboxHtml} from '../web/inbox.js';
import {createInboxApi} from '../web/inbox-api.js';
test('Markdown保留排版但禁止脚本、HTML注入、图片请求和危险链接',()=>{
 const dom=new JSDOM('<div></div>');const doc=dom.window.document;
 const out=markdownFragment('# 标题\n\n**重点**\n\n[安全](https://example.com)\n\n[危险](javascript:alert(1))\n\n<img src="https://track.example/x" onerror="alert(1)">\n\n<script>alert(1)</script>\n\n![图片](https://track.example/x)',doc);doc.querySelector('div').append(out);
 assert.equal(doc.querySelector('h1').textContent,'标题');assert.equal(doc.querySelector('strong').textContent,'重点');assert.equal(doc.querySelectorAll('img,script,svg,iframe,style').length,0);
 const links=[...doc.querySelectorAll('a')];assert.equal(links[0].getAttribute('rel'),'noopener noreferrer');assert.ok(!links[1].hasAttribute('href'));dom.window.close();
});
test('收件箱晚到响应不会跨账户覆盖，退出清空正文/已读与未读提示',async()=>{
 const dom=new JSDOM('<div id="root"></div>');const root=dom.window.document.querySelector('#root');root.innerHTML=inboxHtml();let complete;const counts=[];
 const box=createInbox(root,{request:p=>p.op==='inbox-count'?Promise.resolve({unread:1}):new Promise(r=>complete=r),onCount:n=>counts.push(n)});
 box.enter({id:'a'});box.show();box.clear();box.enter({id:'b'});complete({unread:10,total:1,page:1,pageSize:20,items:[{id:'secret',title:'A的私有消息',received_at:new Date().toISOString(),status:'published',read_at:null}]});await new Promise(r=>setImmediate(r));assert.equal(root.querySelector('#inbox-items').textContent,'');assert.notEqual(counts.at(-1),10);box.clear();assert.equal(counts.at(-1),0);assert.equal(root.querySelector('#inbox-body').textContent,'');dom.window.close();
});
test('收件箱API仅携带本人身份且不缓存响应，匿名/无效未读数拒绝',async()=>{
 const calls=[],client={auth:{getSession:async()=>({data:{session:{access_token:'own-token'}}})}};
 const api=createInboxApi(client,{url:'https://test.example',key:'public',fetcher:async(url,init)=>{calls.push(init);return Response.json({data:{unread:2}});}});
 assert.deepEqual(await api({op:'inbox-count'}),{unread:2});assert.equal(calls[0].cache,'no-store');assert.equal(calls[0].headers.Authorization,'Bearer own-token');assert.equal(JSON.parse(calls[0].body).userId,undefined);
 await assert.rejects(createInboxApi({auth:{getSession:async()=>({data:{session:null}})}})({op:'inbox-count'}),/登录/);
 const bad=createInboxApi(client,{url:'https://test.example',key:'public',fetcher:async()=>Response.json({data:{unread:-1}})});await assert.rejects(bad({op:'inbox-count'}),/不可用/);
});

test('消息详情已读、回收站移入与恢复不会重复生成消息，分类状态正确',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');root.innerHTML=inboxHtml();let count;
 const box=createInbox(root,{preview:true,onCount:n=>count=n}),tick=()=>new Promise(r=>setImmediate(r));
 box.enter({id:'preview'});box.show();await tick();assert.equal(count,1);
 root.querySelector('.message-open').click();await tick();assert.equal(count,0);assert.ok(root.querySelector('#inbox-body').textContent.includes('一点行动'));
 root.querySelector('#inbox-detail-action').click();await tick();assert.equal(root.querySelectorAll('.message-card').length,0);
 root.querySelector('[data-mail-view=trash]').click();await tick();assert.equal(root.querySelectorAll('.message-card').length,1);
 root.querySelector('.message-row-action').click();await tick();root.querySelector('[data-mail-view=inbox]').click();await tick();assert.equal(root.querySelectorAll('.message-card').length,1);assert.equal(count,0);
 box.clear();dom.window.close();
});

test('消息贴纸只用于读取成功的空收件箱，回收站及读取失败不冒充空消息',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');root.innerHTML=inboxHtml();let fail=false;
 const box=createInbox(root,{request:async()=>{if(fail)throw new Error('连接失败');return {unread:0,items:[],total:0,page:1,pageSize:20};}}),tick=()=>new Promise(r=>setImmediate(r));
 box.enter({id:'test'});box.show();await tick();assert.ok(root.querySelector('[data-theme-empty="waiting-message"]'));root.querySelector('[data-mail-view=trash]').click();await tick();assert.equal(root.querySelector('.theme-empty-sticker'),null);assert.ok(root.querySelector('#inbox-items').textContent.includes('回收站为空'));
 box.clear();fail=true;box.enter({id:'other'});box.show();await tick();assert.equal(root.querySelector('#inbox-items').textContent,'');assert.ok(root.querySelector('#inbox-status').textContent.includes('连接失败'));box.clear();dom.window.close();
});
