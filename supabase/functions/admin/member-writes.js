// Auth writes are separate from PostgreSQL transactions. Journal first; never retain a password.
export function createMemberWriter({begin,finish,fingerprint,auth}) {
 return async (requester,hash,p)=>{
  const execution=crypto.randomUUID();
  const stamp=await fingerprint(JSON.stringify(Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]]))));
  const args={requester,hash,requestId:p.requestId,fingerprint:stamp,execution,operation:p.op,memberId:p.memberId || null,email:p.email || '',confirmation:p.confirmationEmail || ''};
  const job=await begin(args);
  if(job.result)return job.result;
  try {
   if(p.op==='member-create'){
    const existing=await auth.get(job.targetId);
    if(!existing)await auth.create({id:job.targetId,email:p.email,password:p.password,email_confirm:true,app_metadata:{habitify_created_request:p.requestId}});
    else if(existing.app_metadata?.habitify_created_request!==p.requestId || existing.email?.toLowerCase()!==p.email.toLowerCase())throw new Error('MEMBER_EXISTS');
   } else if(p.op==='member-password')await auth.update(job.targetId,{password:p.password});
   else if(p.op==='member-delete'){if(await auth.get(job.targetId))await auth.delete(job.targetId);}
   else throw new Error('INVALID_REQUEST');
  } catch(error) {
   // Known rejection has no side effect. Timeouts/unknown errors remain pending for reconciliation.
   if(['MEMBER_EXISTS','PASSWORD_POLICY','MEMBER_NOT_FOUND','INVALID_REQUEST'].includes(error?.message)){
    try{await finish({...args,success:false,errorCode:error.message});}catch{throw new Error('ADMIN_WRITE_PENDING');}throw error;
   }
   throw new Error('ADMIN_WRITE_PENDING');
  }
  try{return await finish({...args,success:true,errorCode:null});}catch{throw new Error('ADMIN_WRITE_PENDING');}
 };
}
