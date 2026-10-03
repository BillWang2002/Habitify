import { initPwa } from './pwa.js';
import { createClient } from '@supabase/supabase-js';
import { AuthController, loginError } from './auth.js';
const $ = id => document.getElementById(id);
let controller, busy = false, logoutFailed = false;
const views = ['restoring', 'login-view', 'unavailable', 'account-view'];
function render(state) {
  const view = { restoring: 'restoring', signedOut: 'login-view', unavailable: 'unavailable', verified: 'account-view' }[state.phase];
  for (const id of views) $(id).hidden = id !== view;
  $('account-email').textContent = state.phase === 'verified' ? state.user.email || '已登录账户' : '';
  $('data-message').textContent = '';
  $('check-data').disabled = false;
  $('restoring').querySelector('p').textContent = state.message;
  $('login-message').textContent = state.phase === 'signedOut' ? state.message : '';
  $('connection-message').textContent = state.message;
  $('retry-logout').hidden = !logoutFailed;
  if (state.phase === 'signedOut') { $('password').value = ''; setPasswordVisible(false); }
  if (state.phase === 'verified') location.hash = '/account';
  else if (state.phase === 'signedOut') location.hash = '/login';
  // 私有数据只在身份确认后呈现；不根据 hash 或缓存 user 信息放行。
}
function setPasswordVisible(visible) {
  $('password').type = visible ? 'text' : 'password';
  $('toggle-password').textContent = visible ? '隐藏' : '显示';
  $('toggle-password').setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
  $('toggle-password').setAttribute('aria-pressed', String(visible));
}
$('toggle-password').onclick = () => setPasswordVisible($('password').type === 'password');
$('login').onsubmit = async event => {
  event.preventDefault();
  if (!controller || busy) return;
  busy = true; $('submit').disabled = true; $('submit').textContent = '正在登录…'; $('login-message').textContent = ''; logoutFailed = false;
  try { await controller.login($('email').value, $('password').value); }
  catch (error) { $('login-message').textContent = loginError(error); }
  finally { $('password').value = ''; setPasswordVisible(false); busy = false; $('submit').disabled = false; $('submit').textContent = '登录 Habitify ↗'; }
};
async function logout() {
  if (busy || !controller) return;
  busy = true;
  try { logoutFailed = false; await controller.logout(); }
  catch { logoutFailed = true; $('retry-logout').hidden = false; }
  finally { busy = false; }
}
$('logout').onclick = logout; $('retry-logout').onclick = logout;
$('retry').onclick = () => navigator.onLine ? controller?.verify() : controller?.offline();
$('check-data').onclick = async () => {
  $('check-data').disabled = true;
  try {
    const count = await controller.readOwnProbes();
    if (count !== null) $('data-message').textContent = `数据连接已通过：可见 ${count} 条测试记录，均属于当前账户。`;
  } catch (error) { if (controller.state.phase === 'verified') $('data-message').textContent = error.message; }
  finally { $('check-data').disabled = false; }
};
initPwa({ isBusy: () => busy }).catch(() => {});
try {
  const response = await fetch('./config.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('配置读取失败');
  const config = await response.json();
  const url = new URL(config.supabaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) || !config.supabasePublishableKey?.startsWith('sb_publishable_')) throw new Error('公开配置不正确');
  const client = createClient(url.origin, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: `habitify-${url.hostname}-auth` },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) }
  });
  controller = new AuthController(client, render);
  $('submit').disabled = false;
  await controller.start({ verify: navigator.onLine });
  if (!navigator.onLine) controller.offline();
} catch {
  render({ phase: 'unavailable', user: null, message: '暂时无法初始化登录，请检查连接后重新加载页面。' });
  $('retry').onclick = () => location.reload();
}
window.addEventListener('offline', () => controller?.offline());
window.addEventListener('online', () => controller?.verify());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && controller && !busy) { if (navigator.onLine) controller.verify(); else controller.offline(); } });
