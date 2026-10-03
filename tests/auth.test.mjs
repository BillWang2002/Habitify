import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthController, loginError } from '../web/auth.js';
const user = { id: 'a', email: 'a@example.test' };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup(overrides = {}) {
  let callback;
  const client = {
    auth: {
      onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => ({ data: { session: { user } }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      signOut: async () => ({ error: null }),
      ...overrides.auth
    },
    rpc: async () => ({ data: 'a', error: null }),
    from: () => ({ select: async () => ({ data: [{ user_id: 'a', id: 'probe' }], error: null }) }),
    ...overrides.client
  };
  const scheduled = [];
  const controller = new AuthController(client, () => {}, fn => scheduled.push(fn));
  return { controller, emit: event => callback(event), scheduled };
}
test('缓存会话必须通过 Auth 与后端身份匹配，错配不放行', async () => {
  const { controller } = setup({ client: { rpc: async () => ({ data: 'b', error: null }) } });
  await controller.start(); assert.equal(controller.state.phase, 'unavailable'); assert.equal(controller.state.user, null);
});
test('短暂断网保留会话，明确失效回到登录页', async () => {
  let failure = { status: 503 };
  const { controller } = setup({ auth: { getUser: async () => ({ error: failure }) } });
  await controller.start(); assert.equal(controller.state.phase, 'unavailable');
  failure = { status: 401 }; await controller.verify(); assert.equal(controller.state.phase, 'signedOut');
});
test('退出期间迟到的身份响应不能恢复个人界面，并只退出当前会话', async () => {
  const response = deferred(); let scope;
  const { controller } = setup({ auth: { getUser: () => response.promise, signOut: async options => { scope = options.scope; return { error: null }; } } });
  const verification = controller.start(); await new Promise(resolve => setImmediate(resolve));
  await controller.logout(); response.resolve({ data: { user }, error: null }); await verification;
  assert.equal(scope, 'local'); assert.equal(controller.state.phase, 'signedOut');
});
test('退出过程中刷新事件不能启动身份验证', async () => {
  const exit = deferred();
  const { controller, emit, scheduled } = setup({ auth: { signOut: () => exit.promise } });
  await controller.start(); const operation = controller.logout(); emit('TOKEN_REFRESHED');
  assert.equal(scheduled.length, 0); exit.resolve({ error: null }); await operation;
  assert.equal(controller.state.phase, 'signedOut');
});
test('A 的数据迟到时不会返回给退出后的界面', async () => {
  const rows = deferred();
  const { controller } = setup({ client: { from: () => ({ select: () => rows.promise }) } });
  await controller.start(); const read = controller.readOwnProbes(); await controller.logout();
  rows.resolve({ data: [{ user_id: 'a' }], error: null }); assert.equal(await read, null);
});
test('读取中出现其他账户记录必须拒绝', async () => {
  const { controller } = setup({ client: { from: () => ({ select: async () => ({ data: [{ user_id: 'b' }], error: null }) }) } });
  await controller.start(); await assert.rejects(controller.readOwnProbes(), /账户隔离/);
});
test('状态订阅不在回调内启动异步 Auth 操作', async () => {
  const { controller, emit, scheduled } = setup(); await controller.start();
  emit('TOKEN_REFRESHED'); assert.equal(scheduled.length, 1); assert.equal(controller.state.phase, 'verified');
});
test('凭据与网络错误文案区分且不带服务器原始信息', () => {
  assert.match(loginError({ code: 'invalid_credentials', status: 400 }), /邮箱或密码/);
  assert.match(loginError({ message: 'sensitive details' }), /连接服务器/);
});
test('离线启动不向本地缓存用户放行，恢复前不执行身份请求', async () => {
  let calls = 0;
  const { controller } = setup({ auth: { getSession: async () => { calls++; return { data: { session: { user } }, error: null }; } } });
  await controller.start({ verify: false }); controller.offline();
  assert.equal(calls, 0); assert.equal(controller.state.phase, 'unavailable'); assert.equal(controller.state.user, null);
  await controller.verify(); assert.equal(controller.state.phase, 'verified');
});
