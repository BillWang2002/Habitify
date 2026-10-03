import { sampleHabits, isComplete, todaySummary, setProgress, addHabit, removeHabit, archiveHabit, moveHabit } from './habits-model.js';
import { defaultTheme, iconChoices, iconSvg, resolveHabitIcon } from './theme.js';
import { renderDetail, localDay } from './habit-details.js';
const routes = ['habits', 'rewards', 'stats', 'me'];
export function createWorkspace(root, { onLogout = () => {}, onCheck = async () => '这是公开界面预览，不读取个人数据。', preview = false } = {}) {
  let owner, dayKey, habits = sampleHabits(), filter = 'all', route = 'habits', activeHabit, lastFocus, toastTimer, selectedIcon = 'leaf', deletedHabit, detailId, logs = [], selectedDay = localDay(), detailMonth = [new Date().getFullYear(), new Date().getMonth()], holdTimer, holdStart, suppressClick = false, filterRevision = 0;
  root.innerHTML = `<div class="app-frame">

    <div class="app-content" id="workspace-content">
      <p class="demo-notice">演示数据 · 打卡不保存、不发金币，刷新后重置</p>
      <section data-page="habits" aria-label="今日习惯">
        <div class="page-title"><div><p id="today-date" class="date-label"></p><h1>今日习惯</h1></div><button class="add-habit" id="add-habit" aria-label="添加习惯">＋</button></div>
        <ol class="week-strip" id="week-strip" aria-label="本周日期"></ol>
        <section class="growth-card" aria-label="今日行动状态"><div><span class="growth-eyebrow">一点行动，一点成长</span><h2 id="growth-title">让今天，向前一点。</h2><p id="action-status"></p><span id="completion-count"></span></div><div class="growth-seed" aria-hidden="true"><i></i><b></b><em></em></div><div class="growth-meter"><span id="completion-meter"></span></div></section>
        <div class="habit-toolbar"><h2>我的习惯 <span id="habit-count"></span></h2><div class="habit-filters" aria-label="筛选习惯"><span class="filter-slider" aria-hidden="true"></span><button data-filter="all" aria-pressed="true">全部</button><button data-filter="pending" aria-pressed="false">待完成</button><button data-filter="done" aria-pressed="false">已完成</button></div></div>
        <p id="selected-day-note" class="dialog-note"></p><div id="filter-results"><div id="habit-list" class="habit-list"></div><div id="habit-empty" class="habit-empty" hidden><span aria-hidden="true">🌱</span><h3 id="empty-title"></h3><p id="empty-note"></p></div></div>
        <p class="habits-footnote">点击卡片查看详情 · 右侧打卡 · 长按管理习惯。</p>
      </section>
      <section data-page="detail" id="habit-detail" hidden aria-label="习惯详情"></section>
      <section data-page="archive" id="habit-archive" hidden><div class="detail-header"><a href="#/habits" class="back-link" aria-label="返回习惯列表">‹</a><h1>已归档习惯</h1></div><p class="dialog-note">归档保留演示进度；恢复后重新加入今日列表。</p><div id="archive-list" class="habit-list"></div></section>
      <section data-page="rewards" hidden><div class="page-title"><div><p class="date-label">让努力有一点小期待</p><h1>激励</h1></div></div><div class="module-intro"><span aria-hidden="true">✦</span><h2>为你的成长，留一份奖励。</h2><p>这一页先保留入口，金币结算与兑换将在后续接入。</p></div><div class="module-item"><strong>商店与背包</strong><p>主题、奖杯、徽章、代金券与补签卡</p><span>后续开放</span></div><div class="module-item"><strong>展示墙</strong><p>摆放属于你的收藏与成长记忆</p><span>后续开放</span></div></section>
      <section data-page="stats" hidden><div class="page-title"><div><p class="date-label">看见每一步的积累</p><h1>统计</h1></div></div><div class="module-intro"><span aria-hidden="true">▥</span><h2>你的行动，会慢慢连成一条路。</h2><p>真实记录接入后，这里展示行动日历与习惯趋势。</p></div><div class="module-item"><strong>行动日历</strong><p>区分日常完成与补签</p><span>后续开放</span></div><div class="module-item"><strong>习惯趋势</strong><p>计划完成率与连续记录</p><span>后续开放</span></div></section>
      <section data-page="me" hidden><div class="page-title"><div><p class="date-label">照顾好自己的成长节奏</p><h1>我的</h1></div></div><div class="profile-card"><span aria-hidden="true">✦</span><div><strong>${preview ? '预览访客' : '当前账户'}</strong><p id="account-email"></p></div></div><div class="module-item"><strong>外观与展示墙</strong><p>主题、头像与藏品陈列</p><span>后续开放</span></div><div class="module-item"><strong>个人数据</strong><p>导出与资料设置</p><span>后续开放</span></div><div class="account-tools"><button id="check-data">检查我的数据连接</button><p id="data-message" role="status"></p><a href="#/archive">已归档习惯</a><button id="reset-demo">恢复初始演示</button><button id="logout">${preview ? '返回登录页' : '退出登录'}</button><a href="./diagnostics/pwa.html">应用检查</a></div></section>
    </div>
    <nav class="app-nav" aria-label="主要导航"><span class="nav-slider" aria-hidden="true"></span><a href="#/habits" data-route="habits" aria-current="page"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.habits)}</span>习惯</a><a href="#/rewards" data-route="rewards"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.rewards)}</span>激励</a><a href="#/stats" data-route="stats"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.stats)}</span>统计</a><a href="#/me" data-route="me"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.me)}</span>我的</a></nav>
    <div class="app-toast" id="workspace-toast" hidden><span id="toast-text" role="status" aria-live="polite"></span><button id="undo-delete" hidden>撤回</button></div>
    <dialog id="manage-dialog" class="habit-dialog manage-dialog"><div class="dialog-heading"><h2 id="manage-title"></h2><button id="close-manage" aria-label="关闭管理菜单">×</button></div><p class="dialog-note">长按与更多按钮均可进入此菜单。</p><div class="manage-actions"><button id="move-up">↑ 上移一位</button><button id="move-down">↓ 下移一位</button><button id="archive-habit">归档习惯</button><button id="delete-managed" class="danger-text">删除习惯</button></div></dialog>
    <dialog id="habit-dialog" class="habit-dialog"><div class="dialog-heading"><h2 id="dialog-title"></h2><button id="close-dialog" aria-label="关闭">×</button></div><form id="habit-form"><div id="create-fields"><label for="habit-name">习惯名称</label><input id="habit-name" maxlength="30" placeholder="例如：睡前读书"><fieldset class="icon-picker"><legend>习惯图标</legend><div id="icon-options"></div><p class="dialog-note">基础图标免费；更多个性图案后续开放。</p></fieldset><label id="kind-label">记录方式</label><input id="habit-kind" type="hidden" value="complete"><div class="kind-select"><button id="kind-trigger" type="button" aria-labelledby="kind-label kind-value" aria-haspopup="listbox" aria-expanded="false"><span id="kind-value">完成型 · 做完就打卡</span><span aria-hidden="true">⌄</span></button><div id="kind-options" role="listbox" aria-labelledby="kind-label" hidden><button type="button" role="option" data-kind="complete" aria-selected="true">完成型 · 做完就打卡</button><button type="button" role="option" data-kind="quantity" aria-selected="false">数量型 · 达到目标才完成</button></div></div><div id="quantity-fields" hidden><label for="habit-goal">每日目标</label><input id="habit-goal" type="number" inputmode="numeric" min="1" max="100000" step="1" value="8"><label for="habit-unit">单位</label><input id="habit-unit" maxlength="6" placeholder="杯、分钟、页"></div><label for="habit-note">备注（可选）</label><input id="habit-note" maxlength="200" placeholder="给这个习惯留一句提醒"><p class="dialog-note">本轮演示按每天计划，不设置单个习惯的金币。</p></div><div id="progress-fields" hidden><label for="habit-progress">今日累计进度</label><input id="habit-progress" type="number" inputmode="numeric" min="0" step="1"><p id="progress-note" class="dialog-note"></p></div><p id="dialog-error" role="status" class="message"></p><button class="primary" id="save-habit" type="submit"></button></form></dialog>
  </div>`;
  const $ = id => root.querySelector(`#${id}`);
  const dialog = $('habit-dialog');
  function notify(text) { clearTimeout(toastTimer); $('toast-text').textContent = text; $('undo-delete').hidden = !deletedHabit; $('workspace-toast').hidden = false; toastTimer = setTimeout(() => { $('workspace-toast').hidden = true; deletedHabit = null; }, deletedHabit ? 8000 : 3500); }
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function slide(element, direction = 1) {
    element.getAnimations().forEach(animation => animation.cancel());
    if (!reducedMotion()) element.animate([{ opacity: .4, transform: `translateX(${direction * 44}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  function setRoute(next) {
    const oldRoute = route;
    if (next.startsWith('habit/')) { const id = next.slice(6); if (habits.some(item=>item.id===id)) { detailId=id; route='detail'; detailMonth=[new Date().getFullYear(),new Date().getMonth()]; refreshDetail(); } else route='habits'; }
    else route = [...routes,'archive'].includes(next) ? next : 'habits';
    if (route === 'archive') renderArchive();
    root.querySelector('.app-nav').style.setProperty('--nav-index', Math.max(0,routes.indexOf(route)));
    for (const page of root.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== route;
    for (const link of root.querySelectorAll('[data-route]')) { if (link.dataset.route === (['detail','archive'].includes(route) ? 'habits' : route)) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
    if (oldRoute !== route) { $('workspace-content').scrollTop = 0; slide(root.querySelector(`[data-page="${route}"]`), (routes.includes(route) ? routes.indexOf(route) : 4) < (routes.includes(oldRoute) ? routes.indexOf(oldRoute) : 4) ? -1 : 1); }
  }
  function refreshDetail() {
    const habit = habits.find(item=>item.id===detailId); if (!habit) return;
    const expanded = $('habit-detail').querySelector('#detail-logs')?.open;
    renderDetail($('habit-detail'), habit, logs, detailMonth, { onMenu:()=>openManage(habit), onProgress:()=> { if (habit.kind==='quantity' || isComplete(habit)) openDialog(habit, habit.kind==='quantity' ? 'progress' : 'undo'); else updateProgress(habit.id,1); } });
    if (expanded) $('habit-detail').querySelector('#detail-logs').open=true;
    for (const [id,amount] of [['month-prev',-1],['month-next',1]]) $('habit-detail').querySelector(`#${id}`).onclick=()=> { const date=new Date(detailMonth[0],detailMonth[1]+amount,1); detailMonth=[date.getFullYear(),date.getMonth()]; refreshDetail(); };
  }
  function renderArchive() {
    $('archive-list').replaceChildren();
    const archived=habits.filter(item=>item.archived);
    for (const habit of archived) { const card=document.createElement('article'); card.className='archive-card'; const link=document.createElement('a'); link.href=`#/habit/${habit.id}`; link.textContent=habit.name; const restore=document.createElement('button'); restore.textContent='恢复'; restore.onclick=()=>{ habits=archiveHabit(habits,habit.id,false); deletedHabit=null; renderHabits(); renderArchive(); notify('已恢复习惯 · 演示'); }; card.append(link,restore); $('archive-list').append(card); }
    if (!archived.length) $('archive-list').textContent='暂无已归档习惯。';
  }
  function renderHabits() {
    const summary = todaySummary(habits);
    $('action-status').textContent = summary.actionDay ? habits.some(item=>item.archived && isComplete(item)) ? '今天已成为行动日，包含归档前已完成的行动。' : '今天已成为行动日，继续按自己的节奏前进。' : '今天还没有完成的习惯，从一件小事开始。';
    $('growth-title').textContent = summary.actionDay ? '今天，已经向前一步。' : '让今天，向前一点。';
    $('completion-count').textContent = `${summary.completed} / ${summary.total} 个习惯已完成`;
    $('completion-meter').style.width = `${summary.total ? summary.completed / summary.total * 100 : 0}%`;
    $('habit-count').textContent = habits.length;
    const active = habits.filter(item=>!item.archived), isToday = selectedDay === localDay();
    $('habit-count').textContent = active.length;
    $('selected-day-note').textContent = isToday ? '完成至少一个习惯，今天就成为行动日。' : `${selectedDay} · 仅查看；本次演示没有历史或未来记录。`;
    const shown = active.filter(item => filter === 'all' || (filter === 'done' ? isToday && isComplete(item) : !isToday || !isComplete(item)));
    $('habit-list').replaceChildren();
    for (const habit of shown) {
      const done = isToday && isComplete(habit), card = document.createElement('article'); card.className = `habit-card ${done ? 'is-complete' : ''}`;
      card.innerHTML = `<span class="habit-icon ${resolveHabitIcon(habit.icon)}" aria-hidden="true">${iconSvg(resolveHabitIcon(habit.icon))}</span><div class="habit-info"><button class="habit-open"><h3></h3><span class="habit-description"></span></button><progress></progress><div class="recent-days" aria-label="最近七天的演示状态"></div></div><div class="habit-controls"><button class="habit-action"></button><button class="habit-more" aria-label="更多操作">•••</button></div>`;
      card.dataset.habitId = habit.id; card.querySelector('h3').textContent=habit.name;
      const open=card.querySelector('.habit-open'); open.setAttribute('aria-label', `查看${habit.name}详情`); open.onclick=()=>location.hash=`/habit/${habit.id}`;
      card.querySelector('.habit-description').textContent = !isToday ? '无演示记录' : `${habit.progress} / ${habit.goal} ${habit.unit} · ${done ? '已完成' : '待完成'}`;
      const more=card.querySelector('.habit-more'); more.setAttribute('aria-label', `${habit.name}更多操作`); more.onclick=()=>openManage(habit);
      const action=card.querySelector('.habit-action'); action.textContent = !isToday ? '仅查看' : done ? '✓ 完成' : habit.kind==='quantity' ? `＋${habit.step} ${habit.unit}` : '打卡'; action.disabled=!isToday;
      action.setAttribute('aria-label', `${habit.name}：${done ? '修改或撤销完成' : habit.kind==='quantity' ? `增加 ${habit.step} ${habit.unit}` : '打卡'}`);
      action.onclick=()=> { if (done) openDialog(habit,habit.kind==='complete' ? 'undo' : 'progress'); else updateProgress(habit.id,Math.min(habit.goal,habit.progress+habit.step)); };
      const progress=card.querySelector('progress'); progress.max=habit.goal; progress.value=isToday ? habit.progress : 0; progress.setAttribute('aria-label', `${habit.name}进度`);
      for (let i=6;i>=0;i--) { const date=new Date(); date.setDate(date.getDate()-i); const marker=document.createElement('span'); marker.textContent=date.getDate(); marker.className=i===0 ? isComplete(habit) ? 'recent-done' : habit.progress ? 'recent-partial' : 'recent-today' : 'recent-unknown'; marker.setAttribute('aria-label', `${localDay(date)}：${i===0 ? isComplete(habit) ? '已完成' : habit.progress ? '部分进度' : '待完成' : '无演示记录'}`); card.querySelector('.recent-days').append(marker); }
      card.addEventListener('pointerdown',event=> { if (event.button!==0 || event.target.closest('.habit-controls') || !event.isPrimary) return; cancelHold(); holdStart={x:event.clientX,y:event.clientY}; holdTimer=setTimeout(()=> { suppressClick=true; openManage(habit); },550); });
      card.addEventListener('pointermove',event=> { if (holdStart && Math.hypot(event.clientX-holdStart.x,event.clientY-holdStart.y)>10) cancelHold(); });
      for (const event of ['pointerup','pointercancel','pointerleave']) card.addEventListener(event,cancelHold);
      card.addEventListener('click',event=> { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick=false; } },true);
      card.addEventListener('contextmenu',event=> { if (!event.target.closest('.habit-controls')) { event.preventDefault(); openManage(habit); } });
      card.addEventListener('click',event=> { if (!event.target.closest('button')) location.hash=`/habit/${habit.id}`; });
      $('habit-list').append(card);
    }
    $('habit-empty').hidden = shown.length > 0;
    $('empty-title').textContent = !isToday ? '该日期没有演示完成记录' : !active.length ? '从你的第一个习惯开始' : filter === 'done' ? '今天的第一步，等你出发' : '今天的计划，都完成了';
    $('empty-note').textContent = !isToday ? '返回今天可继续打卡；历史记录和补签后续接入。' : !active.length ? '点击右上角 ＋，添加一件想坚持的小事。' : filter === 'done' ? '完成型打卡或数量达到目标后，会出现在这里。' : '按自己的节奏，明天继续。';
  }
  function updateProgress(id, value) {
    deletedHabit = null; const previous = habits.find(item => item.id === id); const wasComplete = isComplete(previous); const before = todaySummary(habits).actionDay;
    habits = setProgress(habits, id, value); if (previous.progress !== value) logs.push({habitId:id,from:previous.progress,to:value,at:new Date().toISOString(),day:localDay()}); renderHabits(); if (route==='detail') refreshDetail();
    const habit = habits.find(item => item.id === id);
    const card = [...root.querySelectorAll('.habit-card')].find(item => item.dataset.habitId === id);
    card?.classList.add(!wasComplete && isComplete(habit) ? 'celebrate' : 'progress-feedback');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !before && todaySummary(habits).actionDay) root.querySelector('.growth-card').animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}], {duration:450});
    notify(!before && todaySummary(habits).actionDay ? '已完成，今天成为行动日 · 演示' : `${habit.name}：${isComplete(habit) ? '已完成' : `${value} / ${habit.goal} ${habit.unit}`} · 演示`);
  }
  function openDialog(habit, mode = 'create') {
    activeHabit = habit ? { id: habit.id, mode } : { mode }; lastFocus = document.activeElement;
    $('habit-form').reset(); $('dialog-error').textContent = ''; selectedIcon = 'leaf'; renderIconPicker(); setKind('complete');
    $('create-fields').hidden = mode !== 'create'; $('progress-fields').hidden = mode !== 'progress'; $('quantity-fields').hidden = true;
    $('habit-name').required = mode === 'create'; $('habit-progress').required = mode === 'progress';
    $('habit-progress').disabled = mode !== 'progress'; $('habit-goal').disabled = true; $('habit-unit').disabled = true;
    $('dialog-title').textContent = mode === 'create' ? '添加一个小习惯' : mode === 'delete' ? `删除“${habit.name}”？` : mode === 'undo' ? '撤销这次完成？' : habit.name;
    $('save-habit').textContent = mode === 'create' ? '添加习惯 · 演示' : mode === 'delete' ? '确认删除 · 演示' : mode === 'undo' ? '确认撤销 · 演示' : '保存进度 · 演示';
    if (mode === 'progress') { $('habit-progress').value = habit.progress; $('habit-progress').max = habit.goal; $('progress-note').textContent = `目标 ${habit.goal} ${habit.unit}；达到目标才算完成。输入 0 可清除演示进度。`; }
    if (mode === 'undo') $('dialog-error').textContent = '撤销后重新计算今日完成数；没有其他完成习惯时，今天不再是行动日。演示不涉及金币。';
    $('save-habit').classList.toggle('danger', mode === 'delete');
    if (mode === 'delete') $('dialog-error').textContent = '此演示习惯及今日进度将移除，并重新计算行动日。删除后 8 秒内可撤回；不影响真实账户数据。';
    dialog.showModal(); if (mode==='create') $('habit-name').focus({preventScroll:true});
  }
  function closeDialog() { $('kind-options').hidden=true; dialog.close(); if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true}); }
  $('add-habit').onclick = () => openDialog(null);
  $('close-dialog').onclick = closeDialog;
  function setKind(kind) {
    $('habit-kind').value=kind; const quantity=kind==='quantity'; $('kind-value').textContent=quantity ? '数量型 · 达到目标才完成' : '完成型 · 做完就打卡';
    $('quantity-fields').hidden=!quantity; $('habit-goal').disabled=!quantity; $('habit-unit').disabled=!quantity; $('habit-unit').required=quantity;
    for (const option of root.querySelectorAll('[data-kind]')) option.setAttribute('aria-selected',String(option.dataset.kind===kind));
    $('kind-options').hidden=true; $('kind-trigger').setAttribute('aria-expanded','false');
  }
  function toggleKind() { const open=$('kind-options').hidden; $('kind-options').hidden=!open; $('kind-trigger').setAttribute('aria-expanded',String(open)); if (open) $('kind-options').querySelector('[aria-selected="true"]').focus(); }
  $('kind-trigger').onclick=toggleKind;
  $('kind-trigger').onkeydown=event=> { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); if ($('kind-options').hidden) toggleKind(); } };
  for (const option of root.querySelectorAll('[data-kind]')) { option.onclick=()=>{ setKind(option.dataset.kind); $('kind-trigger').focus(); }; option.onkeydown=event=> { if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); $('kind-options').hidden=true; $('kind-trigger').setAttribute('aria-expanded','false'); $('kind-trigger').focus(); } else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); const choices=[...root.querySelectorAll('[data-kind]')]; choices[event.key==='Home' ? 0 : event.key==='End' ? choices.length-1 : choices.indexOf(option)===0 ? 1 : 0].focus(); } }; }
  dialog.addEventListener('click',event=> { if (!event.target.closest('.kind-select')) { $('kind-options').hidden=true; $('kind-trigger').setAttribute('aria-expanded','false'); } });
  $('habit-form').onsubmit = event => {
    event.preventDefault();
    try {
      if (activeHabit.mode === 'create') { habits = addHabit(habits, { name: $('habit-name').value, kind: $('habit-kind').value, goal: Number($('habit-goal').value), unit: $('habit-unit').value, icon: selectedIcon }, crypto.randomUUID()); habits=habits.map((item,index)=>index===habits.length-1 ? {...item,note:$('habit-note').value.trim()} : item); filter = 'all'; selectedDay=localDay(); dates(); updateFilters(); renderHabits(); deletedHabit = null; $('habit-list').lastElementChild?.classList.add('habit-added'); notify('新习惯已加入，迈出第一步吧。'); }
      else if (activeHabit.mode === 'delete') { const index = habits.findIndex(item => item.id === activeHabit.id); deletedHabit = { habit: habits[index], index }; habits = removeHabit(habits, activeHabit.id); renderHabits(); if (route==='detail') location.hash='/habits'; if (route==='archive') renderArchive(); notify('习惯已删除 · 演示'); }
      else updateProgress(activeHabit.id, activeHabit.mode === 'undo' ? 0 : Number($('habit-progress').value));
      closeDialog();
      if (activeHabit.mode === 'create') { const card = $('habit-list').lastElementChild; card.tabIndex = -1; card.focus({ preventScroll: true }); card.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
    } catch (error) { $('dialog-error').textContent = error.message; }
  };
  function updateFilters() { root.querySelector('.habit-filters').style.setProperty('--filter-index', ['all','pending','done'].indexOf(filter)); for (const button of root.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); }
  async function changeFilter(next) {
    if (next === filter) return;
    const order = ['all', 'pending', 'done'], direction = order.indexOf(next) > order.indexOf(filter) ? 1 : -1;
    const revision = ++filterRevision, results = $('filter-results');
    results.getAnimations().forEach(animation => animation.cancel());
    filter = next; updateFilters(); results.inert = true;
    if (!reducedMotion()) {
      const outgoing = results.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: .15, transform: `translateX(${-direction * 28}px)` }], { duration: 140, easing: 'ease-in' });
      await outgoing.finished.catch(() => {});
    }
    if (revision !== filterRevision || root.hidden) return;
    renderHabits(); results.inert = false; slide(results, direction);
  }
  for (const button of root.querySelectorAll('[data-filter]')) button.onclick = () => changeFilter(button.dataset.filter);
  function renderIconPicker() {
    $('icon-options').replaceChildren();
    for (const choice of iconChoices) { const button = document.createElement('button'); button.type = 'button'; button.innerHTML = iconSvg(choice.id); button.setAttribute('aria-label', choice.name + '图标'); button.setAttribute('aria-pressed', String(choice.id === selectedIcon)); button.onclick = () => { selectedIcon = choice.id; renderIconPicker(); }; $('icon-options').append(button); }
  }
  $('undo-delete').onclick = () => { if (!deletedHabit) return; const { habit, index } = deletedHabit; habits = [...habits.slice(0,index), habit, ...habits.slice(index)]; deletedHabit = null; renderHabits(); if (route==='archive') renderArchive(); notify('已恢复习惯与进度 · 演示'); };
  const manage=$('manage-dialog'); let managedId;
  function cancelHold() { clearTimeout(holdTimer); holdStart=null; }
  function openManage(habit) {
    cancelHold(); managedId=habit.id; $('manage-title').textContent=habit.name; $('archive-habit').textContent=habit.archived ? '恢复习惯' : '归档习惯';
    const active=habits.filter(item=>!item.archived), index=active.findIndex(item=>item.id===habit.id);
    $('move-up').disabled=habit.archived || index<=0; $('move-down').disabled=habit.archived || index===active.length-1;
    if (!manage.open) { manage.showModal(); manage.querySelector('.manage-actions button:not(:disabled)').focus({preventScroll:true}); }
  }
  $('close-manage').onclick=()=>manage.close();
  manage.addEventListener('close',()=>{ cancelHold(); setTimeout(()=>{suppressClick=false;},0); });
  for (const [id,amount] of [['move-up',-1],['move-down',1]]) $(id).onclick=()=> { habits=moveHabit(habits,managedId,amount); deletedHabit=null; renderHabits(); manage.close(); notify('顺序已调整 · 演示'); };
  $('archive-habit').onclick=()=> { const habit=habits.find(item=>item.id===managedId); habits=archiveHabit(habits,managedId,!habit.archived); deletedHabit=null; renderHabits(); if (route==='detail') refreshDetail(); if (route==='archive') renderArchive(); manage.close(); notify(habit.archived ? '已恢复习惯 · 演示' : '已归档，进度保留；可从“我的”恢复。'); };
  $('delete-managed').onclick=()=>{ const habit=habits.find(item=>item.id===managedId); manage.close(); openDialog(habit,'delete'); };
  // Block page pinch gestures and stationary double taps; retain single-finger scrolling and editing.
  let tapStart, previousTap, pinchActive = false;
  root.addEventListener('touchstart',event=> { if (event.touches.length>1) { pinchActive=true; tapStart=null; previousTap=null; cancelHold(); if(event.cancelable) event.preventDefault(); return; } tapStart=!pinchActive ? {x:event.touches[0].clientX,y:event.touches[0].clientY,at:Date.now()} : null; },{passive:false});
  root.addEventListener('touchmove',event=> { if (pinchActive || event.touches.length>1) { pinchActive=true; tapStart=null; cancelHold(); if(event.cancelable) event.preventDefault(); return; } if (tapStart && Math.hypot(event.touches[0].clientX-tapStart.x,event.touches[0].clientY-tapStart.y)>10) tapStart=null; },{passive:false});
  root.addEventListener('touchend',event=> { if (pinchActive) { if(event.cancelable) event.preventDefault(); pinchActive=event.touches.length>0; tapStart=null; previousTap=null; return; } if (!tapStart || Date.now()-tapStart.at>450 || event.target.closest('input,textarea,[contenteditable],#account-email,#data-message')) { previousTap=null; return; } const now=Date.now(); if (previousTap && now-previousTap.at<300 && Math.hypot(previousTap.x-tapStart.x,previousTap.y-tapStart.y)<24) { if(event.cancelable) event.preventDefault(); previousTap=null; } else previousTap={...tapStart,at:now}; tapStart=null; },{passive:false});
  root.addEventListener('touchcancel',()=>{pinchActive=false; tapStart=null; previousTap=null;},{passive:true});
  for (const type of ['gesturestart','gesturechange','gestureend']) document.addEventListener(type,event=> { if (!root.hidden && event.cancelable) event.preventDefault(); },{passive:false});
  $('logout').onclick = onLogout;
  $('check-data').onclick = async () => { const id = owner; $('check-data').disabled = true; try { const text = await onCheck(); if (owner === id) $('data-message').textContent = text; } catch { if (owner === id) $('data-message').textContent = '连接检查未完成，请联网后重试。'; } finally { $('check-data').disabled = false; } };
  $('reset-demo').onclick = () => { habits = sampleHabits(); logs=[]; selectedDay=localDay(); dates(); deletedHabit = null; filter = 'all'; updateFilters(); renderHabits(); if (route==='archive') renderArchive(); if (route==='detail') location.hash='/habits'; notify('已恢复初始演示。'); };
  const hashChange = () => { if (!root.hidden) setRoute(location.hash.slice(2)); };
  window.addEventListener('hashchange', hashChange);
  function dates() {
    const today=new Date();
    $('today-date').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(today);
    $('week-strip').replaceChildren();
    for (let i=-4;i<=2;i++) { const date=new Date(today); date.setDate(today.getDate()+i); const li=document.createElement('li'), button=document.createElement('button'); const key=localDay(date); button.innerHTML=`<span>${date.getMonth()+1}月 · ${['日','一','二','三','四','五','六'][date.getDay()]}</span><b>${date.getDate()}</b>`; button.setAttribute('aria-label',`${key}${i===0 ? ' 今天' : ''}`); button.setAttribute('aria-pressed',String(key===selectedDay)); if (key===selectedDay) li.className='today'; button.onclick=()=>{ selectedDay=key; dates(); renderHabits(); slide($('habit-list'),i<0 ? -1 : 1); }; li.append(button); $('week-strip').append(li); }
  }
  return {
    enter(user) { const now = new Date(); const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`; if (owner !== user.id || dayKey !== todayKey) { habits = sampleHabits(); logs=[]; selectedDay=localDay(); filter = 'all'; updateFilters(); } owner = user.id; dayKey = todayKey; $('account-email').textContent = preview ? '公开演示，不使用真实账户' : user.email || '已登录'; $('data-message').textContent = ''; dates(); renderHabits(); root.hidden = false; document.body.classList.add('workspace-active'); document.documentElement.classList.add('workspace-active'); const requested = location.hash.slice(2); setRoute(requested || 'habits'); location.hash = route==='detail' ? `/habit/${detailId}` : `/${route}`; },
    leave(reset = false) { root.hidden = true; ++filterRevision; $('filter-results').getAnimations().forEach(animation=>animation.cancel()); $('filter-results').inert=false; pinchActive=false; tapStart=null; previousTap=null; document.body.classList.remove('workspace-active'); document.documentElement.classList.remove('workspace-active'); cancelHold(); if (manage.open) manage.close(); $('account-email').textContent = ''; $('data-message').textContent = ''; if (dialog.open) dialog.close(); deletedHabit = null; $('habit-form').reset(); clearTimeout(toastTimer); $('workspace-toast').hidden = true; if (reset) { owner = null; habits = sampleHabits(); logs=[]; } },
    isEditing() { return dialog.open || manage.open; }
  };
}
