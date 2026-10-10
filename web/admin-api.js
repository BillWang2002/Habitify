const messages={LOGIN_REQUIRED:'请先在应用中登录管理员账户，再进入后台。',ADMIN_PASSWORD_INVALID:'后台密码不正确，请重新输入。',ADMIN_SESSION_EXPIRED:'后台会话已失效，请重新输入密码。',ADMIN_FORBIDDEN:'当前账户没有后台权限，请使用管理员账户登录。',ADMIN_NOT_CONFIGURED:'后台尚未完成配置，请稍后再试。',ADMIN_RATE_LIMITED:'尝试次数较多，请稍后再试。',MEMBER_NOT_FOUND:'该成员已不可用，请刷新列表。',INVALID_REQUEST:'请检查填写内容。',NETWORK_ERROR:'暂时无法连接后台，请检查网络后重试。',BACKEND_ERROR:'后台服务暂不可用，请稍后再试。',ADMIN_CANCELLED:'后台请求已取消。'};
const failure=code=>Object.assign(new Error(messages[code] || messages.BACKEND_ERROR),{code});
export function createAdminApi(client,{url,key,fetcher=fetch,now=()=>Date.now()}={}) {
 let token=null,expiry=0,epoch=0;
 const active=()=>!!token && expiry>now();
 async function send(op,payload={},grant=token) {
  const {data,error}=await client.auth.getSession();
  if(error || !data.session?.access_token)throw failure('LOGIN_REQUIRED');
  let response;try {response=await fetcher(`${url}/functions/v1/admin`,{method:'POST',cache:'no-store',credentials:'omit',headers:{apikey:key,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json',...(grant ? {'X-Admin-Session':grant} : {})},body:JSON.stringify({op,...payload}),signal:AbortSignal.timeout(20000)});}catch{throw failure('NETWORK_ERROR');}
  let body;try{body=await response.json();}catch{throw failure('BACKEND_ERROR');}
  if(!response.ok || !body.data)throw failure(body.code || 'BACKEND_ERROR');
  return body.data;
 }
 async function read(op,payload){
  if(!active()){token=null;expiry=0;throw failure('ADMIN_SESSION_EXPIRED');}
  const ticket=epoch;
  try{const data=await send(op,payload);if(ticket!==epoch)throw failure('ADMIN_CANCELLED');return data;}
  catch(error){if(ticket===epoch && ['LOGIN_REQUIRED','ADMIN_SESSION_EXPIRED','ADMIN_FORBIDDEN'].includes(error.code)){token=null;expiry=0;}throw error;}
 }
 async function revoke(grant){if(!grant)return true;try{await send('logout',{},grant);return true;}catch{return false;}}
 return {
  active,
  async login(password) {
   const ticket=++epoch;const old=token;token=null;expiry=0;await revoke(old);
   if(ticket!==epoch)throw failure('ADMIN_CANCELLED');
   const result=await send('login',{password},null);
   if(ticket!==epoch){await revoke(result.sessionToken);throw failure('ADMIN_CANCELLED');}
   const until=Date.parse(result.expiresAt);
   if(!/^[0-9a-f]{64}$/.test(result.sessionToken) || !Number.isFinite(until) || until<=now()){await revoke(result.sessionToken);throw failure('BACKEND_ERROR');}
   token=result.sessionToken;expiry=until;
   // No credential, administrator email, or Supabase Auth JWT leaves this module.
   return {expiresAt:result.expiresAt};
  },
  members:(page=1,search='')=>read('members',{page,search}),
  memberStatistics:memberId=>read('member-statistics',{memberId}),
  async verify() {
   if(!active()){token=null;expiry=0;throw failure('ADMIN_SESSION_EXPIRED');}
   const ticket=epoch;
   try {const result=await send('verify');if(ticket!==epoch)throw failure('ADMIN_CANCELLED');return result;}
   catch(error){if(ticket===epoch && ['LOGIN_REQUIRED','ADMIN_SESSION_EXPIRED','ADMIN_FORBIDDEN'].includes(error.code)){token=null;expiry=0;}throw error;}
  },
  async logout(){const grant=token;++epoch;token=null;expiry=0;return {revoked:await revoke(grant)};},
  clear(){const grant=token;++epoch;token=null;expiry=0;void revoke(grant);}
 };
}
