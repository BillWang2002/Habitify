import { createServer } from 'node:http';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const routes = new Map([
  ['/', ['web/index.html', 'text/html']],
  ['/index.html', ['web/index.html', 'text/html']],
  ['/diagnostics/', ['web/diagnostics/index.html', 'text/html']],
  ['/diagnostics/index.html', ['web/diagnostics/index.html', 'text/html']],
  ['/diagnostics/app.js', ['web/diagnostics/app.js', 'text/javascript']],
  ['/diagnostics/styles.css', ['web/diagnostics/styles.css', 'text/css']],
  ['/styles.css', ['web/styles.css', 'text/css']]
]);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  try {
    let body, type;
    if (pathname === '/app.js') {
      const result = await build({ entryPoints: ['web/app.js'], bundle: true, format: 'esm', platform: 'browser', target: ['safari16'], write: false });
      body = result.outputFiles[0].contents; type = 'text/javascript';
    } else if (pathname === '/config.json') {
      type = 'application/json';
      try { body = await readFile('config.local.json'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; body = await readFile('config.example.json'); }
    } else if (pathname === '/version.json') {
      type = 'application/json'; body = JSON.stringify({ commit: 'local', builtAt: null });
    } else {
      const route = routes.get(pathname);
      if (!route) { res.writeHead(404); res.end('Not found'); return; }
      [body, type] = [await readFile(route[0]), route[1]];
    }
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' }); res.end(body);
  } catch { res.writeHead(500); res.end('Local server error'); }
});
server.listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log(`通信页：http://127.0.0.1:${server.address().port}`));
