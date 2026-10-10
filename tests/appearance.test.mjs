import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeAppearance,selectTheme,defaultAppearance} from '../web/appearance-model.js';
import {iconSvg,setIconTheme,resolveHabitIcon} from '../web/theme.js';
import {createAppearanceApi} from '../web/appearance-api.js';
test('外观清单限制资源与搭配，换套装保留独立头像及显示模式',()=>{
 assert.deepEqual(normalizeAppearance({theme:'untrusted',background:'https://evil.test',avatar:'<svg>',mode:'bad'}),defaultAppearance);
 const a=selectTheme({...defaultAppearance,avatar:'lumi',mode:'dark'},'lumi');assert.equal(a.background,'garden');assert.equal(a.avatar,'lumi');assert.equal(a.mode,'dark');assert.equal(normalizeAppearance({...a,background:'plain'}).background,'garden');
 setIconTheme('growth');const plain=iconSvg('book');setIconTheme('lumi');assert.notEqual(iconSvg('book'),plain);assert.equal(resolveHabitIcon('book'),'book');assert.equal(iconSvg('<script>').includes('<script>'),false);setIconTheme('growth');
});
test('外观接口只转发本人令牌、不自动重试写入，并报告并发与网络失败',async()=>{
 let calls=0;const client={auth:{getSession:async()=>({data:{session:{access_token:'user-token'}}})}};
 const api=createAppearanceApi(client,{url:'https://example.test',key:'public',fetcher:async(url,o)=>{calls++;assert.equal(o.cache,'no-store');assert.equal(o.headers.Authorization,'Bearer user-token');assert.equal(JSON.parse(o.body).op,'appearance-set');throw new Error('offline');}});
 await assert.rejects(api({op:'appearance-set'}),e=>e.code==='NETWORK_ERROR');assert.equal(calls,1);
 const stale=createAppearanceApi(client,{url:'https://example.test',key:'public',fetcher:async()=>Response.json({code:'STALE_DATA'},{status:409})});await assert.rejects(stale({op:'appearance-get'}),e=>e.code==='STALE_DATA');
 const out=createAppearanceApi({auth:{getSession:async()=>({data:{session:null}})}},{fetcher:async()=>{throw new Error('should not call');}});await assert.rejects(out({op:'appearance-get'}),e=>e.code==='LOGIN_REQUIRED');
});
