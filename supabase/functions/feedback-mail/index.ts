import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createFeedbackMailHandler,authorizeWorkerKey} from './handler.js';
const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await service.rpc(name,args);if(error)throw new Error('MAIL_WORKER_ERROR');return data;}
Deno.serve(createFeedbackMailHandler({
 authorize:(header:string|null)=>authorizeWorkerKey(header,Deno.env.get('FEEDBACK_MAIL_WORKER_KEY')),
 config:()=>({serviceId:Deno.env.get('EMAILJS_SERVICE_ID'),templateId:Deno.env.get('EMAILJS_TEMPLATE_ID'),publicKey:Deno.env.get('EMAILJS_PUBLIC_KEY'),privateKey:Deno.env.get('EMAILJS_PRIVATE_KEY'),recipient:Deno.env.get('ADMIN_NOTIFICATION_EMAIL')}),
 claim:(limit:number)=>rpc('feedback_mail_claim',{p_limit:limit}),
 finish:(id:string,lease:string,result:string,error:string|null)=>rpc('feedback_mail_finish',{p_id:id,p_lease:lease,p_result:result,p_error:error})
}));
