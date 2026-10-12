import {iconSvg} from './theme.js';
import {createMessageConfirm} from './message-confirm.js';
import {showFieldErrors} from './form-validation.js';
import {categories,feedbackStates,mailStates,feedbackDate,appendText,renderFeedbackContent} from './feedback-shared.js';
export function createAdminFeedback(root,{api,onInvalid=()=>{}}={}){
 root.innerHTML=`<div class="page-title"><div><p class="date-label">后台管理</p><h1>反馈</h1></div><button id="af-refresh" type="button" class="icon-action" aria-label="刷新反馈">${iconSvg('refresh')}</button></div>
 <div class="feedback-filter" aria-label="反馈状态筛选">${Object.entries({all:'全部',...feedbackStates}).map(([id,label])=>`<button type="button" data-af-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div>
 <form id="af-search-form" class="feedback-search"><label class="sr-only" for="af-search">搜索反馈编号、标题或成员邮箱</label><input id="af-search" maxlength="100" placeholder="搜索编号、标题或成员邮箱"><button type="submit">搜索</button></form>
 <p id="af-message" class="account-feedback" role="status" aria-live="polite"></p><button id="af-retry" type="button" hidden>继续确认上次操作</button>
 <div class="announcement-layout"><div><div id="af-list" class="message-list"></div><div id="af-pager" class="message-pagination" hidden><button id="af-prev" type="button">上一页</button><span id="af-page"></span><button id="af-next" type="button">下一页</button></div></div>
 <section id="af-detail" class="detail-panel feedback-form" hidden><p id="af-member" class="dialog-note"></p><div id="af-content"></div><div class="feedback-mail-status"><h3>管理员邮件通知</h3><p id="af-mail" class="dialog-note"></p><button id="af-mail-retry" type="button" hidden>重新发送通知</button></div>
 <form id="af-process-form" novalidate><h3>处理反馈</h3><div class="feedback-filter" aria-label="设置处理状态">${Object.entries(feedbackStates).map(([id,label])=>`<button type="button" data-af-state="${id}" aria-pressed="false">${label}</button>`).join('')}</div>
 <div id="af-reason-wrap" hidden><label for="af-reason">关闭说明（成员可见）</label><textarea id="af-reason" rows="3" maxlength="1000" aria-describedby="af-reason-error"></textarea><p id="af-reason-error" class="field-error" role="status" hidden></p></div>
 <label for="af-note">内部备注（仅管理员可见）</label><textarea id="af-note" rows="3" maxlength="1000"></textarea><button id="af-save" type="submit" class="primary">保存处理结果</button></form>
 <form id="af-reply-form" novalidate><label for="af-reply">回复成员</label><textarea id="af-reply" rows="5" maxlength="3000" placeholder="回复将同步进入该成员的收件箱" aria-describedby="af-reply-error"></textarea><p id="af-reply-error" class="field-error" role="status" hidden></p><button id="af-send" type="submit" class="primary">发送回复</button></form><div id="af-history"></div></section></div>`;
 const $=id=>root.querySelector('#'+id),confirm=createMessageConfirm(root);let epoch=0,sequence=0,loaded=false,working=false,pending=null,row=null,page=1,total=0,filter='all',search='',state='pending',dirty=false;
 const note=text=>$('af-message').textContent=text;
 function layout(){
  $('af-detail').hidden=!row;$('af-retry').hidden=!pending||working;
  root.querySelectorAll('input,textarea,button').forEach(b=>{if(!b.closest('dialog'))b.disabled=working||!!pending;});
  $('af-retry').disabled=working;
  root.querySelectorAll('[data-af-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.afFilter===filter)));
  root.querySelectorAll('[data-af-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.afState===state)));
  $('af-reason-wrap').hidden=state!=='closed';$('af-mail-retry').hidden=!['failed','uncertain'].includes(row?.mail?.state);
  $('af-pager').hidden=total<=20;$('af-prev').disabled=working||!!pending||page<=1;$('af-next').disabled=working||!!pending||page*20>=total;
  $('af-page').textContent=`${page} / ${Math.max(1,Math.ceil(total/20))}`;
 }
 function invalid(error){if(['LOGIN_REQUIRED','ADMIN_SESSION_EXPIRED','ADMIN_FORBIDDEN'].includes(error.code)){clear();onInvalid(error);return true;}return false;}
 function fill(data){
  row=data;state=data.status;dirty=false;for(const b of $('af-list').querySelectorAll('button')){b.setAttribute('aria-pressed',String(b.dataset.feedbackId===data.id));if(b.dataset.feedbackId===data.id)b.querySelector('small').textContent=`${categories[data.category]} · ${feedbackStates[data.status]} · ${feedbackDate(data.created_at)}`;}renderFeedbackContent($('af-content'),data);$('af-member').textContent=`提交成员：${data.email}`;
  $('af-note').value=data.internal_note||'';$('af-reason').value=data.close_reason||'';$('af-reply').value='';
  $('af-mail').textContent=`${mailStates[data.mail?.state]||'状态不可用'}${data.mail?.attempts?' · 已尝试'+data.mail.attempts+'次':''}。邮件服务接受不代表已经送达。`;
  $('af-history').replaceChildren();if(data.history?.length){appendText($('af-history'),'h3','处理历史');for(const item of data.history)appendText($('af-history'),'p',`${feedbackDate(item.created_at)} · ${feedbackStates[item.status]}`,'dialog-note');}
  showFieldErrors(root,{},['af-reason','af-reply'],{focus:false});layout();
 }
 async function read(p,apply){
  if(working||pending)return;const ticket=epoch,s=++sequence;working=true;layout();note('正在读取反馈…');
  try{const data=await api.feedback(p);if(ticket!==epoch||s!==sequence)return;apply(data);note('');}
  catch(error){if(ticket===epoch&&s===sequence&&!invalid(error))note(error.message);}
  finally{if(ticket===epoch&&s===sequence){working=false;layout();}}
 }
 function load(){return read({op:'feedback-admin-list',page,status:filter,search},data=>{
  loaded=true;total=data.total;$('af-list').replaceChildren();
  for(const item of data.items){const b=appendText($('af-list'),'button','', 'message-card feedback-list-item');b.type='button';b.dataset.feedbackId=item.id;b.setAttribute('aria-pressed',String(row?.id===item.id));appendText(b,'strong',item.title);appendText(b,'small',`${categories[item.category]} · ${feedbackStates[item.status]} · ${feedbackDate(item.created_at)}`);appendText(b,'small',item.email);b.onclick=()=>select(item.id);}
  if(!data.items.length)appendText($('af-list'),'div','当前没有这类反馈。','account-feature-state');layout();
 });}
 async function discard(){const ticket=epoch;return !dirty || await confirm.ask('放弃当前未保存的处理内容？')&&ticket===epoch;}
 async function select(id){if(!await discard())return;read({op:'feedback-admin-get',id},fill);}
 async function write(p){
  if(working)return;const ticket=epoch;let committed=false;pending=p;working=true;layout();note('正在保存…');
  try{const result=await api.feedback(p);if(ticket!==epoch)return;pending=null;dirty=false;committed=true;row.revision=result.revision;if(p.op==='feedback-reply')$('af-reply').value='';
   const data=await api.feedback({op:'feedback-admin-get',id:p.id});if(ticket!==epoch)return;fill(data);note(p.op==='feedback-reply'?'回复已发送至成员收件箱。':p.op==='feedback-mail-retry'?'通知已重新排队。':'处理结果已保存。');loaded=false;
  }catch(error){if(ticket===epoch&&!invalid(error)){
    // Keep exactly the same write payload when its result is uncertain.
    if(committed){loaded=false;note('操作已保存，但详情刷新失败，请点击刷新反馈查看结果。');}
    else if(pending&&['NETWORK_ERROR','BACKEND_ERROR'].includes(error.code))note('操作结果尚未确认，请继续确认上次操作，不会创建新的回复。');
    else{pending=null;note(error.message);}
   }}finally{if(ticket===epoch){working=false;layout();}}
 }
 function payload(op,extra={}){return{op,id:row.id,requestId:crypto.randomUUID(),expectedRevision:row.revision,...extra};}
 $('af-process-form').onsubmit=e=>{e.preventDefault();if(!row||working||pending)return;const reason=$('af-reason').value.trim();if(!showFieldErrors(root,state==='closed'&&!reason?{'af-reason':'请填写关闭说明。'}:{},['af-reason']))return;write(payload('feedback-update',{status:state,reason,note:$('af-note').value}));};
 $('af-reply-form').onsubmit=async e=>{e.preventDefault();if(!row||working||pending)return;const body=$('af-reply').value.trim();if(!showFieldErrors(root,!body?{'af-reply':'请输入回复内容。'}:{},['af-reply']))return;
  const p=payload('feedback-reply',{body}),ticket=epoch;if(await confirm.ask('将这条回复发送至该成员的收件箱？')&&ticket===epoch)write(p);
 };
 $('af-mail-retry').onclick=async()=>{const unknown=row.mail.state==='uncertain',ticket=epoch,p=payload('feedback-mail-retry',{confirmUncertain:unknown});
  if(await confirm.ask(unknown?'上次发送可能已经完成。请先检查邮件服务记录；重新发送可能产生重复邮件，确认继续？':'将这条通知重新加入发送队列？请先确认邮件服务配置已恢复。')&&ticket===epoch)write(p);
 };
 for(const id of ['af-note','af-reason','af-reply'])$(id).oninput=()=>{dirty=true;if(id!=='af-note')showFieldErrors(root,{},[id],{focus:false});};
 root.querySelectorAll('[data-af-state]').forEach(b=>b.onclick=()=>{state=b.dataset.afState;dirty=true;layout();});
 root.querySelectorAll('[data-af-filter]').forEach(b=>b.onclick=async()=>{if(!await discard())return;dirty=false;filter=b.dataset.afFilter;page=1;row=null;load();});
 $('af-search-form').onsubmit=async e=>{e.preventDefault();if(!await discard())return;dirty=false;search=$('af-search').value.trim();page=1;row=null;load();};
 $('af-refresh').onclick=async()=>{if(!await discard())return;dirty=false;if(row)select(row.id);else load();};
 $('af-prev').onclick=async()=>{if(!await discard())return;dirty=false;row=null;page--;load();};$('af-next').onclick=async()=>{if(!await discard())return;dirty=false;row=null;page++;load();};$('af-retry').onclick=()=>pending&&write(pending);
 function clear(){++epoch;++sequence;loaded=false;working=false;pending=null;dirty=false;row=null;page=1;total=0;filter='all';search='';confirm.clear();root.querySelectorAll('input,textarea').forEach(e=>e.value='');$('af-list').replaceChildren();$('af-content').replaceChildren();$('af-member').textContent='';$('af-mail').textContent='';$('af-history').replaceChildren();note('');layout();}
 layout();return{show(){if(!loaded&&!working&&!pending&&!dirty)load();},hide(){confirm.clear();},clear,busy:()=>working||dirty||!!pending||confirm.open()};
}
