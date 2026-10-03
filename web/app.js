let config, session;
const output = document.querySelector('#results');
function report(message) { output.textContent = `${new Date().toLocaleTimeString()} ${message}\n${output.textContent}`; }
async function request(path, { body, token, method = 'POST' } = {}) {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method, headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) { const error = new Error(`请求失败（HTTP ${response.status}），请检查配置、账户或权限。`); error.status = response.status; throw error; }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function run(button, action) {
  button.disabled = true;
  try { await action(); } catch (error) { report(error.name === 'TimeoutError' ? '请求超时。' : error.message); }
  finally { updateButtons(); }
}
function updateButtons() {
  const ready = Boolean(config);
  document.querySelector('#health').disabled = !ready;
  document.querySelector('#login button').disabled = !ready || Boolean(session);
  for (const id of ['logout', 'probe', 'rows']) document.querySelector(`#${id}`).disabled = !session;
  document.querySelector('#denied').disabled = !ready;
}
try {
  const response = await fetch('./config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('配置文件读取失败。');
  const value = await response.json();
  if (!value.supabaseUrl || !value.supabasePublishableKey) throw new Error('后端尚未配置，先创建 Supabase 项目。');
  const url = new URL(value.supabaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) || !value.supabasePublishableKey.startsWith('sb_publishable_')) throw new Error('连接配置格式不正确；只接受公开 publishable key。');
  config = { ...value, supabaseUrl: url.origin };
  document.querySelector('#config').textContent = '公开连接参数已加载；实际通信尚未验证。';
} catch (error) { document.querySelector('#config').textContent = error.message; }
try {
  const response = await fetch('./version.json', { cache: 'no-store' });
  if (!response.ok) throw new Error();
  const value = await response.json(); document.querySelector('#version').textContent = `部署版本：${value.commit}`;
} catch { document.querySelector('#version').textContent = '部署版本读取失败。'; }
updateButtons();
document.querySelector('#health').onclick = (event) => run(event.currentTarget, async () => {
  const result = await request('/rest/v1/rpc/infra_health', { body: {} });
  if (result?.ok !== true || result?.service !== 'habitify-infra' || !result?.server_time) throw new Error('响应不符合健康检查约定。');
  report(`公共 API 已通过，服务器时间：${result.server_time}`);
});
document.querySelector('#login').onsubmit = (event) => {
  event.preventDefault(); run(event.currentTarget.querySelector('button'), async () => {
    const password = document.querySelector('#password');
    let result;
    try { result = await request('/auth/v1/token?grant_type=password', { body: { email: document.querySelector('#email').value, password: password.value } }); }
    finally { password.value = ''; }
    if (!result?.access_token || !result?.user?.id) throw new Error('登录响应不完整。');
    const identity = await request('/rest/v1/rpc/infra_identity', { body: {}, token: result.access_token });
    if (identity !== result.user.id) throw new Error('后端身份与登录身份不一致。');
    session = { token: result.access_token, userId: result.user.id }; report('登录与后端身份校验已通过。');
  });
};
document.querySelector('#logout').onclick = (event) => run(event.currentTarget, async () => {
  try { await request('/auth/v1/logout', { body: {}, token: session.token }); report('已退出，服务端会话退出请求成功。'); }
  finally { session = null; output.textContent = '本地登录状态与此前结果已清空。'; }
});
document.querySelector('#probe').onclick = (event) => run(event.currentTarget, async () => {
  const id = crypto.randomUUID();
  await request('/rest/v1/infra_probes', { body: { id, user_id: session.userId }, token: session.token });
  const rows = await request(`/rest/v1/infra_probes?id=eq.${id}&select=id,user_id`, { method: 'GET', token: session.token });
  if (rows.length !== 1 || rows[0].id !== id || rows[0].user_id !== session.userId) throw new Error('写入与读取结果不一致。');
  report('本人探针写入与读取已通过。');
});
document.querySelector('#rows').onclick = (event) => run(event.currentTarget, async () => {
  const rows = await request('/rest/v1/infra_probes?select=id,user_id', { method: 'GET', token: session.token });
  if (rows.some(row => row.user_id !== session.userId)) throw new Error('权限错误：读到了其他用户数据。');
  report(`可见探针 ${rows.length} 条，均属于当前账户。另需确认 A 已写入后 B 看不到 A。`);
});
document.querySelector('#denied').onclick = (event) => run(event.currentTarget, async () => {
  try { await request('/rest/v1/rpc/infra_identity', { body: {} }); }
  catch (error) { if ([401, 403].includes(error.status)) { report('匿名调用私有 API 已被拒绝。'); return; } throw error; }
  throw new Error('权限错误：匿名调用私有 API 未被拒绝。');
});
