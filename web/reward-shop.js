import {iconSvg} from './theme.js';

// Layout samples only; real catalog, prices and redemption remain server-owned.
const samples={
 real:[
  {id:'milk-tea',name:'奶茶',description:'一杯喜欢的口味',detail:'留给自己的小奖励。口味、图片与领取方式后续确定。'},
  {id:'clothes',name:'衣服',description:'一件喜欢的新衣服',detail:'为喜欢的穿搭留一点期待。款式、图片与领取方式后续确定。'},
  {id:'coffee',name:'咖啡',description:'给日常加一点香气',detail:'用一杯咖啡奖励自己的行动。图片与领取方式后续确定。'},
  {id:'book',name:'图书',description:'一本想读的书',detail:'把积累换成新的阅读时光。书目、图片与领取方式后续确定。'}
 ],
 virtual:[
  {id:'theme',name:'主题套装',description:'换一套新的风景',detail:'背景、对应头像与主题图标的套装样式示例。具体内容后续确定。'},
  {id:'patterns',name:'打卡图案',description:'让行动多一点个性',detail:'用于打卡的个性图案样式示例。具体图案后续确定。'}
 ]
};
const picture=()=>`<div class="shop-picture"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-5 5 6"/></svg><span>图片待选</span></div>`;

export function rewardShopHtml(){
 return `<section data-page="rewards" hidden><div class="page-title rewards-heading"><div><p class="date-label">让努力有一点小期待</p><h1>激励</h1></div><div class="shop-balance" aria-label="当前金币余额"><span aria-hidden="true">${iconSvg('coins')}</span><div><small>我的金币</small><strong id="reward-balance">—</strong></div></div></div><div class="habit-filters shop-categories" aria-label="物品分类"><span class="filter-slider" aria-hidden="true"></span><button type="button" data-shop-category="virtual" aria-pressed="false">个性装扮</button><button type="button" data-shop-category="real" aria-pressed="true">生活奖励</button></div><p class="shop-preview-note">商品样式预览 · 图片与金币价格待定</p><div class="shop-results" id="shop-results"><div class="shop-grid" id="shop-grid"></div></div><dialog class="habit-dialog shop-dialog" id="shop-dialog" aria-labelledby="shop-dialog-title"><div class="dialog-heading"><h2 id="shop-dialog-title" tabindex="-1" autofocus></h2><button type="button" id="shop-dialog-close" aria-label="关闭商品详情">×</button></div>${picture()}<p id="shop-dialog-description" class="dialog-note"></p><div class="shop-dialog-price">金币价格待定</div><button type="button" class="primary" disabled>兑换暂未开放</button></dialog></section>`;
}

export function createRewardShop(root,{onViewChange=()=>{}}={}){
 const grid=root.querySelector('#shop-grid'),dialog=root.querySelector('#shop-dialog'),results=root.querySelector('#shop-results');
 let category='real',revision=0,animations=[],ghost=null;
 function cancelTransition(){
  ++revision;animations.forEach(animation=>animation.cancel());animations=[];
  ghost?.remove();ghost=null;results.inert=false;results.classList.remove('is-switching');
 }
 async function changeCategory(next){
  if(category===next)return;
  const direction=next==='real'?1:-1;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css=root.ownerDocument.defaultView.getComputedStyle(grid);
  const previousTransform=css.transform,previousOpacity=css.opacity;
  const snapshot=reduced?null:grid.cloneNode(true);
  const height=Math.max(results.scrollHeight,results.getBoundingClientRect().height);
  cancelTransition();const ticket=revision;
  // Preserve the scroll range when a category has fewer cards, just like check-in filters.
  results.style.minHeight=`${height}px`;category=next;render();onViewChange();
  if(!snapshot || grid.closest('[data-page]').hidden)return;
  snapshot.removeAttribute('id');snapshot.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
  snapshot.classList.add('result-ghost','shop-ghost');snapshot.setAttribute('aria-hidden','true');snapshot.inert=true;
  ghost=snapshot;results.append(snapshot);results.inert=true;results.classList.add('is-switching');
  const options={duration:parseFloat(root.ownerDocument.defaultView.getComputedStyle(root).getPropertyValue('--slide-duration'))||480,easing:'cubic-bezier(.22,.8,.28,1)'};
  animations=[
   snapshot.animate([{opacity:previousOpacity,transform:previousTransform},{opacity:0,transform:`translateX(${-direction*44}px)`}],options),
   grid.animate([{opacity:0,transform:`translateX(${direction*44}px)`},{opacity:1,transform:'translateX(0)'}],options)
  ];
  await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
  if(ticket===revision)cancelTransition();
 }
 function render(){
  root.querySelector('.shop-categories').style.setProperty('--filter-index',category==='real'?1:0);
  root.querySelectorAll('[data-shop-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.shopCategory===category)));
  grid.innerHTML=samples[category].map(item=>`<button type="button" class="shop-card module-item" data-shop-item="${item.id}" aria-label="查看${item.name}样式">${picture()}<div class="shop-card-copy"><h2>${item.name}</h2><p>${item.description}</p><div class="shop-card-footer"><span>价格待定</span><span class="shop-card-open" aria-hidden="true">${iconSvg('back')}</span></div></div></button>`).join('');
  grid.querySelectorAll('[data-shop-item]').forEach(button=>button.onclick=()=>{
   const item=samples[category].find(item=>item.id===button.dataset.shopItem);
   root.querySelector('#shop-dialog-title').textContent=item.name;
   root.querySelector('#shop-dialog-description').textContent=item.detail;
   dialog.showModal();root.querySelector('#shop-dialog-title').focus({preventScroll:true});
  });
 }
 root.querySelectorAll('[data-shop-category]').forEach(button=>button.onclick=()=>changeCategory(button.dataset.shopCategory));
 root.querySelector('#shop-dialog-close').onclick=()=>dialog.close();
 render();
 const close=()=>{if(dialog.open)dialog.close();cancelTransition();};
 return {
  close,isOpen:()=>dialog.open,
  clear(){close();category='real';results.style.minHeight='';render();},
  getView(){return {category,minHeight:results.style.minHeight};},
  setView(view){if(!view)return;close();category=view.category==='virtual'?'virtual':'real';results.style.minHeight=view.minHeight||'';render();}
 };
}
