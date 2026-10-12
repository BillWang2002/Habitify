export const categories={bug:'问题反馈',idea:'功能建议',other:'其他'};
export const feedbackStates={pending:'待处理',processing:'处理中',resolved:'已解决',closed:'已关闭'};
export const feedbackDate=value=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function appendText(root,tag,text,className=''){
 const element=root.ownerDocument.createElement(tag);element.textContent=text;if(className)element.className=className;root.append(element);return element;
}
export function renderFeedbackContent(root,row){
 root.replaceChildren();appendText(root,'h2',row.title);appendText(root,'p',`${categories[row.category]} · ${feedbackStates[row.status]} · ${feedbackDate(row.created_at)}`,'dialog-note');
 appendText(root,'p',row.body,'feedback-text');
 if(row.close_reason)appendText(root,'p','关闭说明：'+row.close_reason,'feedback-text');
 appendText(root,'h3','管理员回复');
 if(!row.replies?.length)appendText(root,'p','暂时没有回复。','dialog-note');
 for(const reply of row.replies||[]){const section=root.ownerDocument.createElement('article');section.className='feedback-reply';appendText(section,'p',feedbackDate(reply.created_at),'dialog-note');appendText(section,'p',reply.body,'feedback-text');root.append(section);}
}
