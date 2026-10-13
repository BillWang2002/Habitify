import {iconSvg} from './theme.js';
import {rewardAssets} from './reward-assets.js';

// Preview prices only. Signed-in purchases use the catalog and balance from the backend.
const samples={
 real:[
  {id:'milk-tea',name:'奶茶',price:310,description:'一杯喜欢的口味',detail:'留给自己的小奖励。兑换后请找管理员小王核销，具体口味线下商定。'},
  {id:'coffee',name:'咖啡',price:310,description:'给日常加一点香气',detail:'用一杯咖啡奖励自己的行动。兑换后请找管理员小王核销。'},
  {id:'snack',name:'零食',price:155,description:'一点喜欢的小滋味',detail:'为自己的行动准备一份小零食。兑换后请找管理员小王核销，具体品类线下商定。'}
 ],
 virtual:[]
};
const picture=item=>`<div class="shop-picture">${item&&rewardAssets[item.id]?`<img class="shop-product-image" src="${rewardAssets[item.id]}" alt="${item.name}的小刘鸭配图" width="500" height="500">`:'<span>配图暂不可用</span>'}</div>`;

export function rewardShopHtml(){
 return `<section data-page="rewards" hidden><div class="page-title rewards-heading"><div><p class="date-label">让努力有一点小期待</p><h1>激励</h1></div><div class="shop-balance" aria-label="当前金币余额"><span aria-hidden="true">${iconSvg('coins')}</span><div><small>我的金币</small><strong id="reward-balance">—</strong></div></div></div><div class="habit-filters shop-categories" aria-label="物品分类"><span class="filter-slider" aria-hidden="true"></span><button type="button" data-shop-category="virtual" aria-pressed="false">个性装扮</button><button type="button" data-shop-category="real" aria-pressed="true">生活奖励</button></div><p class="shop-preview-note">兑换后请找管理员小王核销</p><div class="shop-results" id="shop-results"><div class="shop-grid" id="shop-grid"></div></div><dialog class="habit-dialog shop-dialog" id="shop-dialog" aria-labelledby="shop-dialog-title"><div class="dialog-heading"><h2 id="shop-dialog-title" tabindex="-1" autofocus></h2><button type="button" id="shop-dialog-close" aria-label="关闭商品详情">×</button></div>${picture()}<p id="shop-dialog-description" class="dialog-note"></p><div class="shop-dialog-price" id="shop-dialog-price"></div><p id="shop-dialog-error" class="message" role="status"></p><div class="shop-dialog-actions"><button type="button" id="shop-buy" class="primary" disabled>登录后兑换</button><button type="button" id="shop-inventory" class="secondary" hidden>查看我的物品</button></div></dialog></section>`;
}

