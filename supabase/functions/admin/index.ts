import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createAdminHandler } from './handler.js';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await service.rpc(name,args);if(error)throw new Error(error.message);return data;}
Deno.serve(createAdminHandler({
 verifyRequester:async(token:string)=>{const {data,error}=await service.auth.getUser(token);return error ? null : data.user?.id;},
 reserveAttempt:(requester:string)=>rpc('admin_login_attempt',{p_requester:requester}),
 authenticate:async(identity:{adminId:string,email:string},password:string)=>{
  // A fresh server-only Auth client cannot overwrite the ordinary browser session.
  const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
  const {data,error}=await auth.auth.signInWithPassword({email:identity.email,password});
  if(error || !data.session)return false;
  const valid=data.user?.id===identity.adminId && !!data.user?.email_confirmed_at;
  // Dispose this temporary Auth session. Browser receives only our opaque, restricted grant.
  const {error:logoutError}=await auth.auth.signOut({scope:'local'});
  if(logoutError)throw new Error('BACKEND_ERROR');
  return valid;
 },
 issue:(requester:string,admin:string,hash:string)=>rpc('admin_session_open',{p_requester:requester,p_admin:admin,p_hash:hash}),
 check:(requester:string,hash:string)=>rpc('admin_session_check',{p_requester:requester,p_hash:hash}),
 close:(requester:string,hash:string)=>rpc('admin_session_close',{p_requester:requester,p_hash:hash}),
}));
