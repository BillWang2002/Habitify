import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { validateConfig } from './config.mjs';

let config;
if (process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY) {
  config = { supabaseUrl: process.env.SUPABASE_URL, supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY };
} else {
  try { config = JSON.parse(await readFile('config.local.json', 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    config = JSON.parse(await readFile('config.example.json', 'utf8'));
  }
}
config = validateConfig(config, { required: process.env.CI === 'true' });
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'styles.css']) await copyFile(`web/${name}`, `dist/${name}`);
await build({ entryPoints: ['web/app.js'], bundle: true, format: 'esm', platform: 'browser', target: ['safari16'], outfile: 'dist/app.js', minify: true });
await mkdir('dist/diagnostics', { recursive: true });
for (const name of ['index.html', 'app.js', 'styles.css']) await copyFile(`web/diagnostics/${name}`, `dist/diagnostics/${name}`);
await writeFile('dist/config.json', JSON.stringify(config));
await writeFile('dist/version.json', JSON.stringify({ commit: process.env.GITHUB_SHA || 'local', builtAt: new Date().toISOString() }));
console.log(config.supabaseUrl ? '已生成登录页及独立通信检查页。' : '已生成登录页：后端尚未配置，不会模拟成功。');
