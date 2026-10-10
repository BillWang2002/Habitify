const codes={LOGIN_REQUIRED:401,ADMIN_PASSWORD_INVALID:401,ADMIN_SESSION_EXPIRED:401,ADMIN_FORBIDDEN:403,ADMIN_NOT_CONFIGURED:503,ADMIN_RATE_LIMITED:429,INVALID_REQUEST:422,MEMBER_NOT_FOUND:404,MEMBER_EXISTS:409,PASSWORD_POLICY:422,REQUEST_REUSED:409,ADMIN_WRITE_BUSY:409,ADMIN_WRITE_PENDING:503,BALANCE_CHANGED:409,DELETE_CONFIRMATION_REQUIRED:422};
export const tokenHash=async token=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const newToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function boundedBody(req) {
 const reader=req.body?.getReader(); if(!reader)throw new Error('INVALID_REQUEST');
 const chunks=[];let size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new Error('INVALID_REQUEST');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try {return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('INVALID_REQUEST');}
}
export function createAdminHandler({verifyRequester,reserveAttempt,authenticate,issue,check,close,members,memberStatistics,memberWrite,memberCoins,memberPending,origins=['https://billwang2002.github.io']}) {
 return async req=>{
  const origin=req.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-admin-session','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(origin && origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>Response.json(body,{status,headers});
  if(origin && !origins.includes(origin))return reply({code:'ADMIN_FORBIDDEN'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({code:'METHOD_NOT_ALLOWED'},405);
  try {
   const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))throw new Error('LOGIN_REQUIRED');
   const requester=await verifyRequester(authorization.slice(7));if(!requester)throw new Error('LOGIN_REQUIRED');
   const p=await boundedBody(req);if(!p || Array.isArray(p) || typeof p!=='object')throw new Error('INVALID_REQUEST');
   if(p.op==='login') {
    if(Object.keys(p).some(k=>!['op','password'].includes(k)) || typeof p.password!=='string' || !p.password || p.password.length>256)throw new Error('INVALID_REQUEST');
    const identity=await reserveAttempt(requester);if(identity?.code)throw new Error(identity.code);
    if(!identity?.adminId || !identity.email)throw new Error('ADMIN_NOT_CONFIGURED');
    if(requester!==identity.adminId)throw new Error('ADMIN_FORBIDDEN');
    if(!await authenticate(identity,p.password))throw new Error('ADMIN_PASSWORD_INVALID');
    const token=newToken(),data=await issue(requester,identity.adminId,await tokenHash(token));
    return reply({data:{sessionToken:token,expiresAt:data.expiresAt}});
   }
   const allowed={'member-pending':['op'],verify:['op'],logout:['op'],members:['op','page','search'],'member-statistics':['op','memberId'],'member-create':['op','requestId','email','password'],'member-password':['op','requestId','memberId','password'],'member-delete':['op','requestId','memberId','confirmationEmail'],'member-coins':['op','requestId','memberId','balance','expectedBalance','reason']};
   if(!Object.hasOwn(allowed,p.op) || Object.keys(p).some(k=>!allowed[p.op].includes(k)))throw new Error('INVALID_REQUEST');
   if(p.op==='members' && ((!Number.isInteger(p.page) || p.page<1 || p.page>100000) || typeof p.search!=='string' || p.search.length>100))throw new Error('INVALID_REQUEST');
   const uuid=v=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
   const writes=['member-create','member-password','member-delete','member-coins'];
   if(writes.includes(p.op)){
    if(!uuid(p.requestId) || (p.op!=='member-create' && !uuid(p.memberId)))throw new Error('INVALID_REQUEST');
    if(['member-create','member-password'].includes(p.op) && (typeof p.password!=='string' || p.password.length<8 || p.password.length>128))throw new Error('PASSWORD_POLICY');
    if(p.op==='member-create' && (typeof p.email!=='string' || p.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)))throw new Error('INVALID_REQUEST');
    if(p.op==='member-delete' && (typeof p.confirmationEmail!=='string' || p.confirmationEmail.length>254))throw new Error('DELETE_CONFIRMATION_REQUIRED');
    if(p.op==='member-coins' && (!Number.isSafeInteger(p.balance) || p.balance<0 || p.balance>1000000 || !Number.isSafeInteger(p.expectedBalance) || Math.abs(p.expectedBalance)>2147483647 || typeof p.reason!=='string' || !p.reason.trim() || p.reason.length>200))throw new Error('INVALID_REQUEST');
   }
   if(p.op==='member-statistics' && (typeof p.memberId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.memberId)))throw new Error('INVALID_REQUEST');
   const token=req.headers.get('X-Admin-Session');if(!token || !/^[0-9a-f]{64}$/.test(token))throw new Error('ADMIN_SESSION_EXPIRED');
   const hash=await tokenHash(token);
   const data=p.op==='members' ? await members(requester,hash,p.page,p.search) : p.op==='member-statistics' ? await memberStatistics(requester,hash,p.memberId) : p.op==='member-pending' ? await memberPending(requester,hash) : p.op==='member-coins' ? await memberCoins(requester,hash,p) : writes.includes(p.op) ? await memberWrite(requester,hash,p) : p.op==='logout' ? await close(requester,hash) : await check(requester,hash);
   return reply({data});
  } catch(error){const code=Object.hasOwn(codes,error?.message) ? error.message : 'BACKEND_ERROR';return reply({code},codes[code] || 503);}
 };
}
