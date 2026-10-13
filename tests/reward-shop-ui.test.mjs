import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {rewardShopHtml,createRewardShop} from '../web/reward-shop.js';

function setup(reduced=false,options={}){
 const dom=new JSDOM(`<div id="root">${rewardShopHtml()}</div>`),root=dom.window.document.querySelector('#root'),animations=[];
 root.querySelector('[data-page="rewards"]').hidden=false;
 globalThis.matchMedia=()=>({matches:reduced});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 dom.window.Element.prototype.animate=function(frames,options){let finish,reject;const finished=new Promise((resolve,fail)=>{finish=resolve;reject=fail;});const animation={target:this,frames,options,finished,finish,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'));}};animations.push(animation);return animation;};
 let remembered;const shop=createRewardShop(root,{...options,onViewChange:()=>{remembered=shop.getView();}});
 const results=root.querySelector('#shop-results');Object.defineProperty(results,'scrollHeight',{get:()=>600});
 return {root,shop,results,animations,remembered:()=>remembered,click:category=>root.querySelector(`[data-shop-category=${category}]`).click()};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('商城双向切换保留滚动范围，旧层不可交互，动画结束恢复商品操作',async()=>{
 const {root,shop,results,animations,remembered,click}=setup();click('virtual');
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,0);
 assert.ok(root.querySelector('.shop-empty').textContent.includes('后续添加'));
 assert.equal(animations[0].frames[1].transform,'translateX(44px)');assert.equal(animations[1].frames[0].transform,'translateX(-44px)');
 assert.equal(animations[0].target.inert,true);assert.equal(animations[0].target.getAttribute('aria-hidden'),'true');
 assert.equal(animations[1].target.id,'shop-grid');assert.equal(animations[1].options.duration,480);
 assert.equal(results.inert,true);assert.equal(results.style.minHeight,'600px');
 assert.deepEqual(remembered(),{category:'virtual',minHeight:'600px'});
 animations[0].finish();animations[1].finish();await tick();
 assert.equal(root.querySelector('.shop-ghost'),null);assert.equal(results.inert,false);assert.equal(results.style.minHeight,'600px');
 click('real');assert.equal(animations[2].frames[1].transform,'translateX(-44px)');assert.equal(animations[3].frames[0].transform,'translateX(44px)');
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,3);shop.close();
 assert.equal(root.querySelector('.shop-ghost'),null);assert.equal(results.inert,false);
});

test('商城快速反向切换不残留旧层，恢复视图与账户清理取消旧动画',async()=>{
 const {root,shop,results,animations,click}=setup();click('virtual');click('real');await tick();
 assert.equal(animations[0].cancelled,true);assert.equal(animations[1].cancelled,true);
 assert.equal(root.querySelectorAll('.shop-ghost').length,1);assert.equal(animations[2].cancelled,false);
 shop.setView({category:'virtual',minHeight:'700px'});await tick();
 assert.equal(root.querySelector('.shop-ghost'),null);assert.equal(results.inert,false);
 assert.deepEqual(shop.getView(),{category:'virtual',minHeight:'700px'});
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,0);
 shop.clear();assert.deepEqual(shop.getView(),{category:'real',minHeight:''});
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,3);
});

test('减少动态效果时直接切换商城且不产生旧层，相同分类不重复执行',()=>{
 const {root,shop,animations,remembered,click}=setup(true);click('virtual');click('virtual');
 assert.equal(animations.length,0);assert.equal(root.querySelector('.shop-ghost'),null);
 assert.deepEqual(remembered(),{category:'virtual',minHeight:'600px'});shop.clear();
});

const catalog=[{id:'snack',price:155},{id:'coffee',price:310},{id:'milk-tea',price:310}];
test('兑换按钮防重复点击，成功凭据与管理员提示，预览不发起兑换',async()=>{
 let calls=0,resolve;const response=new Promise(r=>resolve=r);const {root,shop}=setup(false,{onRedeem:async()=>{calls++;return response;}});
 const open=()=>root.querySelector('[data-shop-item="snack"]').click(),buy=root.querySelector('#shop-buy');
 open();assert.equal(buy.disabled,true);buy.click();assert.equal(calls,0);root.querySelector('#shop-dialog-close').click();
 shop.update({balance:500,rewardCatalog:catalog,purchases:[]});open();buy.click();buy.click();assert.equal(calls,1);assert.equal(buy.disabled,true);
 const data={balance:345,rewardCatalog:catalog,purchaseId:'receipt',purchases:[{id:'receipt',name:'零食',price:155}]};shop.update(data);resolve(data);await tick();
 assert.equal(root.querySelector('#shop-dialog-title').textContent,'兑换成功');assert.equal(root.querySelector('#shop-dialog-description').textContent,'请找管理员小王核销');assert.equal(root.querySelector('#shop-inventory').hidden,false);assert.equal(buy.textContent,'我知道了');buy.click();assert.equal(root.querySelector('#shop-dialog').open,false);
});
test('网络结果未确认可按原价格重试，刷新余额不足也不会阻挡确认原请求',async()=>{
 const calls=[];let shop;const state=setup(false,{onRedeem:async p=>{calls.push(p);if(p.productId==='coffee')throw new Error('原操作尚未确认');if(calls.length===1)throw Object.assign(new Error('结果未确认'),{code:'NETWORK_ERROR'});return {purchaseId:'old',purchases:[{id:'old',name:'零食',price:155}]};}});shop=state.shop;
 shop.update({balance:155,rewardCatalog:catalog});state.root.querySelector('[data-shop-item="snack"]').click();const buy=state.root.querySelector('#shop-buy');buy.click();await tick();assert.equal(buy.textContent,'重试确认兑换');
 shop.update({balance:0,rewardCatalog:catalog.map(x=>({...x,price:999}))});assert.ok(state.root.querySelector('#shop-dialog-price').textContent.includes('155'));state.root.querySelector('#shop-dialog-close').click();state.root.querySelector('[data-shop-item=coffee]').click();buy.click();await tick();state.root.querySelector('#shop-dialog-close').click();state.root.querySelector('[data-shop-item=snack]').click();assert.ok(state.root.querySelector('#shop-dialog-price').textContent.includes('155'));buy.click();await tick();assert.deepEqual(calls[0],calls[2]);assert.equal(state.root.querySelector('#shop-dialog-title').textContent,'兑换成功');
});
test('账户清理后迟到兑换结果不能显示成功或解锁新账户正在进行的兑换',async()=>{
 const resolvers=[];const {root,shop}=setup(false,{onRedeem:()=>new Promise(r=>resolvers.push(r))});
 const open=()=>root.querySelector('[data-shop-item="snack"]').click(),buy=root.querySelector('#shop-buy'),data={balance:500,rewardCatalog:catalog};
 shop.update(data);open();buy.click();shop.clear();shop.update(data);open();buy.click();assert.equal(resolvers.length,2);
 resolvers[0]({purchaseId:'old',purchases:[{id:'old',name:'旧账户',price:155}]});await tick();assert.equal(buy.disabled,true);assert.notEqual(root.querySelector('#shop-dialog-title').textContent,'兑换成功');
 resolvers[1]({purchaseId:'new',purchases:[{id:'new',name:'零食',price:155}]});await tick();assert.equal(root.querySelector('#shop-dialog-title').textContent,'兑换成功');
});
