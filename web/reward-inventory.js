import {accountHeader} from './account-header.js';
import {emptyIconSvg} from './theme.js';
export function inventoryHtml(){return `<section data-page="inventory" hidden>${accountHeader({group:'我的空间',title:'我的物品'})}<p class="dialog-note">已兑换的生活奖励，请找管理员小王核销。</p><div id="inventory-list"></div><div id="inventory-empty" class="account-feature-state"><span class="account-feature-icon" aria-hidden="true">${emptyIconSvg('inventory')}</span><h2>还没有兑换的物品</h2><p id="inventory-note">登录并同步后查看本人兑换记录。</p></div></section>`;}
export function renderInventory(root,data){
 const list=root.querySelector('#inventory-list'),empty=root.querySelector('#inventory-empty');list.replaceChildren();
 const items=Array.isArray(data?.purchases)?data.purchases:[];empty.hidden=items.length>0;
 root.querySelector('#inventory-note').textContent=data?'完成打卡积累金币，兑换一份喜欢的奖励。':'登录并同步后查看本人兑换记录。';
 for(const item of items){
  const doc=root.ownerDocument,card=doc.createElement('article');card.className='module-item inventory-card';
  const heading=doc.createElement('h2');heading.textContent=item.name+' · 一份';
  const paid=doc.createElement('p');paid.textContent=`已支付 ${item.price} 金币`;
  const time=doc.createElement('p');const at=new Date(item.createdAt);time.textContent=Number.isNaN(at.getTime())?'':new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short',timeZone:data.timezone}).format(at);
  const id=doc.createElement('p');id.className='inventory-reference';id.textContent='兑换编号：'+item.id;
  const note=doc.createElement('p');note.textContent='请找管理员小王核销';card.append(heading,paid,time,id,note);list.append(card);
 }
}
