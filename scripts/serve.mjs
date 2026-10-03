import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
await import('./build.mjs');
const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  // Exercise the exact production /Habitify/ subpath as well as localhost root.
  let relative = pathname.startsWith('/Habitify/') ? pathname.slice('/Habitify/'.length) : pathname.slice(1);
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const path = resolve(root, relative);
  if (!path.startsWith(root + sep) || !types[extname(path)]) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 5173), '127.0.0.1', function () { console.log(`PWA 页面：http://127.0.0.1:${this.address().port}/Habitify/`); });
