import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {rewardShopHtml,createRewardShop} from '../web/reward-shop.js';

function setup(reduced=false){
 const dom=new JSDOM(`<div id="root">${rewardShopHtml()}</div>`),root=dom.window.document.querySelector('#root'),animations=[];
 root.querySelector('[data-page="rewards"]').hidden=false;
 globalThis.matchMedia=()=>({matches:reduced});
 dom.window.Element.prototype.animate=function(frames,options){let finish,reject;const finished=new Promise((resolve,fail)=>{finish=resolve;reject=fail;});const animation={target:this,frames,options,finished,finish,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'));}};animations.push(animation);return animation;};
 let remembered;const shop=createRewardShop(root,{onViewChange:()=>{remembered=shop.getView();}});
 const results=root.querySelector('#shop-results');Object.defineProperty(results,'scrollHeight',{get:()=>600});
 return {root,shop,results,animations,remembered:()=>remembered,click:category=>root.querySelector(`[data-shop-category=${category}]`).click()};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('商城双向切换保留滚动范围，旧层不可交互，动画结束恢复商品操作',async()=>{
 const {root,shop,results,animations,remembered,click}=setup();click('virtual');
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,2);
 assert.equal(animations[0].frames[1].transform,'translateX(44px)');assert.equal(animations[1].frames[0].transform,'translateX(-44px)');
 assert.equal(animations[0].target.inert,true);assert.equal(animations[0].target.getAttribute('aria-hidden'),'true');
 assert.equal(animations[1].target.id,'shop-grid');assert.equal(animations[1].options.duration,480);
 assert.equal(results.inert,true);assert.equal(results.style.minHeight,'600px');
 assert.deepEqual(remembered(),{category:'virtual',minHeight:'600px'});
 animations[0].finish();animations[1].finish();await tick();
 assert.equal(root.querySelector('.shop-ghost'),null);assert.equal(results.inert,false);assert.equal(results.style.minHeight,'600px');
 click('real');assert.equal(animations[2].frames[1].transform,'translateX(-44px)');assert.equal(animations[3].frames[0].transform,'translateX(44px)');
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,4);shop.close();
 assert.equal(root.querySelector('.shop-ghost'),null);assert.equal(results.inert,false);
});

test('商城快速反向切换不残留旧层，恢复视图与账户清理取消旧动画',async()=>{
 const {root,shop,results,animations,click}=setup();click('virtual');click('real');await tick();
 assert.equal(animations[0].cancelled,true);assert.equal(animations[1].cancelled,true);
 assert.equal(root.querySelectorAll('.shop-ghost').length,1);assert.equal(animations[2].cancelled,false);
 shop.setView({category:'virtual',minHeight:'700px'});await tick();
 assert.equal(root.querySelector('.shop-ghost'),null);assert.equal(results.inert,false);
 assert.deepEqual(shop.getView(),{category:'virtual',minHeight:'700px'});
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,2);
 shop.clear();assert.deepEqual(shop.getView(),{category:'real',minHeight:''});
 assert.equal(root.querySelector('#shop-grid').querySelectorAll('.shop-card').length,4);
});

test('减少动态效果时直接切换商城且不产生旧层，相同分类不重复执行',()=>{
 const {root,shop,animations,remembered,click}=setup(true);click('virtual');click('virtual');
 assert.equal(animations.length,0);assert.equal(root.querySelector('.shop-ghost'),null);
 assert.deepEqual(remembered(),{category:'virtual',minHeight:'600px'});shop.clear();
});
