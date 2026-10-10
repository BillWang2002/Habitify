import { createAdminMembers } from './admin-members.js';
import { accountHeader } from './account-header.js';
import { showFieldErrors } from './form-validation.js';
import { iconSvg } from './theme.js';
const tasks=[['overview','概览','target'],['members','成员','me'],['announcements','公告','inbox'],['feedback','反馈','feedback'],['audit','记录','code']];
export function adminPageHtml(){return `<section data-page="admin-login" id="admin-page" hidden>${accountHeader({group:'后台管理',title:'开发人员登录',parent:'developer',parentLabel:'开发者模式'})}<div class="admin-login-card" id="admin-login-view"><span class="account-feature-icon" aria-hidden="true">${iconSvg('shield')}</span><h2>进入后台管理</h2><p class="dialog-note">请先以管理员账户登录应用，再输入后台密码。</p><form id="admin-login-form" novalidate><label for="admin-password">后台密码</label><div class="password-field"><input id="admin-password" type="password" maxlength="256" autocomplete="off" aria-describedby="admin-password-error" placeholder="请输入后台密码"><button id="admin-password-toggle" type="button" aria-label="显示后台密码" aria-pressed="false">显示</button></div><p id="admin-password-error" class="field-error" role="status" hidden></p><p id="admin-login-message" class="message" role="status"></p><button id="admin-submit" class="primary" type="submit">进入后台</button></form><p class="dialog-note">仅管理员账户可以进入；后台会话独立，刷新后需重新验证。</p></div></section>
<section data-page="admin" id="admin-workspace" hidden><header class="admin-workspace-header">${accountHeader({group:'独立管理空间',title:'后台管理',parent:'developer',parentLabel:'开发者模式'})}</header><div class="admin-shell"><nav class="admin-nav" aria-label="后台任务"><span class="admin-nav-slider" aria-hidden="true"></span>${tasks.map(([id,label,icon])=>`<a href="#/admin/${id}" data-admin-task="${id}"><span aria-hidden="true">${iconSvg(icon)}</span>${label}</a>`).join('')}</nav><div class="admin-content"><section id="admin-overview" hidden><div class="page-title"><div><p class="date-label">后台管理</p><h1>概览</h1></div></div><section class="detail-panel admin-session-card"><span class="account-feature-icon" aria-hidden="true">${iconSvg('shield')}</span><h2>管理员身份已确认</h2><p id="admin-expiry" class="dialog-note"></p><p class="dialog-note">成员账户管理与打卡统计已接入。</p><button id="admin-check" type="button">检查后台连接</button><p id="admin-check-message" class="account-feedback" role="status"></p></section></section><section id="admin-members-view" hidden><div class="page-title"><div><p class="date-label">后台管理</p><h1>成员</h1></div></div><div id="admin-members-root"></div></section><section id="admin-pending" hidden><div class="page-title"><div><p class="date-label">后台管理</p><h1 id="admin-pending-title"></h1></div></div><div class="module-intro"><span aria-hidden="true">${iconSvg('shield')}</span><h2>后续接入</h2><p id="admin-pending-note"></p></div></section></div></div></section>`;}
export function createAdminPage(root,{api,preview=false,onNavigate=()=>{},onExitMessage=()=>{}}={}) {
 const $=id=>root.querySelector('#'+id);let visible=false,task=null;const members=createAdminMembers($('admin-members-root'),{api,onInvalid:error=>{render();$('admin-login-message').textContent=error.message;}});let epoch=0,busy=false,expiry=0,expiryTimer;
 function resetPassword(){ $('admin-password').value='';$('admin-password').type='password';$('admin-password-toggle').textContent='显示';$('admin-password-toggle').setAttribute('aria-pressed','false');$('admin-password-toggle').setAttribute('aria-label','显示后台密码');}
 function render(){const active=!!api?.active();if(active && visible && task==='members')members.show();else members.hide();
  $('admin-overview').hidden=!active || task!=='overview';$('admin-members-view').hidden=!active || task!=='members';$('admin-pending').hidden=!active || !['announcements','feedback','audit'].includes(task);
  root.querySelector('.admin-nav').style.setProperty('--admin-index',Math.max(0,tasks.findIndex(t=>t[0]===task)));
  root.querySelectorAll('[data-admin-task]').forEach(link=>{if(link.dataset.adminTask===task)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  $('admin-pending-title').textContent=tasks.find(t=>t[0]===task)?.[1] || '';
  $('admin-pending-note').textContent={announcements:'公告草稿、发布与收件箱投递将在下一阶段接入。',feedback:'成员反馈处理与回复将在后续接入。',audit:'访问已在服务端记录，操作记录查看页面将在后续接入。'}[task] || '';
  if(active)$('admin-expiry').textContent=`本次后台会话有效至 ${new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date(expiry))}，退出不会影响普通打卡登录。`;
  if(!active && task && visible){task=null;onNavigate('admin-login',{replace:true});}
 }
 function expire(){api?.clear();expiry=0;render();$('admin-login-message').textContent='后台会话已到期，请重新输入密码。';}
 function setBusy(value){busy=value;$('admin-submit').disabled=value;$('admin-check').disabled=value;$('admin-submit').textContent=value ? '正在确认管理员身份…' : '进入后台';}
 $('admin-password-toggle').onclick=()=>{const visible=$('admin-password').type==='password';$('admin-password').type=visible ? 'text' : 'password';$('admin-password-toggle').textContent=visible ? '隐藏' : '显示';$('admin-password-toggle').setAttribute('aria-pressed',String(visible));$('admin-password-toggle').setAttribute('aria-label',visible ? '隐藏后台密码' : '显示后台密码');};
 $('admin-password').oninput=()=>showFieldErrors(root,{},['admin-password'],{focus:false});
 $('admin-login-form').onsubmit=async event=>{event.preventDefault();if(busy)return;const password=$('admin-password').value;if(!showFieldErrors(root,password ? {} : {'admin-password':'请输入后台密码。'},['admin-password']))return;
  if(preview || !api){resetPassword();$('admin-login-message').textContent='公开预览不提交后台密码，请登录正式应用后使用。';return;}
  const ticket=epoch;setBusy(true);$('admin-login-message').textContent='';
  try{const result=await api.login(password);if(ticket!==epoch)return;expiry=Date.parse(result.expiresAt);clearTimeout(expiryTimer);expiryTimer=setTimeout(expire,Math.max(0,expiry-Date.now()));if(visible)onNavigate('admin/members');render();}
  catch(error){if(ticket!==epoch)return;if(error.code==='ADMIN_PASSWORD_INVALID')showFieldErrors(root,{'admin-password':error.message},['admin-password'],{focus:false});else $('admin-login-message').textContent=error.message;}
  finally{if(ticket===epoch){resetPassword();setBusy(false);}}
 };
 $('admin-check').onclick=async()=>{if(busy)return;const ticket=epoch;setBusy(true);$('admin-check-message').textContent='正在确认后台连接…';try{await api.verify();if(ticket===epoch)$('admin-check-message').textContent='后台身份与会话校验通过。';}catch(error){if(ticket===epoch){render();const id=api.active() ? 'admin-check-message' : 'admin-login-message';$(id).textContent=error.message;}}finally{if(ticket===epoch)setBusy(false);}};
 const exitLink=root.querySelector('#admin-workspace .back-link');
 exitLink.setAttribute('aria-label','退出后台并返回开发者模式');
 exitLink.onclick=async event=>{
  event.preventDefault();++epoch;clearTimeout(expiryTimer);expiry=0;visible=false;task=null;members.clear();resetPassword();setBusy(false);
  // logout clears the in-memory grant synchronously; ordinary Auth remains untouched.
  const revoked=api.logout();onNavigate('developer',{replace:true});
  const result=await revoked;if(result?.revoked===false)onExitMessage('已退出当前设备后台，服务端撤销未确认，原会话将在到期后失效。');
 };
 return {
  show(nextTask=null){visible=true;task=nextTask;if(expiry && expiry<=Date.now())expire();else render();},
  clear(){visible=false;task=null;members.clear();++epoch;clearTimeout(expiryTimer);api?.clear();expiry=0;resetPassword();showFieldErrors(root,{},['admin-password'],{focus:false});$('admin-login-message').textContent='';$('admin-check-message').textContent='';setBusy(false);render();},
  hide(){visible=false;members.hide();resetPassword();},
  busy:()=>busy || members.busy()
 };
}
