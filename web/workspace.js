import { sampleHabits, isComplete, todaySummary, setProgress, addHabit } from './habits-model.js';
const icons = { book: '📖', water: '💧', walk: '🌿', leaf: '🌱', target: '◎' };
const routes = ['habits', 'rewards', 'stats', 'me'];
export function createWorkspace(root, { onLogout = () => {}, onCheck = async () => '这是公开界面预览，不读取个人数据。', preview = false } = {}) {
  let owner, dayKey, habits = sampleHabits(), filter = 'all', route = 'habits', activeHabit, lastFocus, toastTimer;
  root.innerHTML = `<div class="app-frame">
    <header class="app-header"><a class="app-brand" href="#/habits"><span aria-hidden="true">✦</span> Habitify</a><span class="app-preview-tag">界面预览</span></header>
    <div class="app-content" id="workspace-content">
      <p class="demo-notice">演示数据 · 打卡不保存、不发金币，刷新后重置</p>
      <section data-page="habits" aria-label="今日习惯">
        <div class="page-title"><div><p id="today-date" class="date-label"></p><h1>今日习惯</h1></div><button class="add-habit" id="add-habit" aria-label="添加习惯">＋</button></div>
        <ol class="week-strip" id="week-strip" aria-label="本周日期"></ol>
        <section class="growth-card" aria-label="今日行动状态"><div><span class="growth-eyebrow">一点行动，一点成长</span><h2 id="growth-title">让今天，向前一点。</h2><p id="action-status"></p><span id="completion-count"></span></div><div class="growth-seed" aria-hidden="true"><i></i><b></b><em></em></div><div class="growth-meter"><span id="completion-meter"></span></div></section>
        <div class="habit-toolbar"><h2>我的习惯 <span id="habit-count"></span></h2><div class="habit-filters" aria-label="筛选习惯"><button data-filter="all" aria-pressed="true">全部</button><button data-filter="pending" aria-pressed="false">待完成</button><button data-filter="done" aria-pressed="false">已完成</button></div></div>
        <div id="habit-list" class="habit-list"></div><div id="habit-empty" class="habit-empty" hidden><span aria-hidden="true">🌱</span><h3 id="empty-title"></h3><p id="empty-note"></p></div>
        <p class="habits-footnote">完成至少一个习惯，今天就成为行动日。</p>
      </section>
      <section data-page="rewards" hidden><div class="page-title"><div><p class="date-label">让努力有一点小期待</p><h1>激励</h1></div></div><div class="module-intro"><span aria-hidden="true">✦</span><h2>为你的成长，留一份奖励。</h2><p>这一页先保留入口，金币结算与兑换将在后续接入。</p></div><div class="module-item"><strong>商店与背包</strong><p>主题、奖杯、徽章、代金券与补签卡</p><span>后续开放</span></div><div class="module-item"><strong>展示墙</strong><p>摆放属于你的收藏与成长记忆</p><span>后续开放</span></div></section>
      <section data-page="stats" hidden><div class="page-title"><div><p class="date-label">看见每一步的积累</p><h1>统计</h1></div></div><div class="module-intro"><span aria-hidden="true">▥</span><h2>你的行动，会慢慢连成一条路。</h2><p>真实记录接入后，这里展示行动日历与习惯趋势。</p></div><div class="module-item"><strong>行动日历</strong><p>区分日常完成与补签</p><span>后续开放</span></div><div class="module-item"><strong>习惯趋势</strong><p>计划完成率与连续记录</p><span>后续开放</span></div></section>
      <section data-page="me" hidden><div class="page-title"><div><p class="date-label">照顾好自己的成长节奏</p><h1>我的</h1></div></div><div class="profile-card"><span aria-hidden="true">✦</span><div><strong>${preview ? '预览访客' : '当前账户'}</strong><p id="account-email"></p></div></div><div class="module-item"><strong>外观与展示墙</strong><p>主题、头像与藏品陈列</p><span>后续开放</span></div><div class="module-item"><strong>个人数据</strong><p>导出与资料设置</p><span>后续开放</span></div><div class="account-tools"><button id="check-data">检查我的数据连接</button><p id="data-message" role="status"></p><button id="reset-demo">恢复初始演示</button><button id="logout">${preview ? '返回登录页' : '退出登录'}</button><a href="./diagnostics/pwa.html">应用检查</a></div></section>
    </div>
    <nav class="app-nav" aria-label="主要导航"><a href="#/habits" data-route="habits" aria-current="page"><span aria-hidden="true">◉</span>习惯</a><a href="#/rewards" data-route="rewards"><span aria-hidden="true">✦</span>激励</a><a href="#/stats" data-route="stats"><span aria-hidden="true">▥</span>统计</a><a href="#/me" data-route="me"><span aria-hidden="true">◌</span>我的</a></nav>
    <p class="app-toast" id="workspace-toast" role="status" aria-live="polite" hidden></p>
    <dialog id="habit-dialog" class="habit-dialog"><div class="dialog-heading"><h2 id="dialog-title"></h2><button id="close-dialog" aria-label="关闭">×</button></div><form id="habit-form"><div id="create-fields"><label for="habit-name">习惯名称</label><input id="habit-name" maxlength="30" placeholder="例如：睡前读书"><label for="habit-kind">记录方式</label><select id="habit-kind"><option value="complete">完成型 · 做完就打卡</option><option value="quantity">数量型 · 达到目标才完成</option></select><div id="quantity-fields" hidden><label for="habit-goal">每日目标</label><input id="habit-goal" type="number" inputmode="numeric" min="1" max="100000" step="1" value="8"><label for="habit-unit">单位</label><input id="habit-unit" maxlength="6" placeholder="杯、分钟、页"></div><p class="dialog-note">本轮演示按每天计划，不设置单个习惯的金币。</p></div><div id="progress-fields" hidden><label for="habit-progress">今日累计进度</label><input id="habit-progress" type="number" inputmode="numeric" min="0" step="1"><p id="progress-note" class="dialog-note"></p></div><p id="dialog-error" role="status" class="message"></p><button class="primary" id="save-habit" type="submit"></button></form></dialog>
  </div>`;
  const $ = id => root.querySelector(`#${id}`);
  const dialog = $('habit-dialog');
  function notify(text) { clearTimeout(toastTimer); $('workspace-toast').textContent = text; $('workspace-toast').hidden = false; toastTimer = setTimeout(() => { $('workspace-toast').hidden = true; }, 3500); }
  function setRoute(next) {
    route = routes.includes(next) ? next : 'habits';
    for (const page of root.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== route;
    for (const link of root.querySelectorAll('[data-route]')) { if (link.dataset.route === route) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
    $('workspace-content').scrollTop = 0;
  }
  function renderHabits() {
    const summary = todaySummary(habits);
    $('action-status').textContent = summary.actionDay ? '今天已成为行动日，继续按自己的节奏前进。' : '今天还没有完成的习惯，从一件小事开始。';
    $('growth-title').textContent = summary.actionDay ? '今天，已经向前一步。' : '让今天，向前一点。';
    $('completion-count').textContent = `${summary.completed} / ${summary.total} 个习惯已完成`;
    $('completion-meter').style.width = `${summary.total ? summary.completed / summary.total * 100 : 0}%`;
    $('habit-count').textContent = habits.length;
    const shown = habits.filter(item => filter === 'all' || (filter === 'done' ? isComplete(item) : !isComplete(item)));
    $('habit-list').replaceChildren();
    for (const habit of shown) {
      const done = isComplete(habit), card = document.createElement('article'); card.className = `habit-card ${done ? 'is-complete' : ''}`;
      card.innerHTML = `<span class="habit-icon ${habit.icon}" aria-hidden="true">${icons[habit.icon]}</span><div class="habit-info"><h3></h3><p></p>${habit.kind === 'quantity' ? '<progress></progress><button class="edit-progress">修改进度</button>' : ''}</div><button class="habit-action"></button>`;
      card.querySelector('h3').textContent = habit.name;
      card.querySelector('.habit-info p').textContent = habit.kind === 'quantity' ? `${habit.progress} / ${habit.goal} ${habit.unit} · ${done ? '已完成' : '每天'}` : done ? '今日已完成' : '每天 · 完成一次';
      const action = card.querySelector('.habit-action'); action.textContent = done ? '✓ 已完成' : habit.kind === 'quantity' ? `＋${habit.step} ${habit.unit}` : '打卡';
      action.setAttribute('aria-label', `${habit.name}：${done ? '修改或撤销完成' : habit.kind === 'quantity' ? `增加 ${habit.step} ${habit.unit}` : '打卡'}`);
      action.onclick = () => {
        if (done) openDialog(habit, habit.kind === 'complete' ? 'undo' : 'progress');
        else updateProgress(habit.id, Math.min(habit.goal, habit.progress + habit.step));
      };
      if (habit.kind === 'quantity') { const progress = card.querySelector('progress'); progress.max = habit.goal; progress.value = habit.progress; progress.setAttribute('aria-label', `${habit.name}进度`); card.querySelector('.edit-progress').onclick = () => openDialog(habit, 'progress'); }
      $('habit-list').append(card);
    }
    $('habit-empty').hidden = shown.length > 0;
    $('empty-title').textContent = !habits.length ? '从你的第一个习惯开始' : filter === 'done' ? '今天的第一步，等你出发' : '今天的计划，都完成了';
    $('empty-note').textContent = !habits.length ? '点击右上角 ＋，添加一件想坚持的小事。' : filter === 'done' ? '完成型打卡或数量达到目标后，会出现在这里。' : '按自己的节奏，明天继续。';
  }
  function updateProgress(id, value) {
    const before = todaySummary(habits).actionDay;
    habits = setProgress(habits, id, value); renderHabits();
    const habit = habits.find(item => item.id === id);
    notify(!before && todaySummary(habits).actionDay ? '已完成，今天成为行动日 · 演示' : `${habit.name}：${isComplete(habit) ? '已完成' : `${value} / ${habit.goal} ${habit.unit}`} · 演示`);
  }
  function openDialog(habit, mode = 'create') {
    activeHabit = habit ? { id: habit.id, mode } : { mode }; lastFocus = document.activeElement;
    $('habit-form').reset(); $('dialog-error').textContent = '';
    $('create-fields').hidden = mode !== 'create'; $('progress-fields').hidden = mode !== 'progress'; $('quantity-fields').hidden = true;
    $('habit-name').required = mode === 'create'; $('habit-progress').required = mode === 'progress';
    $('habit-progress').disabled = mode !== 'progress'; $('habit-goal').disabled = true; $('habit-unit').disabled = true;
    $('dialog-title').textContent = mode === 'create' ? '添加一个小习惯' : mode === 'undo' ? '撤销这次完成？' : habit.name;
    $('save-habit').textContent = mode === 'create' ? '添加习惯 · 演示' : mode === 'undo' ? '确认撤销 · 演示' : '保存进度 · 演示';
    if (mode === 'progress') { $('habit-progress').value = habit.progress; $('habit-progress').max = habit.goal; $('progress-note').textContent = `目标 ${habit.goal} ${habit.unit}；达到目标才算完成。输入 0 可清除演示进度。`; }
    if (mode === 'undo') $('dialog-error').textContent = '撤销后重新计算今日完成数；没有其他完成习惯时，今天不再是行动日。演示不涉及金币。';
    dialog.showModal();
  }
  function closeDialog() { dialog.close(); lastFocus?.focus(); }
  $('add-habit').onclick = () => openDialog(null);
  $('close-dialog').onclick = closeDialog;
  $('habit-kind').onchange = () => { const quantity = $('habit-kind').value === 'quantity'; $('quantity-fields').hidden = !quantity; $('habit-goal').disabled = !quantity; $('habit-unit').disabled = !quantity; $('habit-unit').required = quantity; };
  $('habit-form').onsubmit = event => {
    event.preventDefault();
    try {
      if (activeHabit.mode === 'create') { habits = addHabit(habits, { name: $('habit-name').value, kind: $('habit-kind').value, goal: Number($('habit-goal').value), unit: $('habit-unit').value }, crypto.randomUUID()); filter = 'all'; updateFilters(); renderHabits(); notify('已添加演示习惯，刷新后重置。'); }
      else updateProgress(activeHabit.id, activeHabit.mode === 'undo' ? 0 : Number($('habit-progress').value));
      closeDialog();
    } catch (error) { $('dialog-error').textContent = error.message; }
  };
  function updateFilters() { for (const button of root.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); }
  for (const button of root.querySelectorAll('[data-filter]')) button.onclick = () => { filter = button.dataset.filter; updateFilters(); renderHabits(); };
  $('logout').onclick = onLogout;
  $('check-data').onclick = async () => { const id = owner; $('check-data').disabled = true; try { const text = await onCheck(); if (owner === id) $('data-message').textContent = text; } catch { if (owner === id) $('data-message').textContent = '连接检查未完成，请联网后重试。'; } finally { $('check-data').disabled = false; } };
  $('reset-demo').onclick = () => { habits = sampleHabits(); filter = 'all'; updateFilters(); renderHabits(); notify('已恢复初始演示。'); };
  const hashChange = () => { if (!root.hidden) setRoute(location.hash.slice(2)); };
  window.addEventListener('hashchange', hashChange);
  function dates() {
    const today = new Date(), day = today.getDay(), monday = new Date(today); monday.setDate(today.getDate() - (day + 6) % 7);
    $('today-date').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(today);
    $('week-strip').replaceChildren();
    for (let i = 0; i < 7; i++) { const date = new Date(monday); date.setDate(monday.getDate() + i); const li = document.createElement('li'); li.innerHTML = `<span>${['一', '二', '三', '四', '五', '六', '日'][i]}</span><b>${date.getDate()}</b>`; if (i === (day + 6) % 7) { li.className = 'today'; li.setAttribute('aria-current', 'date'); } $('week-strip').append(li); }
  }
  return {
    enter(user) { const now = new Date(); const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`; if (owner !== user.id || dayKey !== todayKey) { habits = sampleHabits(); filter = 'all'; updateFilters(); } owner = user.id; dayKey = todayKey; $('account-email').textContent = preview ? '公开演示，不使用真实账户' : user.email || '已登录'; $('data-message').textContent = ''; dates(); renderHabits(); root.hidden = false; document.body.classList.add('workspace-active'); const requested = location.hash.slice(2); setRoute(routes.includes(requested) ? requested : 'habits'); location.hash = `/${route}`; },
    leave(reset = false) { root.hidden = true; document.body.classList.remove('workspace-active'); $('account-email').textContent = ''; $('data-message').textContent = ''; if (dialog.open) dialog.close(); clearTimeout(toastTimer); $('workspace-toast').hidden = true; if (reset) { owner = null; habits = sampleHabits(); } },
    isEditing() { return dialog.open; }
  };
}
