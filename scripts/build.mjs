import { accountHeader } from '../web/account-header.js';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import sharp from 'sharp';
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
const hash = content => createHash('sha256').update(content).digest('hex').slice(0, 16);
await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
const bundle = await build({ entryPoints: ['web/app.js'], bundle: true, format: 'esm', platform: 'browser', target: ['safari16'], minify: true, write: false });
const js = bundle.outputFiles[0].contents;
const css = await readFile('web/styles.css');
const appName = `assets/app.${hash(js)}.js`, cssName = `assets/styles.${hash(css)}.css`;
await writeFile(`dist/${appName}`, js); await writeFile(`dist/${cssName}`, css);
let html = await readFile('web/index.html', 'utf8');
html = html.replace('./app.js', `./${appName}`).replace('./styles.css', `./${cssName}`);
await writeFile('dist/index.html', html);
const preview = await build({ entryPoints: ['web/preview.js'], bundle: true, format: 'esm', platform: 'browser', target: ['safari16'], minify: true, write: false });
const previewName = `assets/preview.${hash(preview.outputFiles[0].contents)}.js`;
await writeFile(`dist/${previewName}`, preview.outputFiles[0].contents);
await writeFile('dist/preview.html', (await readFile('web/preview.html', 'utf8')).replace('./preview.js', `./${previewName}`).replace('./styles.css', `./${cssName}`));
await copyFile('web/manifest.webmanifest', 'dist/manifest.webmanifest');
await mkdir('dist/icons', { recursive: true });
const icon = await readFile('web/icons/icon.svg');
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(icon).resize(size, size).png().toFile(`dist/icons/${name}`);
}
await mkdir('dist/diagnostics', { recursive: true });
for (const name of ['index.html', 'app.js', 'styles.css', 'pwa.html', 'pwa-check.js', 'pwa.css']) await copyFile(`web/diagnostics/${name}`, `dist/diagnostics/${name}`);
await writeFile('dist/diagnostics/pwa.html', (await readFile('web/diagnostics/pwa.html','utf8')).replace('../styles.css', `../${cssName}`).replace('__ACCOUNT_HEADER__', accountHeader({group:'应用检查',title:'PWA 应用检查',parentLabel:'开发者模式',href:'../#/developer'})));
await writeFile('dist/config.json', JSON.stringify(config));
const files = ['index.html', appName, cssName, 'config.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const revision = hash(Buffer.concat(await Promise.all(files.map(file => readFile(`dist/${file}`)))));
const worker = (await readFile('web/sw.js', 'utf8')).replace('__REVISION__', revision).replace('__PRECACHE__', JSON.stringify(files));
await writeFile('dist/sw.js', worker);
await writeFile('dist/version.json', JSON.stringify({ commit: process.env.GITHUB_SHA || 'local', shell: revision, builtAt: new Date().toISOString() }));
console.log('已生成 PWA 登录页、应用图标、版本缓存与独立通信检查页。');
