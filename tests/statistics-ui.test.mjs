import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createStatistics} from '../web/statistics.js';

function setup(reduced=false) {
 const dom=new JSDOM('<div id="root"></div>');
 const root=dom.window.document.querySelector('#root'), animations=[];
 globalThis.matchMedia=()=>({matches:reduced});
 dom.window.Element.prototype.animate=function(frames,options){let finish,reject;const finished=new Promise((resolve,fail)=>{finish=resolve;reject=fail;});const animation={target:this,frames,options,finished,finish,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'));}};animations.push(animation);return animation;};
 const stats=createStatistics(root);
 stats.update({today:'2026-10-13',records:[{habitId:'a',day:'2026-10-01',progress:1,goal:1},{habitId:'a',day:'2026-10-12',progress:1,goal:1}],statistics:{habits:[{id:'a',name:'阅读',goal:1,unit:'次'}],plans:[{habitId:'a',day:'2026-10-01',active:true,goal:1}]}});
 return {root,stats,animations,click:type=>root.querySelector(`[data-period=${type}]`).click()};
}

test('统计范围整体切换，连续切换取消前动画，保留日期选择及趋势选点',()=>{
 const {root,stats,animations,click}=setup();
 root.querySelector('[data-day-key="2026-10-12"]').click();
 root.querySelector('[data-chart]').scrollLeft=120;
 click('week');
 const content=root.querySelector('[data-period-content]');
 assert.equal(animations[1].target,content);
 assert.equal(animations[0].target.getAttribute('aria-hidden'),'true');
 assert.equal(animations[0].target.inert,true);
 assert.equal(animations[0].target.querySelector('[data-chart]').scrollLeft,120);
 assert.equal(root.querySelector('[data-chart]').scrollLeft,120);
 assert.equal(content.querySelectorAll('.stats-overview article').length,6);
 assert.equal(content.querySelectorAll('.detail-panel').length,3);
 assert.equal(content.contains(root.querySelector('[data-chart]')),true);
 assert.equal(content.contains(root.querySelector('[data-calendar]')),true);
 assert.equal(content.contains(root.querySelector('[data-habits]')),true);
 assert.equal(content.contains(root.querySelector('.stats-period')),false);
 assert.equal(root.querySelector('[data-overview] strong').textContent,'1');
 assert.match(animations[0].frames[1].transform,/\(44px\)/);
 assert.match(animations[1].frames[0].transform,/-44px/);
 click('all');assert.equal(animations[0].cancelled,true);
 assert.equal(animations[1].cancelled,true);
 assert.match(animations[2].frames[1].transform,/-44px/);
 assert.match(animations[3].frames[0].transform,/\(44px\)/);
 assert.equal(root.querySelector('[data-overview] strong').textContent,'2');
 assert.equal(stats.getView().day,'2026-10-12');
 root.querySelector('[data-bucket-index="0"]').dispatchEvent(new root.ownerDocument.defaultView.MouseEvent('click'));assert.match(root.querySelector('[data-bucket]').textContent,/累计 1 次/);
 click('all');assert.equal(animations.length,4);
 stats.clear();assert.equal(animations[3].cancelled,true);assert.equal(root.querySelector('[data-statistics]').hidden,true);
 assert.equal(root.querySelector('.stats-period-ghost'),null);
});

test('六种统计范围转换方向与打卡页一致，结束后移除旧层并恢复交互',async()=>{
 const {root,stats,animations,click}=setup();const periods=['week','month','all'];
 for(const from of periods)for(const to of periods){
  if(from===to)continue;
  stats.setView({type:from,month:'2026-10',day:'2026-10-12'});const start=animations.length;click(to);
  const [outgoing,incoming]=animations.slice(start),direction=periods.indexOf(to)>periods.indexOf(from)?1:-1;
  assert.equal(outgoing.frames[1].transform,`translateX(${-direction*44}px)`);
  assert.equal(incoming.frames[0].transform,`translateX(${direction*44}px)`);
  assert.equal(outgoing.options.duration,480);assert.equal(incoming.options.duration,480);
  assert.equal(root.querySelector('[data-period-results]').inert,true);
  assert.equal(root.querySelectorAll('[data-period-content]').length,1);
  outgoing.finish();incoming.finish();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(root.querySelector('.stats-period-ghost'),null);
  assert.equal(root.querySelector('[data-period-results]').inert,false);
  assert.equal(root.querySelector('[data-period-results]').style.minHeight,'');
 }
});

test('快速反向切换及视图恢复时，旧动画完成不能清理当前动画层',async()=>{
 const {root,stats,animations,click}=setup();click('week');click('month');
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(animations[0].cancelled,true);assert.equal(animations[1].cancelled,true);
 assert.equal(root.querySelectorAll('.stats-period-ghost').length,1);
 assert.equal(root.querySelector('[data-period-results]').inert,true);
 assert.equal(animations[2].cancelled,false);
 stats.setView({type:'all',month:'2026-10',day:'2026-10-12'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(animations[2].cancelled,true);assert.equal(animations[3].cancelled,true);
 assert.equal(root.querySelector('.stats-period-ghost'),null);assert.equal(root.querySelector('[data-period-results]').inert,false);
 assert.equal(stats.getView().type,'all');assert.equal(stats.getView().day,'2026-10-12');
});

test('减少动态效果偏好下范围切换仍更新所有统计，不启动动画',()=>{
 const {root,stats,animations,click}=setup(true);click('week');click('all');
 assert.equal(animations.length,0);assert.equal(stats.getView().type,'all');
 assert.equal(root.querySelector('[data-overview] strong').textContent,'2');
 assert.equal(root.querySelectorAll('[data-habits] [data-habit]').length,1);
});
