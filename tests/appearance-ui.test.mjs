import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
const {appearanceHtml,createAppearance,applyAppearance}=await import('../web/appearance.js');
const {iconSvg,setIconTheme,currentIconChoices,emptyArtwork}=await import('../web/theme.js');
const setup=()=>{const dom=new JSDOM('<meta name="theme-color"><div id="root"><div id="profile-avatar"></div></div>',{url:'https://example.test/Habitify/'});globalThis.document=dom.window.document;globalThis.location=dom.window.location;globalThis.localStorage=dom.window.localStorage;const root=document.querySelector('#root');root.insertAdjacentHTML('beforeend',appearanceHtml());return {dom,root};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
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
test('小刘鸭图标随主题替换，切回默认或露米恢复原图标及名称，失败贴纸回退',()=>{
 const {dom,root}=setup();setIconTheme('growth');
 root.insertAdjacentHTML('beforeend',`<div id="test-icons">${iconSvg('me')}${iconSvg('walk')}${iconSvg('feedback')}<small data-theme-icon-label="walk">自然</small></div><span class="theme-empty-art" data-theme-empty="inventory">${emptyArtwork('inventory',iconSvg('inventory'))}</span>`);
 const original=[...root.querySelectorAll('#test-icons svg')].map(s=>s.innerHTML);
 applyAppearance({theme:'duckyo'},root);
 assert.notEqual(root.querySelector('#test-icons svg').innerHTML,original[0]);assert.equal(root.querySelector('#test-icons small').textContent,'行动');assert.equal(currentIconChoices().find(c=>c.id==='walk').name,'行动');assert.equal(root.querySelectorAll('#test-icons svg')[2].innerHTML,original[2]);
 applyAppearance({theme:'growth'},root);assert.deepEqual([...root.querySelectorAll('#test-icons svg')].map(s=>s.innerHTML),original);assert.equal(root.querySelector('#test-icons small').textContent,'自然');
 applyAppearance({theme:'lumi'},root);const lumi=root.querySelector('#test-icons').innerHTML;applyAppearance({theme:'duckyo'},root);applyAppearance({theme:'lumi'},root);assert.equal(root.querySelector('#test-icons').innerHTML,lumi);
 createAppearance(root,{preview:true});root.querySelector('.theme-empty-sticker').dispatchEvent(new dom.window.Event('error'));assert.ok(root.querySelector('.theme-empty-art').classList.contains('has-art-error'));
 applyAppearance({theme:'growth'},root);dom.window.close();
});
