const messages = {
 LOGIN_REQUIRED: '登录状态已失效，请重新登录。', STALE_DATA: '其他设备已修改记录，已刷新数据，请重新操作。',
 TODAY_CHANGED: '日期已经变化，已刷新今天的记录，请重新操作。',
 HABIT_NOT_FOUND: '习惯已不存在，请刷新后重试。', HABIT_ARCHIVED: '请先恢复该习惯。',
 RESTORE_EXPIRED: '撤回时间已过，无法恢复该习惯。', HABIT_LIMIT: '最多保留 100 个习惯，请先整理现有习惯。',
 INVALID_REQUEST: '填写内容不符合要求，请检查后重试。', INVALID_PROGRESS: '请输入 0 到目标之间的整数。',
 NETWORK_ERROR: '暂时无法连接，未确认保存。请重试原操作。', BACKEND_ERROR: '习惯服务暂不可用，请稍后重试。',
 REQUEST_REUSED: '请求编号冲突，请刷新后重试。', INVALID_TIMEZONE: '无法识别账户时区，请联系管理员。'
};
export function apiError(code) { const error=new Error(messages[code] || messages.BACKEND_ERROR); error.code=code; return error; }
export function createHabitsApi(client, { fetcher=fetch, url, key, timezone=Intl.DateTimeFormat().resolvedOptions().timeZone }={}) {
 return async function request(payload) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw apiError('LOGIN_REQUIRED');
  const body=JSON.stringify({...payload,timezone});
  // Retrying a write preserves its request UUID and original payload.
  for(let attempt=0;attempt<2;attempt++) {
   let response;
   try { response=await fetcher(`${url}/functions/v1/habits`, {method:'POST',cache:'no-store',headers:{apikey:key,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(20000)}); }
   catch { if(attempt===0) continue; throw apiError('NETWORK_ERROR'); }
   let result;
   try { result=await response.json(); } catch { throw apiError('BACKEND_ERROR'); }
   if (!response.ok || !result.data) throw apiError(result.code || 'BACKEND_ERROR');
   if (!Array.isArray(result.data.habits) || !Array.isArray(result.data.records) || !Number.isSafeInteger(result.data.revision) || !/^\d{4}-\d{2}-\d{2}$/.test(result.data.today)) throw apiError('BACKEND_ERROR');
   return result.data;
  }
 };
}

export const isCurrentSnapshot=(next,current)=>!current || (next.revision>=current.revision && next.today>=current.today);
