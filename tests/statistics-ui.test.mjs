import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createStatistics} from '../web/statistics.js';

function setup(reduced=false) {
 const dom=new JSDOM('<div id="root"></div>');
 const root=dom.window.document.querySelector('#root'), animations=[];
 globalThis.matchMedia=()=>({matches:reduced});
 dom.window.Element.prototype.animate=function(frames,options){const animation={target:this,frames,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(animation);return animation;};
 const stats=createStatistics(root);
 stats.update({today:'2026-10-13',records:[{habitId:'a',day:'2026-10-01',progress:1,goal:1},{habitId:'a',day:'2026-10-12',progress:1,goal:1}],statistics:{habits:[{id:'a',name:'阅读',goal:1,unit:'次'}],plans:[{habitId:'a',day:'2026-10-01',active:true,goal:1}]}});
 return {root,stats,animations,click:type=>root.querySelector(`[data-period=${type}]`).click()};
}

test('统计范围整体切换，连续切换取消前动画，保留日期选择及趋势选点',()=>{
 const {root,stats,animations,click}=setup();
 root.querySelector('[data-day-key="2026-10-12"]').click();
 click('week');
 const content=root.querySelector('[data-period-content]');
 assert.equal(animations[0].target,content);
 assert.equal(content.querySelectorAll('.stats-overview article').length,6);
 assert.equal(content.querySelectorAll('.detail-panel').length,3);
 assert.equal(content.contains(root.querySelector('[data-chart]')),true);
 assert.equal(content.contains(root.querySelector('[data-calendar]')),true);
 assert.equal(content.contains(root.querySelector('[data-habits]')),true);
 assert.equal(content.contains(root.querySelector('.stats-period')),false);
 assert.equal(root.querySelector('[data-overview] strong').textContent,'1');
 assert.match(animations[0].frames[0].transform,/-18px/);
 click('all');assert.equal(animations[0].cancelled,true);
 assert.match(animations[1].frames[0].transform,/\(18px\)/);
 assert.equal(root.querySelector('[data-overview] strong').textContent,'2');
 assert.equal(stats.getView().day,'2026-10-12');
 root.querySelector('[data-bucket-index="0"]').dispatchEvent(new root.ownerDocument.defaultView.MouseEvent('click'));assert.match(root.querySelector('[data-bucket]').textContent,/累计 1 次/);
 click('all');assert.equal(animations.length,2);
 stats.clear();assert.equal(animations[1].cancelled,true);assert.equal(root.querySelector('[data-statistics]').hidden,true);
});

test('减少动态效果偏好下范围切换仍更新所有统计，不启动动画',()=>{
 const {root,stats,animations,click}=setup(true);click('week');click('all');
 assert.equal(animations.length,0);assert.equal(stats.getView().type,'all');
 assert.equal(root.querySelector('[data-overview] strong').textContent,'2');
 assert.equal(root.querySelectorAll('[data-habits] [data-habit]').length,1);
});
