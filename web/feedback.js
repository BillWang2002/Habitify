import {accountHeader} from './account-header.js';
import {iconSvg} from './theme.js';
import {showFieldErrors} from './form-validation.js';
import {categories,feedbackStates,feedbackDate,appendText,renderFeedbackContent} from './feedback-shared.js';
export function feedbackHtml(){return `<section data-page="feedback" hidden>${accountHeader({group:'工具与账户',title:'意见反馈'})}
 <div id="feedback-main"><form id="feedback-form" class="detail-panel feedback-form" novalidate>
 <h2>分享你的想法</h2><p class="dialog-note">提交后可在下方查看进度，管理员回复会进入收件箱。每条反馈只提交一次，不支持追加说明。</p>
 <fieldset><legend>反馈分类</legend><div class="feedback-category">${Object.entries(categories).map(([id,label])=>`<button type="button" data-feedback-category="${id}" aria-pressed="${id==='bug'}">${label}</button>`).join('')}</div></fieldset>
 <label for="feedback-title">标题</label><input id="feedback-title" maxlength="80" placeholder="简要描述问题或建议" aria-describedby="feedback-title-error"><p id="feedback-title-error" class="field-error" role="status" hidden></p>
 <label for="feedback-body">正文</label><textarea id="feedback-body" maxlength="3000" rows="6" placeholder="例如：发生在哪个页面、操作步骤，以及你希望改善的地方" aria-describedby="feedback-body-error"></textarea><p id="feedback-body-error" class="field-error" role="status" hidden></p>
 <p class="dialog-note">最多3000字；图片附件后续开放。</p><button id="feedback-submit" type="submit" class="primary">提交反馈</button><button id="feedback-retry" type="button" hidden>继续确认上次提交</button></form>
 <div class="stats-heading feedback-heading"><h2>我的反馈</h2><button id="feedback-refresh" type="button" class="icon-action" aria-label="刷新我的反馈">${iconSvg('refresh')}</button></div><div id="feedback-list" class="message-list"></div>
 <div id="feedback-pager" class="message-pagination" hidden><button id="feedback-prev" type="button">上一页</button><span id="feedback-page"></span><button id="feedback-next" type="button">下一页</button></div></div>
 <p id="feedback-status" class="account-feedback" role="status" aria-live="polite"></p><section id="feedback-detail" class="detail-panel" hidden><button id="feedback-back" type="button" class="feedback-back">返回我的反馈</button><div id="feedback-content"></div></section></section>`;}
