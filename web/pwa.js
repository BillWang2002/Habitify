export async function initPwa({ isBusy }) {
  const mode = document.getElementById('app-mode');
  const display = matchMedia('(display-mode: standalone)');
  const setMode = () => {
    const standalone = display.matches || navigator.standalone === true;
    document.body.classList.toggle('is-standalone', standalone);
    mode.textContent = standalone ? '应用模式' : '网页模式';
  };
  setMode(); display.addEventListener('change', setMode);
  if (!('serviceWorker' in navigator)) return;
  const banner = document.getElementById('update-banner');
  const button = document.getElementById('apply-update');
  const note = document.getElementById('update-note');
  let registration, applying = false, changed = false;
  let hadController = Boolean(navigator.serviceWorker.controller);
  const showUpdate = () => { banner.hidden = false; note.textContent = '有新版本，准备好后即可更新。'; };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (applying) location.reload();
    else { changed = true; if (registration?.active && registration?.waiting === null) showUpdate(); }
  });
  button.onclick = () => {
    if (isBusy() || document.getElementById('password').value) { note.textContent = '请先完成当前操作或清空密码，再更新。'; return; }
    if (registration?.waiting) {
      applying = true; button.disabled = true; note.textContent = '正在更新…';
      registration.waiting.postMessage({ type: 'APPLY_UPDATE' });
    } else if (changed) location.reload();
  };
  try {
    const alreadyControlled = Boolean(navigator.serviceWorker.controller);
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    // First activation claims this page without being a pending version update.
    if (!alreadyControlled && changed) { changed = false; banner.hidden = true; }
    if (registration.waiting) showUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller && registration.waiting) showUpdate();
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {});
    });
  } catch {
    // Online login remains available if installation/storage is unavailable.
    mode.textContent += ' · 离线准备未完成';
  }
}
