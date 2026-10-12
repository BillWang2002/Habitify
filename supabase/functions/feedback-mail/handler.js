const response = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function authorizeWorkerKey(header,key){
 if(!key || !/^[0-9a-f]{64}$/.test(key) || !header?.startsWith('Bearer '))return false;
 const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const a=await hash(header.slice(7)),b=await hash(key);let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export function createFeedbackMailHandler({authorize, config, claim, finish, fetcher=fetch}) {
 return async request => {
  if(request.method!=='POST')return response({code:'METHOD_NOT_ALLOWED'},405);
  if(!await authorize(request.headers.get('Authorization')))return response({code:'WORKER_FORBIDDEN'},401);
  const c=config();
  if(!c?.serviceId || !c.templateId || !c.publicKey || !c.privateKey || !c.recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.recipient))return response({code:'EMAIL_NOT_CONFIGURED'},503);
  try {
   // One request per run: EmailJS has a 1 request/second API limit.
   const tasks=await claim(1); let processed=0;
   for(const task of tasks){
    let result='uncertain',error='RESULT_UNKNOWN';
    try{
     const sent=await fetcher('https://api.emailjs.com/api/v1.0/email/send',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),
      body:JSON.stringify({service_id:c.serviceId,template_id:c.templateId,user_id:c.publicKey,accessToken:c.privateKey,
       template_params:{to_email:c.recipient,feedback_id:task.feedbackId,feedback_category:escape({bug:'问题反馈',idea:'功能建议',other:'其他'}[task.category]||'其他'),feedback_title:escape(task.title),feedback_summary:escape(task.summary),feedback_created_at:escape(task.createdAt),admin_url:'https://billwang2002.github.io/Habitify/#/admin/feedback'}})
     });
     // Do not persist provider error bodies: they may contain credentials or member text.
     if(sent.ok){result='accepted';error=null;}
     else if(sent.status===429){result='retry';error='RATE_LIMITED';}
     else if(sent.status>=400 && sent.status<500){result='failed';error='REJECTED';}
    }catch{/* Sending may have completed before the response was lost. Manual confirmation only. */}
    await finish(task.id,task.leaseId,result,error);processed++;
   }
   return response({processed});
  }catch{return response({code:'MAIL_WORKER_ERROR'},503);}
 };
}