export function createFeedback(root,{request,preview=false,onOpen=null,onBack=null}={}){
 const $=id=>root.querySelector('#'+id);let owner=null,epoch=0,sequence=0,visible=false,working=false,reading=false,pending=null,category='bug',page=1,total=0,detail=null;
 let samples=[];
 const ids=['feedback-title','feedback-body'];
 const note=text=>$('feedback-status').textContent=text;
 function layout(){
  $('feedback-main').hidden=!!detail;$('feedback-detail').hidden=!detail;
  root.querySelectorAll('#feedback-form input,#feedback-form textarea,[data-feedback-category],#feedback-submit').forEach(el=>el.disabled=working||!!pending);
  root.querySelectorAll('#feedback-list button,#feedback-refresh,#feedback-prev,#feedback-next,#feedback-back').forEach(el=>el.disabled=working||reading||!!pending);
  $('feedback-retry').hidden=!pending||working;$('feedback-retry').disabled=working;
  $('feedback-pager').hidden=total<=20;$('feedback-prev').disabled=working||reading||!!pending||page<=1;$('feedback-next').disabled=working||reading||!!pending||page*20>=total;
  $('feedback-page').textContent=`${page} / ${Math.max(1,Math.ceil(total/20))}`;
  root.querySelectorAll('[data-feedback-category]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.feedbackCategory===category)));
 }
 async function send(p){
  if(!preview)return request(p);
  if(p.op==='feedback-submit'){let row=samples.find(x=>x.requestId===p.requestId);if(!row){row={id:crypto.randomUUID(),...p,status:'pending',created_at:new Date().toISOString(),replies:[]};samples.unshift(row);}return{id:row.id,submitted:true};}
  if(p.op==='feedback-get')return samples.find(x=>x.id===p.id);
  return{items:samples,total:samples.length,page:1,pageSize:20};
 }
 function renderList(items){
  $('feedback-list').replaceChildren();
  for(const row of items){const card=appendText($('feedback-list'),'button','', 'message-card feedback-list-item');card.type='button';appendText(card,'strong',row.title);appendText(card,'small',`${categories[row.category]} · ${feedbackStates[row.status]} · ${feedbackDate(row.created_at)}`);card.onclick=()=>onOpen?onOpen(row.id):show(row.id);}
  if(!items.length)appendText($('feedback-list'),'div','还没有反馈。你的建议会帮助我们继续改善。','account-feature-state');layout();
 }
 async function read(id=null){
  if(working||pending)return;
  const ticket=epoch,s=++sequence;reading=true;note('正在读取反馈…');layout();
  try{const data=await send(id?{op:'feedback-get',id}:{op:'feedback-list',page});if(ticket!==epoch||s!==sequence)return;
   if(id){detail=data;renderFeedbackContent($('feedback-content'),data);}else{total=data.total;renderList(data.items);}
   note(preview?'公开预览，反馈仅保存在本页，不发送邮件。':'');
  }catch(error){if(ticket===epoch&&s===sequence)note(error.message);}
  finally{if(ticket===epoch&&s===sequence){reading=false;layout();}}
 }
 async function submit(){
  if(working)return;const ticket=epoch;working=true;layout();note('正在提交反馈…');
  try{const result=await send(pending);if(ticket!==epoch)return;pending=null;$('feedback-form').reset();showFieldErrors(root,{},ids,{focus:false});working=false;note(preview?'预览提交完成，不发送邮件。':'反馈已提交，管理员会在后台查看。');
   if(visible){if(onOpen)onOpen(result.id);else show(result.id);}
  }catch(error){if(ticket===epoch){if(!['NETWORK_ERROR','BACKEND_ERROR'].includes(error.code))pending=null;note(['NETWORK_ERROR','BACKEND_ERROR'].includes(error.code)?'提交结果尚未确认，请继续确认上次提交；原内容已保留，不会重新生成反馈。':error.message);}}
  finally{if(ticket===epoch){working=false;layout();}}
 }
 $('feedback-form').onsubmit=e=>{e.preventDefault();if(working||pending)return;const title=$('feedback-title').value.trim(),body=$('feedback-body').value.trim(),errors={};
  if(!title||title.length>80)errors['feedback-title']='请输入1至80字的标题。';if(!body||body.length>3000)errors['feedback-body']='请输入1至3000字的正文。';if(!showFieldErrors(root,errors,ids))return;
  pending={op:'feedback-submit',requestId:crypto.randomUUID(),category,title,body};submit();
 };
 for(const id of ids)$(id).oninput=()=>showFieldErrors(root,{},[id],{focus:false});
 root.querySelectorAll('[data-feedback-category]').forEach(b=>b.onclick=()=>{category=b.dataset.feedbackCategory;layout();});
 $('feedback-retry').onclick=submit;$('feedback-refresh').onclick=()=>read();$('feedback-prev').onclick=()=>{page--;read();};$('feedback-next').onclick=()=>{page++;read();};$('feedback-back').onclick=()=>onBack?onBack():show();
 function show(id=null){visible=true;detail=id?{id}:null;$('feedback-content').replaceChildren();const back=root.querySelector('[data-page=feedback] .back-link');back.href=id?'#/feedback':'#/me';back.setAttribute('aria-label',id?'返回意见反馈':'返回我的');layout();read(id);}
 function clear(){++epoch;++sequence;working=false;reading=false;pending=null;owner=null;visible=false;detail=null;category='bug';page=1;total=0;samples=[];$('feedback-form').reset();showFieldErrors(root,{},ids,{focus:false});$('feedback-list').replaceChildren();$('feedback-content').replaceChildren();note('');layout();}
 return{enter(user){if(owner!==user.id){clear();owner=user.id;}},show,hide(){visible=false;++sequence;reading=false;layout();},clear,busy:()=>working||!!pending||ids.some(id=>$(id).value.trim())};
}
