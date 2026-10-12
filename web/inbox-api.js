const messages={LOGIN_REQUIRED:'登录状态已失效，请重新登录。',MESSAGE_NOT_FOUND:'消息已不可用，请刷新列表。',INVALID_REQUEST:'请检查消息操作后重试。',NETWORK_ERROR:'暂时无法连接收件箱，请重试。',BACKEND_ERROR:'收件箱暂不可用，请稍后重试。'};
export function createInboxApi(client,{url,key,fetcher=fetch}={}){
 return async payload=>{
  const {data,error}=await client.auth.getSession();if(error||!data.session?.access_token)throw Object.assign(new Error(messages.LOGIN_REQUIRED),{code:'LOGIN_REQUIRED'});
  let r,b;try{r=await fetcher(`${url}/functions/v1/habits`,{method:'POST',cache:'no-store',headers:{apikey:key,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});b=await r.json();}catch{throw Object.assign(new Error(messages.NETWORK_ERROR),{code:'NETWORK_ERROR'});}
  if(!r.ok||!Number.isSafeInteger(b.data?.unread)||b.data.unread<0)throw Object.assign(new Error(messages[b.code]||messages.BACKEND_ERROR),{code:b.code||'BACKEND_ERROR'});
  return b.data;
 };
}
