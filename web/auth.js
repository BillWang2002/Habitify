// 会话恢复与服务器身份确认分开；本地 user 信息不作为授权依据。
export function isInvalidSession(error) {
  return [401, 403].includes(error?.status) || ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'user_not_found', 'bad_jwt'].includes(error?.code);
}
export function loginError(error) {
  if (error?.code === 'invalid_credentials') return '邮箱或密码不正确，请重新输入。';
  if (error?.status === 429) return '尝试次数较多，请稍后再试。';
  if (error?.code === 'email_not_confirmed') return '账户尚未启用，请联系管理员。';
  if (!error?.status || error.status >= 500) return '暂时无法连接服务器，请检查网络后重试。';
  return '暂时无法登录，请稍后重试或联系管理员。';
}
export class AuthController {
  constructor(client, onState, schedule = fn => setTimeout(fn, 0)) {
    this.client = client;
    this.onState = onState;
    this.schedule = schedule;
    this.epoch = 0;
    this.state = { phase: 'restoring', user: null, message: '正在恢复登录状态…' };
    this.disposed = false;
    this.signingOut = false;
  }
  publish(phase, user = null, message = '') {
    this.state = { phase, user, message };
    this.onState(this.state);
  }
  async start({ verify = true } = {}) {
    this.subscription = this.client.auth.onAuthStateChange((event) => {
      if (this.disposed || this.signingOut) return;
      if (event === 'SIGNED_OUT') { this.epoch++; this.publish('signedOut'); }
      else if (event !== 'INITIAL_SESSION') this.schedule(() => this.verify());
    }).data.subscription;
    if (verify) await this.verify();
  }
  offline() {
    ++this.epoch;
    this.publish('unavailable', null, '当前处于离线状态。界面可打开，登录与个人数据需联网后确认。');
  }
  async verify() {
    if (this.disposed || this.signingOut) return;
    const ticket = ++this.epoch;
    this.publish('restoring', null, '正在确认登录状态…');
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      if (ticket !== this.epoch || this.disposed) return;
      if (!data.session) { this.publish('signedOut'); return; }
      const { data: identity, error: userError } = await this.client.auth.getUser();
      if (userError) throw userError;
      const { data: uid, error: rpcError } = await this.client.rpc('infra_identity');
      if (rpcError) throw rpcError;
      if (!identity.user?.id || uid !== identity.user.id || uid !== data.session.user.id) {
        throw new Error('Identity mismatch');
      }
      if (ticket === this.epoch && !this.disposed) this.publish('verified', identity.user, '登录与后端身份校验已通过。');
    } catch (error) {
      if (ticket !== this.epoch || this.disposed) return;
      if (isInvalidSession(error)) {
        // SDK 负责清理明确失效的刷新会话；旧界面立即隔离。
        this.publish('signedOut', null, '登录已失效，请重新登录。');
      } else this.publish('unavailable', null, '暂时无法确认身份。会话已保留，联网后请重试。');
    }
  }
  async login(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await this.verify();
  }
  async logout() {
    this.signingOut = true;
    ++this.epoch;
    this.publish('restoring', null, '正在退出登录…');
    let error;
    try { ({ error } = await this.client.auth.signOut({ scope: 'local' })); }
    catch (failure) { error = failure; }
    finally { this.signingOut = false; }
    if (error) {
      this.publish('unavailable', null, '退出请求未完成，请联网后重试退出，或重新确认会话。');
      throw error;
    }
    ++this.epoch;
    this.publish('signedOut', null, '已退出当前会话。');
  }
  async readOwnProbes() {
    if (this.state.phase !== 'verified') throw new Error('请先确认登录状态。');
    const ticket = this.epoch, userId = this.state.user.id;
    const { data, error } = await this.client.from('infra_probes').select('id,user_id');
    if (ticket !== this.epoch || this.state.phase !== 'verified' || this.state.user.id !== userId) return null;
    if (error) {
      if (isInvalidSession(error)) await this.verify();
      throw new Error('读取失败，请检查网络或重新确认登录状态。');
    }
    if (!Array.isArray(data) || data.some(row => row.user_id !== userId)) throw new Error('账户隔离检查未通过，请停止使用并联系管理员。');
    return data.length;
  }
  dispose() { this.disposed = true; ++this.epoch; this.subscription?.unsubscribe(); }
}
