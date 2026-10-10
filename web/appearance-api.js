export function createAppearanceApi(client,{url,key,fetcher=fetch}={}){
 return async payload=>{
  const {data,error}=await client.auth.getSession();if(error||!data.session?.access_token)throw Object.assign(new Error('登录状态已失效，请重新登录。'),{code:'LOGIN_REQUIRED'});
  let response,result;try{response=await fetcher(`${url}/functions/v1/habits`,{method:'POST',cache:'no-store',headers:{apikey:key,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});result=await response.json();}catch{throw Object.assign(new Error('暂时无法连接，尚未确认保存。请重试原操作。'),{code:'NETWORK_ERROR'});}
  if(!response.ok||!result.data||!Number.isSafeInteger(result.data.revision))throw Object.assign(new Error(result.code==='STALE_DATA'?'另一台设备已更换外观，请重新读取后再应用。':result.code==='LOGIN_REQUIRED'?'登录状态已失效，请重新登录。':'外观暂时无法保存，请稍后重试。'),{code:result.code||'BACKEND_ERROR'});
  return result.data;
 };
}
