import { createAdminMembers } from './admin-members.js';
import { accountHeader } from './account-header.js';
import { showFieldErrors } from './form-validation.js';
import { iconSvg } from './theme.js';
export function adminPageHtml(){return `<section data-page="admin-login" id="admin-page" hidden>${accountHeader({group:'后台管理',title:'开发人员登录',parent:'developer',parentLabel:'开发者模式'})}<div class="admin-login-card" id="admin-login-view"><span class="account-feature-icon" aria-hidden="true">${iconSvg('shield')}</span><h2>进入后台管理</h2><p class="dialog-note">输入后台密码，确认管理员身份。</p><form id="admin-login-form" novalidate><label for="admin-password">后台密码</label><div class="password-field"><input id="admin-password" type="password" maxlength="256" autocomplete="off" aria-describedby="admin-password-error" placeholder="请输入后台密码"><button id="admin-password-toggle" type="button" aria-label="显示后台密码" aria-pressed="false">显示</button></div><p id="admin-password-error" class="field-error" role="status" hidden></p><p id="admin-login-message" class="message" role="status"></p><button id="admin-submit" class="primary" type="submit">进入后台</button></form><p class="dialog-note">后台会话独立于当前打卡账户，刷新后需重新验证。</p></div><div id="admin-verified-view" hidden><section class="detail-panel admin-session-card"><span class="account-feature-icon" aria-hidden="true">${iconSvg('shield')}</span><h2>管理员身份已确认</h2><p id="admin-expiry" class="dialog-note"></p><p class="dialog-note">可只读查看成员账户与打卡统计，成员管理、公告和反馈将在后续接入。</p><div class="admin-session-actions"><button id="admin-check" type="button">检查后台连接</button><button id="admin-logout" type="button">退出后台</button></div><p id="admin-check-message" class="message" role="status"></p></section><div id="admin-members-root"></div></div></section>`;}
export function createAdminPage(root,{api,preview=false}={}) {
 const $=id=>root.querySelector('#'+id);let visible=false;const members=createAdminMembers($('admin-members-root'),{api,onInvalid:error=>{render();$('admin-login-message').textContent=error.message;}});let epoch=0,busy=false,expiry=0,expiryTimer;
 function resetPassword(){ $('admin-password').value='';$('admin-password').type='password';$('admin-password-toggle').textContent='显示';$('admin-password-toggle').setAttribute('aria-pressed','false');$('admin-password-toggle').setAttribute('aria-label','显示后台密码');}
 function render(){const active=!!api?.active();if(active && visible)members.show();else members.hide();$('admin-login-view').hidden=active;$('admin-verified-view').hidden=!active;if(active)$('admin-expiry').textContent=`本次后台会话有效至 ${new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date(expiry))}，退出不会影响普通打卡登录。`;}
 function expire(){api?.clear();expiry=0;render();$('admin-login-message').textContent='后台会话已到期，请重新输入密码。';}
 function setBusy(value){busy=value;$('admin-submit').disabled=value;$('admin-check').disabled=value;$('admin-logout').disabled=value;$('admin-submit').textContent=value ? '正在确认管理员身份…' : '进入后台';}
 $('admin-password-toggle').onclick=()=>{const visible=$('admin-password').type==='password';$('admin-password').type=visible ? 'text' : 'password';$('admin-password-toggle').textContent=visible ? '隐藏' : '显示';$('admin-password-toggle').setAttribute('aria-pressed',String(visible));$('admin-password-toggle').setAttribute('aria-label',visible ? '隐藏后台密码' : '显示后台密码');};
 $('admin-password').oninput=()=>showFieldErrors(root,{},['admin-password'],{focus:false});
 $('admin-login-form').onsubmit=async event=>{event.preventDefault();if(busy)return;const password=$('admin-password').value;if(!showFieldErrors(root,password ? {} : {'admin-password':'请输入后台密码。'},['admin-password']))return;
  if(preview || !api){resetPassword();$('admin-login-message').textContent='公开预览不提交后台密码，请登录正式应用后使用。';return;}
  const ticket=epoch;setBusy(true);$('admin-login-message').textContent='';
  try{const result=await api.login(password);if(ticket!==epoch)return;expiry=Date.parse(result.expiresAt);clearTimeout(expiryTimer);expiryTimer=setTimeout(expire,Math.max(0,expiry-Date.now()));render();}
  catch(error){if(ticket!==epoch)return;if(error.code==='ADMIN_PASSWORD_INVALID')showFieldErrors(root,{'admin-password':error.message},['admin-password'],{focus:false});else $('admin-login-message').textContent=error.message;}
  finally{if(ticket===epoch){resetPassword();setBusy(false);}}
 };
 $('admin-check').onclick=async()=>{if(busy)return;const ticket=epoch;setBusy(true);$('admin-check-message').textContent='正在确认后台连接…';try{await api.verify();if(ticket===epoch)$('admin-check-message').textContent='后台身份与会话校验通过。';}catch(error){if(ticket===epoch){render();const id=api.active() ? 'admin-check-message' : 'admin-login-message';$(id).textContent=error.message;}}finally{if(ticket===epoch)setBusy(false);}};
 $('admin-logout').onclick=async()=>{if(busy)return;const ticket=epoch;setBusy(true);try{const result=await api.logout();if(ticket===epoch){clearTimeout(expiryTimer);expiry=0;render();$('admin-login-message').textContent=result?.revoked===false ? '当前设备已退出后台；服务端撤销未确认，原会话将在到期后失效。' : '已退出后台，普通打卡登录保持。';}}finally{if(ticket===epoch)setBusy(false);}};
 return {
  show(){visible=true;if(expiry && expiry<=Date.now())expire();else render();},
  clear(){visible=false;members.clear();++epoch;clearTimeout(expiryTimer);api?.clear();expiry=0;resetPassword();showFieldErrors(root,{},['admin-password'],{focus:false});$('admin-login-message').textContent='';$('admin-check-message').textContent='';setBusy(false);render();},
  hide(){visible=false;members.hide();resetPassword();},
  busy:()=>busy
 };
}
