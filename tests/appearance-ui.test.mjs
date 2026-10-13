import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
const {appearanceHtml,createAppearance,applyAppearance}=await import('../web/appearance.js');
const {iconSvg,setIconTheme,currentIconChoices,emptyIconSvg}=await import('../web/theme.js');
const setup=()=>{const dom=new JSDOM('<meta name="theme-color"><div id="root"><div id="profile-avatar"></div></div>',{url:'https://example.test/Habitify/'});globalThis.document=dom.window.document;globalThis.location=dom.window.location;globalThis.localStorage=dom.window.localStorage;const root=document.querySelector('#root');root.insertAdjacentHTML('beforeend',appearanceHtml());return {dom,root};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const lumi={theme:'lumi',background:'harbor',surface:'glass',avatar:'lumi-harbor',mode:'dark'};
const access=admin=>({settings:admin?lumi:{theme:'growth',mode:'dark'},revision:2,allowedThemes:admin?['growth','lumi','duckyo']:['growth','duckyo']});
test('普通成员与公开预览无法选择露米，伪造本机缓存和角色字段无效',async()=>{
 const {dom,root}=setup();let resolve;localStorage.setItem('habitify-appearance:/Habitify/:ordinary',JSON.stringify({version:1,settings:lumi,isAdmin:true}));
 const ui=createAppearance(root,{request:()=>new Promise(r=>resolve=r)});ui.enter({id:'ordinary',isAdmin:true});
 assert.equal(document.documentElement.dataset.theme,'growth');assert.equal(root.querySelector('[data-theme-choice="lumi"]').hidden,true);
 resolve(access(false));await tick();root.querySelector('[data-theme-choice="lumi"]').onclick();assert.equal(document.documentElement.dataset.theme,'growth');
 ui.clear();const preview=createAppearance(root,{preview:true,initialPreview:lumi});preview.enter({id:'preview'});assert.equal(document.documentElement.dataset.theme,'growth');assert.equal(root.querySelector('[data-theme-choice="lumi"]').hidden,true);dom.window.close();
});
test('管理员云端许可才显示露米，账户切换后迟到响应不能恢复旧权限',async()=>{
 const {dom,root}=setup();const queue=[];const ui=createAppearance(root,{request:()=>new Promise(resolve=>queue.push(resolve))});
 ui.enter({id:'admin'});queue.shift()(access(true));await tick();assert.equal(document.documentElement.dataset.theme,'lumi');assert.equal(root.querySelector('[data-theme-choice="lumi"]').hidden,false);
 ui.refresh();const late=queue.shift();ui.enter({id:'member'});assert.equal(document.documentElement.dataset.theme,'growth');queue.shift()(access(false));await tick();late(access(true));await tick();assert.equal(document.documentElement.dataset.theme,'growth');assert.equal(root.querySelector('[data-theme-choice="lumi"]').hidden,true);dom.window.close();
});
test('读取响应乱序、未保存露米预览和权限撤销时立即回退',async()=>{
 const {dom,root}=setup();const queue=[];const ui=createAppearance(root,{request:()=>new Promise(resolve=>queue.push(resolve))});ui.enter({id:'admin'});queue.shift()(access(true));await tick();
 ui.refresh();const old=queue.shift();ui.refresh();const newest=queue.shift();root.querySelector('[data-theme-choice="lumi"]').click();root.querySelector('[data-appearance-value="garden"]').click();assert.equal(ui.busy(),false);ui.show();assert.equal(ui.busy(),true);
 newest(access(false));await tick();assert.equal(document.documentElement.dataset.theme,'growth');assert.equal(ui.busy(),false);old(access(true));await tick();assert.equal(root.querySelector('[data-theme-choice="lumi"]').hidden,true);dom.window.close();
});
test('保存时后台撤销权限，403后清除露米预览、读取新版并保留普通主题',async()=>{
 const {dom,root}=setup();let count=0;const ui=createAppearance(root,{request:async p=>{if(p.op==='appearance-get')return access(count++===0);throw Object.assign(new Error('露米主题仅供管理员使用'),{code:'THEME_FORBIDDEN'});}});
 ui.enter({id:'admin'});await tick();root.querySelector('[data-theme-choice="lumi"]').click();root.querySelector('[data-appearance-value="garden"]').click();root.querySelector('#appearance-save').click();await tick();await tick();assert.equal(document.documentElement.dataset.theme,'growth');assert.equal(root.querySelector('[data-theme-choice="lumi"]').hidden,true);assert.equal(root.querySelector('[data-theme-choice="duckyo"]').disabled,false);dom.window.close();
});
test('背景预览联动头像，取消恢复已应用搭配，保存请求不传独立头像选择',async()=>{
 const {dom,root}=setup();const saved={theme:'duckyo',background:'duckyo-work',surface:'glass',avatar:'duckyo-study',mode:'light'};let payload;
 const ui=createAppearance(root,{request:async p=>{if(p.op==='appearance-get')return {settings:saved,revision:3};payload=p;return {settings:p.settings,revision:4};}});
 ui.enter({id:'test-owner'});await tick();ui.show();root.querySelector('[data-theme-choice="duckyo"]').click();
 assert.equal(root.querySelectorAll('#appearance-avatars button').length,0);assert.ok(root.querySelector('#profile-avatar img').src.endsWith('/avatar-work-v2.webp'));
 root.querySelector('[data-appearance-value="duckyo-phone"]').click();assert.ok(root.querySelector('#profile-avatar img').src.endsWith('/avatar-phone.webp'));assert.ok(root.querySelector('#appearance-linked-avatar img').src.endsWith('/avatar-phone.webp'));
 ui.hide();assert.equal(document.documentElement.dataset.themeBackground,'duckyo-work');assert.ok(root.querySelector('#profile-avatar img').src.endsWith('/avatar-work-v2.webp'));
 ui.show();root.querySelector('[data-theme-choice="duckyo"]').click();root.querySelector('[data-appearance-value="duckyo-cake"]').click();root.querySelector('#appearance-save').click();await tick();
 assert.equal(payload.expectedRevision,3);assert.equal(payload.settings.avatar,'duckyo-cake');assert.equal(payload.settings.background,'duckyo-cake');ui.hide();assert.ok(root.querySelector('#profile-avatar img').src.endsWith('/avatar-cake.webp'));
 assert.equal(JSON.parse(localStorage.getItem('habitify-appearance:/Habitify/:test-owner')).settings.avatar,'duckyo-cake');dom.window.close();
});
test('主题图标与名称切换保持，所有主题空状态共用原始图标',()=>{
 const {dom,root}=setup();setIconTheme('growth');
 root.insertAdjacentHTML('beforeend',`<div id="test-icons">${iconSvg('me')}${iconSvg('walk')}${iconSvg('feedback')}<small data-theme-icon-label="walk">自然</small></div><span id="shared-empty">${emptyIconSvg('inventory')}</span>`);
 const shared=root.querySelector('#shared-empty').innerHTML;
 const original=[...root.querySelectorAll('#test-icons svg')].map(s=>s.innerHTML);
 applyAppearance({theme:'duckyo'},root);
 assert.notEqual(root.querySelector('#test-icons svg').innerHTML,original[0]);assert.equal(root.querySelector('#test-icons small').textContent,'行动');assert.equal(currentIconChoices().find(c=>c.id==='walk').name,'行动');assert.equal(root.querySelectorAll('#test-icons svg')[2].innerHTML,original[2]);
 applyAppearance({theme:'growth'},root);assert.deepEqual([...root.querySelectorAll('#test-icons svg')].map(s=>s.innerHTML),original);assert.equal(root.querySelector('#test-icons small').textContent,'自然');
 applyAppearance({theme:'lumi'},root);const lumi=root.querySelector('#test-icons').innerHTML;applyAppearance({theme:'duckyo'},root);applyAppearance({theme:'lumi'},root);assert.equal(root.querySelector('#test-icons').innerHTML,lumi);
 assert.equal(root.querySelector('#shared-empty').innerHTML,shared);const again=document.createElement('span');again.innerHTML=emptyIconSvg('inventory');assert.equal(again.innerHTML,shared);
 applyAppearance({theme:'growth'},root);dom.window.close();
});
