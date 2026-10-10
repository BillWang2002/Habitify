import {showFieldErrors} from './form-validation.js';
export const memberFields=['admin-edit-email','admin-edit-password','admin-edit-password-again','admin-edit-confirmation','admin-edit-balance','admin-edit-reason'];
export function memberFormErrors(mode,values,member){
 const errors={};
 if(mode==='create' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length>254))errors['admin-edit-email']='请输入有效邮箱。';
 if(['create','password'].includes(mode)){
  if(values.password.length<8 || values.password.length>128)errors['admin-edit-password']='密码需要8至128个字符。';
  if(values.passwordAgain!==values.password)errors['admin-edit-password-again']='两次输入的密码不一致。';
 }
 if(mode==='delete' && values.confirmation!==member?.email)errors['admin-edit-confirmation']='请重新输入完整成员邮箱，需完全一致。';
 if(mode==='coins'){
  if(!values.balance.trim() || !Number.isSafeInteger(Number(values.balance)) || Number(values.balance)<0 || Number(values.balance)>1000000)errors['admin-edit-balance']='请输入0至1000000之间的整数余额。';
  if(!values.reason.trim() || values.reason.trim().length>200)errors['admin-edit-reason']='请填写调整原因，最多200个字。';
 }
 return errors;
}
const field=(id,label,type='text',attrs='')=>`<label for="${id}">${label}</label><input id="${id}" type="${type}" ${attrs} aria-describedby="${id}-error"><p id="${id}-error" class="field-error" role="status" hidden></p>`;
export const memberDialogHtml=()=>`<dialog class="habit-dialog admin-member-dialog" data-edit-dialog aria-labelledby="admin-edit-title"><div class="dialog-heading"><h2 id="admin-edit-title" tabindex="-1" autofocus></h2><button data-edit-close type="button" aria-label="关闭成员操作">×</button></div><p data-edit-target class="dialog-note"></p><form data-edit-form novalidate><div data-email-field>${field('admin-edit-email','成员邮箱','email','maxlength="254" autocomplete="off" autocapitalize="none" spellcheck="false"')}</div><div data-password-fields>${field('admin-edit-password','新密码','password','minlength="8" maxlength="128" autocomplete="new-password"')}${field('admin-edit-password-again','再次输入密码','password','maxlength="128" autocomplete="new-password"')}<p class="dialog-note">密码不会在成员资料中显示。修改后原登录会话将失效。</p></div><div data-delete-fields><p class="admin-danger-note">此操作会永久删除账号、打卡、统计和金币数据，无法恢复。必要的后台操作记录会保留。</p>${field('admin-edit-confirmation','重新输入成员邮箱确认','email','maxlength="254" autocomplete="off" autocapitalize="none" spellcheck="false"')}</div><div data-coins-fields><p data-current-balance class="dialog-note"></p>${field('admin-edit-balance','调整后的金币余额','text','inputmode="numeric" maxlength="7"')}${field('admin-edit-reason','调整原因','text','maxlength="200"')}<p class="dialog-note">保留打卡奖励记录，另记管理员调整。后续打卡和撤销仍按规则增减；余额较低时撤回原奖励可能出现负余额。</p></div><p data-edit-message class="message" role="status"></p><button data-edit-submit class="primary" type="submit"></button></form></dialog>`;
export function createMemberEditor(root,{api,onSaved=()=>{},onInvalid=()=>{}}){
 const $=key=>root.querySelector(`[data-${key}]`),dialog=$('edit-dialog'),get=id=>root.querySelector('#'+id);
 let mode,member,requestId,epoch=0,writing=false,opener;
 const clearSecrets=()=>{get('admin-edit-password').value='';get('admin-edit-password-again').value='';};
 function close(force=false){if(writing && !force)return;dialog.close();clearSecrets();$('edit-form').reset();showFieldErrors(root,{},memberFields,{focus:false});++epoch;writing=false;requestId=null;if(opener?.isConnected)opener.focus({preventScroll:true});}
 function open(nextMode,nextMember=null,job=null){if(writing)return;mode=nextMode;member=nextMember;requestId=job?.requestId || crypto.randomUUID();opener=document.activeElement;++epoch;$('edit-form').reset();$('edit-message').textContent='';showFieldErrors(root,{},memberFields,{focus:false});
  const labels={create:'新增成员账号',password:'修改成员密码',delete:'永久删除成员账号',coins:'调整成员金币'};
  get('admin-edit-title').textContent=labels[mode];$('edit-target').textContent=member?.email || '由管理员创建账号，成员无需自行注册。';
  $('email-field').hidden=mode!=='create';$('password-fields').hidden=!['create','password'].includes(mode);$('delete-fields').hidden=mode!=='delete';$('coins-fields').hidden=mode!=='coins';
  get('admin-edit-email').value=job?.email || '';
  if(mode==='coins'){get('admin-edit-balance').value=String(member.balance);$('current-balance').textContent=`当前余额：${member.balance} 金币`;}
  $('edit-submit').textContent=mode==='delete' ? '确认永久删除' : '确认保存';$('edit-submit').classList.toggle('admin-danger-button',mode==='delete');$('edit-submit').disabled=false;$('edit-close').disabled=false;dialog.showModal();get('admin-edit-title').focus({preventScroll:true});
 }
 $('edit-close').onclick=()=>close();dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('edit-form').onsubmit=async event=>{event.preventDefault();if(writing)return;const values={email:get('admin-edit-email').value.trim().toLowerCase(),password:get('admin-edit-password').value,passwordAgain:get('admin-edit-password-again').value,confirmation:get('admin-edit-confirmation').value,balance:get('admin-edit-balance').value,reason:get('admin-edit-reason').value.trim()};
  if(!showFieldErrors(root,memberFormErrors(mode,values,member),memberFields))return;
  const ticket=epoch,payload={requestId,...(mode==='create' ? {email:values.email,password:values.password} : {memberId:member.id,...(mode==='password' ? {password:values.password} : mode==='delete' ? {confirmationEmail:values.confirmation} : {balance:Number(values.balance),expectedBalance:member.balance,reason:values.reason})})};
  writing=true;$('edit-submit').disabled=true;$('edit-close').disabled=true;$('edit-message').textContent='正在保存，请稍候…';
  try{const methods={create:'createMember',password:'changeMemberPassword',delete:'deleteMember',coins:'setMemberCoins'};const result=await api[methods[mode]](payload);if(ticket!==epoch)return;if(!result?.completed)throw new Error('操作结果未确认，请刷新后检查。');writing=false;close();onSaved(mode,member?.id,result);}
  catch(error){if(ticket!==epoch)return;if(!api.active()){writing=false;close();onInvalid(error);return;}$('edit-message').textContent=error.message;if(error.code==='BALANCE_CHANGED'){$('edit-message').textContent+='请关闭此窗口并重新选择成员。';}if(!['NETWORK_ERROR','ADMIN_WRITE_PENDING','ADMIN_WRITE_BUSY'].includes(error.code))requestId=crypto.randomUUID();}
  finally{if(ticket===epoch){writing=false;$('edit-submit').disabled=false;$('edit-close').disabled=false;clearSecrets();}}
 };
 return {open,clear(){close(true);$('edit-close').disabled=false;$('edit-submit').disabled=false;},busy:()=>writing || dialog.open};
}