export function createRewardShop(root,{onViewChange=()=>{},onRedeem=async()=>{throw new Error("请先登录。");},onInventory=()=>{}}={}){
 const grid=root.querySelector('#shop-grid'),dialog=root.querySelector('#shop-dialog'),results=root.querySelector('#shop-results');
 let category='real',revision=0,animations=[],ghost=null,catalog=null,balance=null,selected=null,buying=false,success=false,modalEpoch=0,accountEpoch=0,uncertain=null;
 const buy=root.querySelector('#shop-buy'),error=root.querySelector('#shop-dialog-error'),price=root.querySelector('#shop-dialog-price'),inventory=root.querySelector('#shop-inventory');
 const itemFor=id=>{const base=samples.real.find(x=>x.id===id),server=catalog?.find(x=>x.id===id);return base ? {...base,price:server?.price ?? base.price,available:!!server} : null;};
 function renderDialog(){
  if(!selected||success)return;
  const item=itemFor(selected);const retry=uncertain?.productId===selected;root.querySelector('#shop-dialog-title').textContent=item.name;root.querySelector('#shop-dialog-description').textContent=item.detail;
  price.textContent=`${retry?uncertain.expectedPrice:item.price} 金币 · 每次兑换一份`;
  buy.disabled=buying||(!item.available&&!retry);buy.textContent=buying?'正在兑换…':retry?'重试确认兑换':!catalog?'登录并同步后兑换':!item.available?'商品暂不可兑换':'确认兑换';inventory.hidden=true;
 }
 function openItem(id){selected=id;success=false;++modalEpoch;error.textContent='';renderDialog();dialog.querySelector('.shop-picture').outerHTML=picture(itemFor(id));dialog.showModal();root.querySelector('#shop-dialog-title').focus({preventScroll:true});}
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
  root.querySelector('.shop-preview-note').hidden=category==='virtual';
  grid.innerHTML=samples[category].length?samples[category].map(base=>{const item=itemFor(base.id);return `<button type="button" class="shop-card module-item" data-shop-item="${item.id}" aria-label="查看${item.name}样式">${picture(item)}<div class="shop-card-copy"><h2>${item.name}</h2><p>${item.description}</p><div class="shop-card-footer"><span>${item.price} 金币</span><span class="shop-card-open" aria-hidden="true">${iconSvg('back')}</span></div></div></button>`;}).join(''):'<div class="shop-empty module-item"><h2>个性装扮后续添加</h2><p>新的装扮内容将在后续更新中加入。</p></div>';
  grid.querySelectorAll('[data-shop-item]').forEach(button=>button.onclick=()=>openItem(button.dataset.shopItem));
 }
 root.querySelectorAll('[data-shop-category]').forEach(button=>button.onclick=()=>changeCategory(button.dataset.shopCategory));
 root.querySelector('#shop-dialog-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{if(!dialog.open)++modalEpoch;});
 inventory.onclick=()=>{dialog.close();onInventory();};
 buy.onclick=async()=>{
  if(success){dialog.close();return;}
  if(buying||!selected)return;const item=itemFor(selected),retry=uncertain?.productId===selected;const payload=retry?uncertain:{productId:item.id,expectedPrice:item.price};if(!item.available&&!retry)return;
  if(navigator.onLine===false){error.textContent='请联网后再兑换。';return;}
  const ticket=modalEpoch,accountTicket=accountEpoch;buying=true;error.textContent='';renderDialog();
  try{const data=await onRedeem(payload);if(accountTicket!==accountEpoch)return;uncertain=null;
   if(ticket!==modalEpoch||!dialog.open||!data)return;
   const receipt=data.purchases?.find(x=>x.id===data.purchaseId);if(!receipt)throw new Error('兑换结果尚未确认，请刷新我的物品。');
   success=true;root.querySelector('#shop-dialog-title').textContent='兑换成功';root.querySelector('#shop-dialog-description').textContent='请找管理员小王核销';price.textContent=`${receipt.name} · 已支付 ${receipt.price} 金币`;buy.disabled=false;buy.textContent='我知道了';inventory.hidden=false;root.querySelector('#shop-dialog-title').focus({preventScroll:true});
  }catch(e){if(accountTicket!==accountEpoch)return;if(e.code==='NETWORK_ERROR')uncertain=payload;else if(uncertain?.productId===payload.productId)uncertain=null;if(ticket===modalEpoch&&dialog.open){error.textContent=e.code==='INSUFFICIENT_COINS'?`金币不足，还差 ${Math.max(0,itemFor(selected).price-balance)} 金币。`:e.code==='NETWORK_ERROR'?'兑换结果尚未确认，请重试确认兑换，或查看我的物品。':e.message;}}finally{if(accountTicket===accountEpoch){buying=false;if(!success)renderDialog();}}
 };
 root.addEventListener('error',event=>{const img=event.target;if(img?.classList?.contains('shop-product-image'))img.closest('.shop-picture').innerHTML='<span>配图暂不可用</span>';},true);
 render();
 const close=()=>{++modalEpoch;if(dialog.open)dialog.close();cancelTransition();};
 return {
  close,isOpen:()=>dialog.open,
  update(data){catalog=Array.isArray(data.rewardCatalog)?data.rewardCatalog.filter(x=>samples.real.some(i=>i.id===x.id)&&Number.isSafeInteger(x.price)&&x.price>0):null;balance=data.balance;render();renderDialog();},
  clear(){++accountEpoch;close();uncertain=null;buying=false;catalog=null;balance=null;selected=null;success=false;category='real';results.style.minHeight='';render();},
  getView(){return {category,minHeight:results.style.minHeight};},
  setView(view){if(!view)return;close();category=view.category==='virtual'?'virtual':'real';results.style.minHeight=view.minHeight||'';render();}
 };
}
