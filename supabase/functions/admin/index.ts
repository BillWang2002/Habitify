import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createMemberWriter } from './member-writes.js';
import { createAdminHandler } from './handler.js';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await service.rpc(name,args);if(error)throw new Error(error.message);return data;}
const writeMember=createMemberWriter({
 begin:(a:any)=>rpc('admin_member_write_begin',{p_requester:a.requester,p_hash:a.hash,p_request:a.requestId,p_fingerprint:a.fingerprint,p_execution:a.execution,p_op:a.operation,p_member:a.memberId,p_email:a.email,p_confirmation:a.confirmation}),
 finish:(a:any)=>rpc('admin_member_write_finish',{p_requester:a.requester,p_request:a.requestId,p_execution:a.execution,p_success:a.success,p_error:a.errorCode}),
 fingerprint:async(value:string)=>{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 },
 auth:{
  get:async(id:string)=>{const {data,error}=await service.auth.admin.getUserById(id);if(error){if(error.status===404)return null;throw new Error('ADMIN_WRITE_PENDING');}return data.user;},
  create:async(a:any)=>{const {error}=await service.auth.admin.createUser(a);if(error)throw new Error(error.code==='email_exists' || error.code==='user_already_exists' ? 'MEMBER_EXISTS' : error.code==='weak_password' ? 'PASSWORD_POLICY' : ['email_address_invalid','validation_failed'].includes(error.code || '') ? 'INVALID_REQUEST' : 'ADMIN_WRITE_PENDING');},
  update:async(id:string,a:any)=>{const {error}=await service.auth.admin.updateUserById(id,a);if(error)throw new Error(error.status===404 ? 'MEMBER_NOT_FOUND' : error.code==='weak_password' ? 'PASSWORD_POLICY' : ['email_address_invalid','validation_failed'].includes(error.code || '') ? 'INVALID_REQUEST' : 'ADMIN_WRITE_PENDING');},
  delete:async(id:string)=>{const {error}=await service.auth.admin.deleteUser(id);if(error && error.status!==404)throw new Error('ADMIN_WRITE_PENDING');}
 }
});
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
 members:(requester:string,hash:string,page:number,search:string)=>rpc('admin_members',{p_requester:requester,p_hash:hash,p_page:page,p_search:search}),
 memberWrite:writeMember,
 memberPending:(requester:string,hash:string)=>rpc('admin_member_pending',{p_requester:requester,p_hash:hash}),
 memberCoins:(requester:string,hash:string,p:any)=>rpc('admin_member_coins',{p_requester:requester,p_hash:hash,p_request:p.requestId,p_member:p.memberId,p_balance:p.balance,p_expected:p.expectedBalance,p_reason:p.reason}),
 memberStatistics:(requester:string,hash:string,member:string)=>rpc('admin_member_statistics',{p_requester:requester,p_hash:hash,p_member:member}),
 check:(requester:string,hash:string)=>rpc('admin_session_check',{p_requester:requester,p_hash:hash}),
 close:(requester:string,hash:string)=>rpc('admin_session_close',{p_requester:requester,p_hash:hash}),
}));
