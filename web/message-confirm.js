export function createMessageConfirm(root){
 const document=root.ownerDocument;
 const dialog=document.createElement('dialog');dialog.className='habit-dialog';dialog.setAttribute('aria-label','确认操作');dialog.innerHTML='<div class="dialog-heading"><h2 tabindex="-1" autofocus>确认操作</h2><button type="button" aria-label="关闭确认">×</button></div><p class="dialog-note"></p><div class="message-confirm-actions"><button type="button" class="secondary">取消</button><button type="button" class="primary">确认</button></div>';root.append(dialog);let resolve;
 const finish=value=>{dialog.close();resolve?.(value);resolve=null;};
 dialog.querySelector('.dialog-heading button').onclick=()=>finish(false);dialog.querySelector('.secondary').onclick=()=>finish(false);dialog.querySelector('.primary').onclick=()=>finish(true);dialog.addEventListener('cancel',()=>finish(false));
 return {ask(text){if(resolve)return Promise.resolve(false);dialog.querySelector('p').textContent=text;dialog.showModal();return new Promise(r=>resolve=r);},clear(){finish(false);},open:()=>dialog.open};
}
