import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../scripts/config.mjs';

test('本地未配置允许显示未连接，CI 未配置必须失败', () => {
  assert.deepEqual(validateConfig({}), {});
  assert.throws(() => validateConfig({}, { required: true }));
});
test('拒绝管理 key、旧 JWT 和带有凭据的 URL', () => {
  for (const key of ['sb_secret_example', 'eyJexample']) assert.throws(() => validateConfig({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: key }));
  assert.throws(() => validateConfig({ supabaseUrl: 'https://user:password@example.supabase.co', supabasePublishableKey: 'sb_publishable_example' }));
});
test('公开配置保留且规范化 URL', () => {
  assert.equal(validateConfig({ supabaseUrl: 'https://example.supabase.co/', supabasePublishableKey: 'sb_publishable_example' }).supabaseUrl, 'https://example.supabase.co');
});
