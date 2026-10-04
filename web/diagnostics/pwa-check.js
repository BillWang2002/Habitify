const output = document.getElementById('pwa-results');
output.replaceChildren();
document.getElementById('recheck').onclick=()=>location.reload();
const add = line => { const row=document.createElement('li'), label=document.createElement('span'),value=document.createElement('strong'); const colon=line.indexOf('：'); label.textContent=colon<0 ? '提示' : line.slice(0,colon); value.textContent=colon<0 ? line : line.slice(colon+1); row.append(label,value); output.append(row); };
try {
  add(`运行模式：${matchMedia('(display-mode: standalone)').matches || navigator.standalone === true ? '独立应用' : '浏览器网页'}`);
  const manifest = await fetch('../manifest.webmanifest', { cache: 'no-store' }).then(r => { if (!r.ok) throw Error(); return r.json(); });
  const base = new URL('../', location.href);
  const good = new URL(manifest.start_url, base).href === base.href && new URL(manifest.scope, base).href === base.href && manifest.display === 'standalone';
  add(`Manifest 与项目子路径：${good ? '通过' : '未通过'}`);
  if (!('serviceWorker' in navigator)) throw Error();
  const registration = await navigator.serviceWorker.getRegistration(base.href);
  add(`Service Worker：${registration?.active ? '已激活' : '未就绪，请先在线打开首页'}`);
  add(`当前页面受控：${navigator.serviceWorker.controller ? '是' : '否，重新打开后复查'}`);
  if (registration?.active) {
    add(`控制范围：${new URL(registration.scope).pathname}`);
    add(`等待更新：${registration.waiting ? '有' : '无'}`);
    const prefix = `habitify-shell:${base.pathname}:`;
    const keys = (await caches.keys()).filter(key => key.startsWith(prefix));
    const urls = [];
    for (const key of keys) for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url));
    const safe = urls.every(url => url.origin === base.origin && url.pathname.startsWith(base.pathname) && !url.pathname.includes('auth/') && !url.pathname.includes('rest/'));
    add(`公共界面缓存：${urls.length} 项`);
    add(`缓存边界：${safe ? '通过（同站公共文件）' : '未通过'}`);
    const index = new URL('index.html', base).href;
    let shell;
    for (const key of keys) shell ||= await (await caches.open(key)).match(index);
    add(`离线界面已准备：${shell?.ok ? '是' : '否'}`);
  }
} catch { add('部分检查未完成，请联网后从首页重新进入此页。'); }
