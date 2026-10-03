import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const template = await readFile(new URL('../web/sw.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../web/manifest.webmanifest', import.meta.url), 'utf8'));
function worker({ failInstall = false, offline = true } = {}) {
  const scope = 'https://example.test/Habitify/';
  const listeners = {}, stores = new Map(); let skips = 0, claims = 0;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          for (const request of requests) store.set(request.url, new Response('public-shell'));
          if (failInstall) throw Error('install interrupted');
        },
        async match(url) { return store.get(url); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const self = { registration: { scope }, clients: { async claim() { claims++; } }, async skipWaiting() { skips++; }, addEventListener(name, fn) { listeners[name] = fn; } };
  vm.runInNewContext(template.replace('__REVISION__', 'new').replace('__PRECACHE__', JSON.stringify(['index.html','assets/app.test.js','config.json'])), { self, caches, URL, Request, fetch: async () => { if (offline) throw Error('offline'); return new Response('network'); } });
  async function lifecycle(name, data) { let task; listeners[name]({ data, waitUntil(p) { task = p; } }); await task; }
  async function fetchRequest(path, options = {}) {
    let result;
    listeners.fetch({ request: { url: new URL(path, scope).href, mode: 'cors', method: 'GET', headers: new Headers(), ...options }, respondWith(p) { result = p; } });
    return result ? await result : null;
  }
  return { stores, lifecycle, fetchRequest, skips: () => skips, claims: () => claims };
}
test('Manifest 身份、启动与控制范围均适配 GitHub 子路径', () => {
  const base = 'https://example.test/Habitify/manifest.webmanifest';
  for (const field of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[field], base).href, 'https://example.test/Habitify/');
  assert.equal(manifest.display, 'standalone'); assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});
test('离线根导航返回缓存的同一版界面，公开配置仍可读', async () => {
  const sw = worker(); await sw.lifecycle('install');
  assert.equal(await (await sw.fetchRequest('./', { mode: 'navigate' })).text(), 'public-shell');
  assert.equal(await (await sw.fetchRequest('config.json')).text(), 'public-shell');
});
test('认证、写请求、诊断页、查询参数和范围外请求完全绕过缓存', async () => {
  const sw = worker(); await sw.lifecycle('install');
  for (const path of ['https://project.supabase.co/auth/v1/token', 'https://project.supabase.co/rest/v1/infra_probes', '../Other/', 'diagnostics/', 'assets/app.test.js?token=anything']) assert.equal(await sw.fetchRequest(path), null);
  assert.equal(await sw.fetchRequest('config.json', { method: 'POST' }), null);
  assert.equal(await sw.fetchRequest('config.json', { headers: new Headers({ authorization: 'Bearer test' }) }), null);
  assert.equal(await sw.fetchRequest('./?private=value', { mode: 'navigate' }), null);
});
test('预缓存失败清除半成品，不替换旧版本', async () => {
  const sw = worker({ failInstall: true });
  await assert.rejects(sw.lifecycle('install')); assert.equal(sw.stores.size, 0); assert.equal(sw.skips(), 0);
});
test('更新需明确应用，激活仅清理同一项目的旧缓存', async () => {
  const sw = worker(); await sw.lifecycle('install'); assert.equal(sw.skips(), 0);
  sw.stores.set('habitify-shell:/Habitify/:old', new Map()); sw.stores.set('habitify-shell:/Other/:old', new Map());
  await sw.lifecycle('message', { type: 'OTHER' }); assert.equal(sw.skips(), 0);
  await sw.lifecycle('message', { type: 'APPLY_UPDATE' }); assert.equal(sw.skips(), 1);
  await sw.lifecycle('activate'); assert.equal(sw.claims(), 1); assert.ok(!sw.stores.has('habitify-shell:/Habitify/:old')); assert.ok(sw.stores.has('habitify-shell:/Other/:old'));
});
