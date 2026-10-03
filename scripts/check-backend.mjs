import { readFile } from 'node:fs/promises';
import { validateConfig } from './config.mjs';

const config = validateConfig(JSON.parse(await readFile('config.local.json', 'utf8')), { required: true });
const checks = [
  { name: '身份认证服务', path: '/auth/v1/health', method: 'GET', verify: data => Boolean(data?.version || data?.name) },
  { name: 'JWT 公钥端点', path: '/auth/v1/.well-known/jwks.json', method: 'GET', verify: data => Array.isArray(data?.keys) },
  { name: '项目健康检查 RPC', path: '/rest/v1/rpc/infra_health', method: 'POST', verify: data => data?.ok === true && data?.service === 'habitify-infra' && Boolean(data?.server_time) },
  { name: '匿名身份访问私有 RPC', path: '/rest/v1/rpc/infra_identity', method: 'POST', denied: true }
];
let failed = false;
for (const check of checks) {
  try {
    const response = await fetch(`${config.supabaseUrl}${check.path}`, {
      method: check.method,
      headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' },
      ...(check.method === 'POST' ? { body: '{}' } : {}),
      signal: AbortSignal.timeout(15000)
    });
    if (check.denied) {
      const pass = [401, 403].includes(response.status);
      console.log(`${check.name}: ${pass ? '通过（权限拒绝）' : '未通过'}，HTTP ${response.status}`);
      failed ||= !pass;
    } else if (response.ok) {
      const pass = check.verify(await response.json());
      console.log(`${check.name}: ${pass ? '通过' : '响应格式不符合约定'}，HTTP ${response.status}`);
      failed ||= !pass;
    } else {
      let code;
      try { code = (await response.json())?.code; } catch {}
      console.log(`${check.name}: 未通过，HTTP ${response.status}${code === 'PGRST202' ? '（RPC 不存在或尚未刷新，请执行迁移）' : ''}`);
      failed = true;
    }
  } catch (error) {
    console.log(`${check.name}: 请求失败（${error.name === 'TimeoutError' ? '超时' : '连接异常'}）`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
