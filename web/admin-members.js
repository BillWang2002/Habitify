import {createStatistics} from './statistics.js';
const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const joined=value=>value ? new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium'}).format(new Date(value)) : '—';
export function createAdminMembers(root,{api,onInvalid=()=>{}}){
 root.innerHTML=`<section class="admin-members-panel detail-panel"><div class="stats-heading"><h2>成员</h2><button data-refresh type="button">刷新列表</button></div><form data-search-form class="admin-search" novalidate><label for="admin-member-search">搜索成员邮箱</label><div><input id="admin-member-search" data-search maxlength="100" placeholder="输入邮箱关键词" autocomplete="off"><button type="submit">搜索</button></div></form><p data-message class="account-feedback" role="status"></p><div data-members class="account-list"></div><div class="admin-pagination"><button data-prev type="button">上一页</button><span data-page-label></span><button data-next type="button">下一页</button></div></section><section data-detail hidden><div class="detail-panel admin-member-identity"><div class="stats-heading"><h2>成员打卡统计</h2><button data-close type="button">收起统计</button></div><div data-identity></div><p data-detail-message class="account-feedback" role="status"></p></div><div data-statistics-root></div></section>`;
 const $=key=>root.querySelector(`[data-${key}]`),stats=createStatistics($('statistics-root'),{readOnly:true,showHeading:false});
 let epoch=0,listSequence=0,detailSequence=0,page=1,search='',selected=null,visible=false,loading=false;
 function clearDetail(){++detailSequence;selected=null;stats.clear();$('identity').replaceChildren();$('detail-message').textContent='';$('detail').hidden=true;$('members').querySelectorAll('[data-member]').forEach(b=>b.setAttribute('aria-pressed','false'));}
 function invalid(error){if(!api.active()){clear();onInvalid(error);return true;}return false;}
 function controls(total=0){$('prev').disabled=loading || page<=1;$('next').disabled=loading || page*20>=total;$('refresh').disabled=loading;}
 async function load(){if(!visible || !api.active())return;const ticket=epoch,seq=++listSequence;loading=true;controls();$('members').replaceChildren();clearDetail();$('page-label').textContent='';$('message').textContent='正在读取成员…';
  try{const data=await api.members(page,search);if(ticket!==epoch || seq!==listSequence || !visible)return;
   if(data.page!==page || !Array.isArray(data.members))throw new Error('成员列表响应不完整，请重试。');
   $('message').textContent=data.total ? `共 ${data.total} 位成员 · 只读查看` : '暂无匹配的成员。';$('page-label').textContent=`第 ${page} / ${Math.max(1,Math.ceil(data.total/20))} 页`;
   $('members').innerHTML=data.members.map(m=>`<button type="button" data-member="${esc(m.id)}" class="account-row admin-member-row"><span class="account-row-copy"><strong>${esc(m.email)}</strong><small>加入 ${esc(joined(m.createdAt))} · ${m.enabled ? '启用' : '停用'}${m.confirmed ? '' : ' · 邮箱未确认'}</small></span><span class="account-row-chevron" aria-hidden="true">›</span></button>`).join('');
   $('members').querySelectorAll('[data-member]').forEach(button=>button.onclick=()=>select(button.dataset.member));loading=false;controls(data.total);
  }catch(error){if(ticket!==epoch || seq!==listSequence || !visible)return;if(invalid(error))return;loading=false;controls();$('message').textContent=error.message;}
 }
 async function select(id){const ticket=epoch,seq=++detailSequence;selected=id;stats.clear();$('identity').replaceChildren();$('detail').hidden=false;$('detail-message').textContent='正在读取该成员的统计…';$('members').querySelectorAll('[data-member]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.member===id)));
  try{const data=await api.memberStatistics(id);if(ticket!==epoch || seq!==detailSequence || selected!==id || !visible)return;
   if(data.member?.id!==id || !data.snapshot?.statistics)throw new Error('成员统计响应不完整，请重试。');
   const m=data.member;$('identity').innerHTML=`<strong>${esc(m.email)}</strong><p class="dialog-note">${m.enabled ? '启用' : '停用'} · 加入 ${esc(joined(m.createdAt))}<br>账户时区：${esc(m.timezone || '尚未设置（空账户暂按 UTC）')} · 数据日期：${esc(data.snapshot.today)}</p>`;
   $('detail-message').textContent='只读统计，不修改该成员的打卡或金币。';stats.update(data.snapshot);
  }catch(error){if(ticket!==epoch || seq!==detailSequence || selected!==id || !visible)return;if(invalid(error))return;$('detail-message').textContent=error.message;}
 }
 function clear(){++epoch;++listSequence;loading=false;clearDetail();$('members').replaceChildren();$('message').textContent='';$('page-label').textContent='';controls();}
 $('search-form').onsubmit=event=>{event.preventDefault();search=$('search').value.trim();page=1;void load();};$('refresh').onclick=()=>void load();$('prev').onclick=()=>{page--;void load();};$('next').onclick=()=>{page++;void load();};$('close').onclick=clearDetail;
 return {show(){if(visible)return;visible=true;void load();},hide(){visible=false;clear();},clear(){visible=false;page=1;search='';$('search').value='';clear();}};
}
