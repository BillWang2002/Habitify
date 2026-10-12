const messages={LOGIN_REQUIRED:'登录状态已失效，请重新登录。',FEEDBACK_NOT_FOUND:'这条反馈已不可用，请刷新列表。',FEEDBACK_RATE_LIMITED:'提交较频繁，请稍后再试。每60秒可提交一次，24小时内最多5次。',REQUEST_REUSED:'这次提交内容已变化，请继续确认原提交。',INVALID_REQUEST:'请检查反馈内容。',NETWORK_ERROR:'暂时无法连接反馈服务，请重试。',BACKEND_ERROR:'反馈服务暂不可用，请稍后再试。'};
export function createFeedbackApi(client,{url,key,fetcher=fetch}={}){
 return async payload=>{
  const {data,error}=await client.auth.getSession();
  if(error||!data.session?.access_token)throw Object.assign(new Error(messages.LOGIN_REQUIRED),{code:'LOGIN_REQUIRED'});
  let r,b;try{r=await fetcher(`${url}/functions/v1/habits`,{method:'POST',cache:'no-store',credentials:'omit',headers:{apikey:key,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});b=await r.json();}
  catch{throw Object.assign(new Error(messages.NETWORK_ERROR),{code:'NETWORK_ERROR'});}
  if(!r.ok||!b.data)throw Object.assign(new Error(messages[b.code]||messages.BACKEND_ERROR),{code:b.code||'BACKEND_ERROR'});
  return b.data;
 };
}
