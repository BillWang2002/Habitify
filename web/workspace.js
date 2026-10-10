import {appearanceHtml,createAppearance} from './appearance.js';
import { adminPageHtml, createAdminPage } from './admin.js';
import { accountHeader } from './account-header.js';
import { accountPagesHtml } from './account-pages.js';
import { checkinErrors, showFieldErrors } from './form-validation.js';
import { createStatistics } from './statistics.js';
import { sampleHabits, isComplete, todaySummary, setProgress, addHabit, removeHabit, archiveHabit, moveHabit } from './habits-model.js';
import { defaultTheme, currentIconChoices, iconSvg, resolveHabitIcon } from './theme.js';
import { createNavigation } from './navigation.js';
import { renderDetail, localDay } from './habit-details.js';
import { isCurrentSnapshot } from './habits-api.js';
import { coinRulesHtml } from './coin-rules.js';
const routes = ['habits', 'rewards', 'stats', 'me'];
const accountRoutes = ['appearance', 'coin-rules', 'developer', 'archive', 'inbox', 'feedback', 'admin-login','admin/overview','admin/members','admin/announcements','admin/feedback','admin/audit'];
const option = (tag, attrs, icon, label, description = '') => `<${tag} ${attrs} class="account-row"><span class="account-row-icon">${iconSvg(icon)}</span><span class="account-row-copy"><strong>${label}</strong>${description ? `<small>${description}</small>` : ''}</span><span class="account-row-chevron" aria-hidden="true">›</span></${tag}>`;
export function createWorkspace(root, { onLogout = () => {}, preview = false, adminApi, appearanceRequest, request = async () => { throw new Error('打卡服务尚未连接。'); } } = {}) {
  let owner, habits = preview ? sampleHabits() : [], filter = 'all', route = 'habits', activeHabit, lastFocus, toastTimer, selectedIcon = 'leaf', detailId, logs = [], selectedDay = localDay(), detailMonth = [new Date().getFullYear(), new Date().getMonth()], holdTimer, holdStart, suppressClick = false, filterRevision = 0, resultAnimations = [], resultGhost;
  let account=null, snapshot=null, records=[], epoch=0, writing=false, loaded=preview, pending=null;
  const currentDay=()=>snapshot?.today || localDay();
  root.innerHTML = `<div class="app-frame">

    <div class="app-content" id="workspace-content">
      <p class="demo-notice" id="sync-status" role="status">${preview ? '公开界面预览 · 数据不保存，不发金币' : '正在读取你的打卡…'}</p><button id="retry-data" class="sync-retry" hidden>重试连接</button>
      <section data-page="habits" aria-label="今日打卡">
        <div class="page-title"><div><p id="today-date" class="date-label"></p><h1>今日打卡</h1></div><button class="add-habit" id="add-habit" aria-label="添加打卡">＋</button></div>
        <ol class="week-strip" id="week-strip" aria-label="本周日期"></ol>
        <section class="growth-card" aria-label="今日行动状态"><div><span class="growth-eyebrow">一点行动，一点成长</span><h2 id="growth-title">让今天，向前一点。</h2><p id="action-status"></p><span id="completion-count"></span></div><div class="growth-seed" aria-hidden="true"><i></i><b></b><em></em></div><div class="growth-meter"><span id="completion-meter"></span></div></section>
        <div class="habit-toolbar"><h2>我的打卡 <span id="habit-count"></span></h2><div class="habit-filters" aria-label="筛选打卡"><span class="filter-slider" aria-hidden="true"></span><button data-filter="all" aria-pressed="true">全部</button><button data-filter="pending" aria-pressed="false">待完成</button><button data-filter="done" aria-pressed="false">已完成</button></div></div>
        <p id="selected-day-note" class="dialog-note"></p><div id="filter-results"><div id="habit-list" class="habit-list"></div><div id="habit-empty" class="habit-empty" hidden><span aria-hidden="true">🌱</span><h3 id="empty-title"></h3><p id="empty-note"></p></div></div>
        <p class="habits-footnote">点击卡片查看详情 · 右侧打卡 · 长按管理打卡。</p>
      </section>
      <section data-page="detail" id="habit-detail" hidden aria-label="打卡详情"></section>
      <section data-page="archive" id="habit-archive" hidden>${accountHeader({group:'我的空间',title:'已归档打卡'})}<p class="dialog-note">归档保留历史与已完成记录；恢复后重新加入今日列表。</p><div id="archive-list" class="habit-list"></div></section>
      <section data-page="rewards" hidden><div class="page-title"><div><p class="date-label">让努力有一点小期待</p><h1>激励</h1></div></div><div class="module-intro"><span aria-hidden="true">✦</span><h2>为你的成长，留一份奖励。</h2><p><strong id="reward-balance">0</strong> 金币 · 通过行动慢慢积累。兑换后续开放。</p></div><div class="module-item"><strong>商店与背包</strong><p>主题、奖杯、徽章、代金券与补签卡</p><span>后续开放</span></div><div class="module-item"><strong>展示墙</strong><p>摆放属于你的收藏与成长记忆</p><span>后续开放</span></div></section>
      <section data-page="stats" id="statistics-page" hidden></section>
      <section data-page="me" hidden><div class="page-title"><div><p class="date-label">照顾好自己的成长节奏</p><h1>我的</h1></div></div><section class="my-account-card" aria-label="当前账户与个人数据"><div class="profile-card"><span id="profile-avatar" aria-hidden="true">${iconSvg('me')}</span><div><strong id="account-name"></strong><p id="account-email"></p></div></div><p id="profile-status" class="profile-status" role="status"></p><dl class="account-facts"><div><dt>加入日期</dt><dd id="account-created">—</dd></div><div><dt>账户时区</dt><dd id="account-timezone">—</dd></div></dl><div class="profile-metrics"><div><strong id="profile-coins">—</strong><span>金币余额</span></div><div><strong id="profile-active">—</strong><span>进行中打卡</span></div><div><strong id="profile-completed">—</strong><span>累计达标次数</span></div></div></section><div class="account-section"><h2>我的空间</h2><div class="account-list">${option('a','href="#/inbox"','inbox','收件箱','公告、通知与反馈回复')}${option('a','href="#/archive"','archive','已归档打卡','保留记录，随时恢复')}${option('a','href="#/coin-rules"','coins','金币规则','了解行动与连续奖励')}${option('a','href="#/appearance"','palette','外观与头像','主题套装、背景与个人装扮')}<div class="account-row is-unavailable"><span class="account-row-icon">${iconSvg('target')}</span><span class="account-row-copy"><strong>展示墙</strong><small>藏品与成长记忆</small></span><span class="account-row-badge">后续开放</span></div></div></div><div class="account-section"><h2>工具与账户</h2><div class="account-list">${option('a','href="#/feedback"','feedback','意见反馈','分享建议或报告问题')}${option('a','href="#/developer"','code','开发者模式','连接与应用诊断')}${option('button','id="logout" type="button"','logout',preview ? '返回登录页' : '退出登录')}</div></div></section>
      <section data-page="developer" hidden>${accountHeader({group:'工具与账户',title:'开发者模式'})}<p class="dialog-note">检查连接与应用状态。</p><div class="account-section"><h2>数据连接</h2><div class="account-list">${option('button','id="check-data" type="button"','refresh','刷新我的数据','重新读取当前账户的云端记录')}</div><p id="data-message" class="account-feedback" role="status"></p></div><div class="account-section"><h2>应用检查</h2><div class="account-list">${option('a','href="./diagnostics/pwa.html"','diagnostics','PWA 应用检查','安装、版本与缓存状态')}</div></div><div class="account-section"><h2>后台管理</h2><div class="account-list">${option('a','href="#/admin-login"','shield','开发人员登录','后台管理入口')}</div></div></section>
      ${appearanceHtml()}
      ${accountPagesHtml()}
      ${adminPageHtml()}
      <section data-page="coin-rules" hidden>${accountHeader({group:'我的空间',title:'金币规则'})}<div id="coin-rules-content"></div></section>
    </div>
    <nav class="app-nav" aria-label="主要导航"><span class="nav-slider" aria-hidden="true"></span><a href="#/habits" data-route="habits" aria-current="page"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.habits)}</span>打卡</a><a href="#/rewards" data-route="rewards"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.rewards)}</span>激励</a><a href="#/stats" data-route="stats"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.stats)}</span>统计</a><a href="#/me" data-route="me"><span aria-hidden="true">${iconSvg(defaultTheme.navigation.me)}</span>我的</a></nav>
    <div class="app-toast" id="workspace-toast" hidden><span id="toast-text" role="status" aria-live="polite"></span></div>
    <dialog id="manage-dialog" class="habit-dialog manage-dialog" aria-labelledby="manage-title"><div class="dialog-heading"><h2 id="manage-title" tabindex="-1" autofocus></h2><button id="close-manage" aria-label="关闭管理菜单">×</button></div><p class="dialog-note">长按与更多按钮均可进入此菜单。</p><div class="manage-actions"><button id="move-up">上移一位</button><button id="move-down">下移一位</button><button id="archive-habit">归档打卡</button><button id="delete-managed" class="danger-text">删除打卡</button></div></dialog>
    <dialog id="habit-dialog" class="habit-dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><h2 id="dialog-title" tabindex="-1" autofocus></h2><button id="close-dialog" aria-label="关闭">×</button></div><form id="habit-form" novalidate><div id="create-fields"><label for="habit-name">打卡名称</label><input id="habit-name" maxlength="30" placeholder="例如：睡前读书" aria-describedby="habit-name-error"><p id="habit-name-error" class="field-error" role="status" hidden></p><fieldset class="icon-picker"><legend>打卡图标</legend><div id="icon-options"></div><p class="dialog-note">基础图标免费；更多个性图案后续开放。</p></fieldset><label id="kind-label">记录方式</label><input id="habit-kind" type="hidden" value="complete"><div class="kind-select"><button id="kind-trigger" type="button" aria-labelledby="kind-label kind-value" aria-haspopup="listbox" aria-expanded="false"><span id="kind-value">完成型 · 做完就打卡</span><span aria-hidden="true">⌄</span></button><div id="kind-options" role="listbox" aria-labelledby="kind-label" hidden><button type="button" role="option" data-kind="complete" aria-selected="true">完成型 · 做完就打卡</button><button type="button" role="option" data-kind="quantity" aria-selected="false">数量型 · 达到目标才完成</button></div></div><div id="quantity-fields" hidden><label for="habit-goal">每日目标</label><input id="habit-goal" type="number" inputmode="numeric" min="1" max="100000" step="1" value="8" aria-describedby="habit-goal-error"><p id="habit-goal-error" class="field-error" role="status" hidden></p><label for="habit-unit">单位</label><input id="habit-unit" maxlength="6" placeholder="杯、分钟、页" aria-describedby="habit-unit-error"><p id="habit-unit-error" class="field-error" role="status" hidden></p></div><label for="habit-note">备注（可选）</label><input id="habit-note" maxlength="200" placeholder="给这项打卡留一句提醒" aria-describedby="habit-note-error"><p id="habit-note-error" class="field-error" role="status" hidden></p><p class="dialog-note">当前按每天计划；达标奖励统一由金币规则规定。</p></div><div id="delete-fields" hidden><p class="dialog-note">删除后无法撤回。今日进度及失效金币奖励会清除，历史记录保留。若只是暂时停止，建议使用归档。</p><label for="delete-name">输入打卡名称确认</label><p id="delete-expected" class="delete-expected"></p><input id="delete-name" maxlength="30" autocomplete="off" spellcheck="false" aria-describedby="delete-name-error"><p id="delete-name-error" class="field-error" role="status" hidden></p></div><div id="progress-fields" hidden><label for="habit-progress">今日累计进度</label><input id="habit-progress" type="number" inputmode="numeric" min="0" step="1" aria-describedby="habit-progress-error"><p id="habit-progress-error" class="field-error" role="status" hidden></p><p id="progress-note" class="dialog-note"></p></div><p id="dialog-error" role="status" class="message"></p><button class="primary" id="save-habit" type="submit"></button></form></dialog>
  </div>`;
  const $ = id => root.querySelector(`#${id}`);
  const appearance=createAppearance(root,{request:appearanceRequest,preview});
  const admin = createAdminPage(root,{api:adminApi,preview,onNavigate:(path,options)=>navigation.navigate(path,options),onExitMessage:notify});
  const statistics = createStatistics($('statistics-page'), {onHabit:id=>navigation.navigate(`habit/${id}`)});
  const dialog = $('habit-dialog');
  const navigation = createNavigation({
    normalize: next => next.startsWith('habit/') && habits.some(item=>item.id===next.slice(6)) ? next : [...routes,'archive',...accountRoutes].includes(next) ? next : 'habits',
    readView: () => ({ statistics:statistics.getView(), filter, selectedDay, scroll: $('workspace-content').scrollTop, detailMonth: [...detailMonth], filterHeight: $('filter-results').style.minHeight, logsOpen: !!$('habit-detail').querySelector('#detail-logs')?.open }),
    onChange: (next, { source, view }) => {
      cancelHold(); cancelResultsTransition(); $('filter-results').style.minHeight=view?.filterHeight || '';
      root.querySelectorAll('[data-page], #filter-results').forEach(element=>element.getAnimations().forEach(animation=>animation.cancel()));
      if (dialog.open) dialog.close(); if ($('manage-dialog').open) $('manage-dialog').close();
      if (view) { filter=view.filter; selectedDay=view.selectedDay; detailMonth=[...view.detailMonth]; }
      updateFilters(); dates(); renderHabits();
      setRoute(next, { animate: source==='navigate', view });
    }
  });
  $('workspace-content').addEventListener('scroll',()=>navigation.remember(),{passive:true});
  root.addEventListener('click',event=> {
    const link=event.target.closest('a[href^="#/"]');
    if (!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.classList.contains('back-link')) navigation.back(link.getAttribute('href').slice(2)); else navigation.navigate(link.getAttribute('href').slice(2));
  });
  function notify(text) { clearTimeout(toastTimer); $('toast-text').textContent = text; $('workspace-toast').hidden = false; toastTimer = setTimeout(() => { $('workspace-toast').hidden = true; }, 3500); }
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slideDuration = () => parseFloat(getComputedStyle(root).getPropertyValue('--slide-duration')) || 480;
  const slideEasing = 'cubic-bezier(.22,.8,.28,1)';
  function slide(element, direction = 1, duration = 420) {
    element.getAnimations().forEach(animation => animation.cancel());
    if (!reducedMotion()) element.animate([{ opacity: .4, transform: `translateX(${direction * 44}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration, easing: slideEasing });
  }
  function setRoute(next, { animate = true, view = null } = {}) {
    const oldRoute = route;
    if (next.startsWith('habit/')) { const id = next.slice(6); if (habits.some(item=>item.id===id)) { detailId=id; route='detail'; detailMonth=view?.detailMonth || [new Date().getFullYear(),new Date().getMonth()]; refreshDetail(); if(view?.logsOpen) $('habit-detail').querySelector('#detail-logs').open=true; } else route='habits'; }
    else if(next.startsWith('admin/')) route='admin';
    else route = [...routes,'archive',...accountRoutes].includes(next) ? next : 'habits';
    if (route === 'appearance') appearance.show(); else appearance.hide();
    if (route === 'archive') renderArchive();
    root.classList.toggle('admin-active',route==='admin');
    $('sync-status').hidden=route==='admin';
    if(route==='admin-login' || route==='admin') admin.show(route==='admin' ? next.slice(6) : null); else admin.hide();
    root.querySelector('.app-nav').style.setProperty('--nav-index', Math.max(0,routes.indexOf((accountRoutes.includes(route) || route==='admin') ? 'me' : route)));
    for (const page of root.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== route;
    if(route==='stats' && view?.statistics) statistics.setView(view.statistics);
    for (const link of root.querySelectorAll('[data-route]')) { if (link.dataset.route === ((accountRoutes.includes(route) || route==='admin') ? 'me' : ['detail','archive'].includes(route) ? 'habits' : route)) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
    $('workspace-content').scrollTop = view?.scroll || 0;
    if (animate && oldRoute !== route) { slide(route==='admin' ? root.querySelector('.admin-content') : root.querySelector(`[data-page="${route}"]`), (routes.includes(route) ? routes.indexOf(route) : 4) < (routes.includes(oldRoute) ? routes.indexOf(oldRoute) : 4) ? -1 : 1); }
  }
  function refreshDetail() {
    const habit = habits.find(item=>item.id===detailId); if (!habit) return;
    const expanded = $('habit-detail').querySelector('#detail-logs')?.open;
    renderDetail($('habit-detail'), habit, logs, detailMonth, { records, busy:writing || !loaded, today:currentDay(), onMenu:()=>openManage(habit), onProgress:()=> { if (habit.kind==='quantity' || isComplete(habit)) openDialog(habit, habit.kind==='quantity' ? 'progress' : 'undo'); else updateProgress(habit.id,1).catch(()=>{}); } });
    if (expanded) $('habit-detail').querySelector('#detail-logs').open=true;
    for (const [id,amount] of [['month-prev',-1],['month-next',1]]) $('habit-detail').querySelector(`#${id}`).onclick=()=> { const date=new Date(detailMonth[0],detailMonth[1]+amount,1); detailMonth=[date.getFullYear(),date.getMonth()]; refreshDetail(); };
  }
  function renderArchive() {
    $('archive-list').replaceChildren();
    const archived=habits.filter(item=>item.archived);
    for (const habit of archived) $('archive-list').append(createHabitCard(habit,{archived:true}));
    if (!archived.length) $('archive-list').innerHTML=`<div class="archive-empty"><span>${iconSvg('archive')}</span><h2>暂时没有归档打卡</h2><p>不再进行的打卡可以先归档，<br>历史记录会留在这里，随时都能恢复。</p><a href="#/habits">看看今日打卡 ${iconSvg('checkin')}</a></div>`;
  }
  function createHabitCard(habit, {archived=false,isToday=true}={}) {
      const done = isComplete(habit), card = document.createElement('article'); card.className = `habit-card ${archived ? 'is-archived' : done ? 'is-complete' : ''}`;
      card.innerHTML = `<span class="habit-icon ${resolveHabitIcon(habit.icon)}" aria-hidden="true">${iconSvg(resolveHabitIcon(habit.icon))}</span><div class="habit-info"><button class="habit-open"><h3></h3><span class="habit-description"></span></button><progress></progress><div class="recent-days" aria-label="最近七天的记录"></div></div><div class="habit-controls"><button class="habit-action"></button><button class="habit-more" aria-label="更多操作">•••</button></div>`;
      card.dataset.habitId = habit.id; card.querySelector('h3').textContent=habit.name;
      const open=card.querySelector('.habit-open'); open.setAttribute('aria-label', `查看${habit.name}详情`); open.onclick=()=>navigation.navigate(`habit/${habit.id}`);
      card.querySelector('.habit-description').textContent = `${habit.progress} / ${habit.goal} ${habit.unit} · ${archived ? '已归档' : done ? '已完成' : '待完成'}`;
      const more=card.querySelector('.habit-more'); more.setAttribute('aria-label', `${habit.name}更多操作`); more.onclick=()=>openManage(habit);
      const action=card.querySelector('.habit-action'); action.textContent = archived ? '已归档' : !isToday ? '仅查看' : done ? '✓ 完成' : habit.kind==='quantity' ? `＋${habit.step} ${habit.unit}` : '打卡'; action.disabled=(!archived && !isToday) || writing || !loaded;
      action.setAttribute('aria-label', `${habit.name}：${archived ? '归档管理' : done ? '修改或撤销完成' : habit.kind==='quantity' ? `增加 ${habit.step} ${habit.unit}` : '打卡'}`);
      action.onclick=()=> { if (archived) openManage(habit); else if (done) openDialog(habit,habit.kind==='complete' ? 'undo' : 'progress'); else updateProgress(habit.id,Math.min(habit.goal,habit.progress+habit.step)).catch(()=>{}); };
      const progress=card.querySelector('progress'); progress.max=habit.goal; progress.value=habit.progress; progress.setAttribute('aria-label', `${habit.name}进度`);
      for (let i=6;i>=0;i--) { const date=new Date(`${currentDay()}T12:00:00`); date.setDate(date.getDate()-i); const key=localDay(date), r=records.find(item=>item.habitId===habit.id && item.day===key); const marker=document.createElement('span'); marker.textContent=date.getDate(); const state=r?.progress>=r?.goal ? '已完成' : r?.progress ? '部分进度' : key===currentDay() ? '待完成' : '无完成记录'; marker.className=state==='已完成' ? 'recent-done' : state==='部分进度' ? 'recent-partial' : i===0 ? 'recent-today' : 'recent-unknown'; marker.setAttribute('aria-label',`${key}：${state}`); card.querySelector('.recent-days').append(marker); }
      card.addEventListener('pointerdown',event=> { if (event.button!==0 || event.target.closest('.habit-controls') || !event.isPrimary) return; cancelHold(); holdStart={x:event.clientX,y:event.clientY}; holdTimer=setTimeout(()=> { suppressClick=true; openManage(habit); },550); });
      card.addEventListener('pointermove',event=> { if (holdStart && Math.hypot(event.clientX-holdStart.x,event.clientY-holdStart.y)>10) cancelHold(); });
      for (const event of ['pointerup','pointercancel','pointerleave']) card.addEventListener(event,cancelHold);
      card.addEventListener('click',event=> { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick=false; } },true);
      card.addEventListener('contextmenu',event=> { if (!event.target.closest('.habit-controls')) { event.preventDefault(); openManage(habit); } });
      card.addEventListener('click',event=> { if (!event.target.closest('button')) navigation.navigate(`habit/${habit.id}`); });
      return card;
  }
  function renderHabits() {
    const summary = todaySummary(habits); if(snapshot) summary.actionDay=snapshot.actionDay;
    $('action-status').textContent = summary.actionDay ? habits.some(item=>item.archived && isComplete(item)) ? '今天已成为行动日，包含归档前已完成的行动。' : '今天已成为行动日，继续按自己的节奏前进。' : '今天还没有完成的打卡，从一件小事开始。';
    $('growth-title').textContent = summary.actionDay ? '今天，已经向前一步。' : '让今天，向前一点。';
    $('completion-count').textContent = `${summary.completed} / ${summary.total} 项打卡已完成`;
    $('completion-meter').style.width = `${summary.total ? summary.completed / summary.total * 100 : 0}%`;
    $('habit-count').textContent = habits.length;
    const active = habits.filter(item=>!item.archived && (!item.startDay || item.startDay<=selectedDay)), isToday = selectedDay === currentDay();
    $('habit-count').textContent = active.length;
    $('selected-day-note').textContent = isToday ? '完成至少一项打卡，今天就成为行动日。' : `${selectedDay} · 历史日期仅查看，补签后续开放。`;
    const shown = active.map(item=>isToday ? item : {...item,progress:records.find(r=>r.habitId===item.id && r.day===selectedDay)?.progress || 0,goal:records.find(r=>r.habitId===item.id && r.day===selectedDay)?.goal || item.goal}).filter(item => filter === 'all' || (filter === 'done' ? isComplete(item) : !isComplete(item)));
    $('habit-list').replaceChildren();
    for (const habit of shown) $('habit-list').append(createHabitCard(habit,{isToday}));
    $('habit-empty').hidden = shown.length > 0;
    $('empty-title').textContent = !isToday ? '该日期没有符合筛选的打卡' : !active.length ? '从你的第一项打卡开始' : filter === 'done' ? '今天的第一步，等你出发' : '今天的计划，都完成了';
    $('empty-note').textContent = !isToday ? '返回今天可继续打卡；补签后续开放。' : !active.length ? '点击右上角 ＋，添加一件想坚持的小事。' : filter === 'done' ? '完成型打卡或数量达到目标后，会出现在这里。' : '按自己的节奏，明天继续。';
    if(!loaded) { $('empty-title').textContent='等待连接你的打卡'; $('empty-note').textContent='联网读取成功后即可添加和打卡。'; }
  }
  function applySnapshot(data) {
    if(!isCurrentSnapshot(data,snapshot)) return;
    statistics.update(data);
    snapshot=data; habits=data.habits; records=data.records; logs=data.logs; loaded=true;
    renderProfile();
    $('reward-balance').textContent=data.balance;
    $('coin-rules-content').innerHTML=coinRulesHtml(data.rules);
    $('sync-status').textContent=`已同步 · 账户时区 ${data.timezone}`; $('retry-data').hidden=true;
    renderHabits(); if(route==='detail') refreshDetail(); if(route==='archive') renderArchive();
  }
  function renderProfile() {
    $('account-name').textContent=preview ? '预览访客' : account?.user_metadata?.display_name || account?.user_metadata?.nickname || '当前账户';
    $('account-email').textContent=preview ? '公开预览，不使用真实账户' : account?.email || '已登录';
    const created=account?.created_at ? new Date(account.created_at) : null;
    $('account-created').textContent=!preview && created && !Number.isNaN(created.getTime()) ? new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}).format(created) : '—';
    const ready=!preview && loaded && snapshot;
    $('account-timezone').textContent=ready ? snapshot.timezone : '—';
    $('profile-coins').textContent=ready ? snapshot.balance : '—';
    $('profile-active').textContent=ready ? habits.filter(h=>!h.archived).length : '—';
    $('profile-completed').textContent=ready ? records.filter(r=>r.progress>=r.goal).length : '—';
    $('profile-status').textContent=preview ? '个人数据在登录后展示。' : ready ? '个人数据已同步至当前账户' : snapshot ? '连接未完成，请在开发者模式重试同步。' : '等待连接个人数据…';
  }
  async function loadData() {
    const token=epoch; const id=owner; $('sync-status').textContent='正在读取你的打卡…';
    try { const data=await request({op:'snapshot'}); if(token!==epoch || id!==owner || !isCurrentSnapshot(data,snapshot)) return; if(!snapshot || snapshot.today!==data.today) selectedDay=data.today; applySnapshot(data); dates(); }
    catch(error) { if(token!==epoch || id!==owner) return; loaded=false; renderProfile(); $('profile-status').textContent='连接未完成，请在开发者模式重试同步。'; $('sync-status').textContent=error.message; $('retry-data').hidden=false; renderHabits(); if(route==='archive') renderArchive(); }
  }
  async function mutate(payload, local) {
    if(writing) throw new Error('正在保存，请稍候。');
    if(preview) { local(); renderHabits(); return; }
    if(!loaded) { notify('请先恢复数据连接。'); throw new Error('请先恢复数据连接。'); }
    if(pending) { notify('上次保存尚未确认，请先重试原操作。'); throw new Error('上次保存尚未确认，请先重试原操作。'); }
    pending={...payload,day:snapshot.today,revision:snapshot.revision,requestId:crypto.randomUUID()};
    return sendPending();
  }
  async function sendPending() {
    if(writing || !pending) return;
    const token=epoch; writing=true; root.setAttribute('aria-busy','true'); $('sync-status').textContent='正在保存…'; renderHabits(); if(route==='archive') renderArchive();
    try {
      const data=await request(pending); if(token!==epoch) return;
      pending=null; applySnapshot(data); return data;
    } catch(error) {
      if(token!==epoch) return;
      if(error.code!=='NETWORK_ERROR') pending=null;
      $('sync-status').textContent=error.message; $('retry-data').hidden=false; notify(error.message);
      if(['STALE_DATA','TODAY_CHANGED','HABIT_NOT_FOUND'].includes(error.code)) await loadData();
      throw error;
    } finally { if(token===epoch) { writing=false; root.removeAttribute('aria-busy'); renderHabits(); if(route==='detail') refreshDetail(); if(route==='archive') renderArchive(); } }
  }
  $('retry-data').onclick=async()=>{ try { if(pending) await sendPending(); else await loadData(); } catch {} };
  async function updateProgress(id, value) {
    const token=epoch; const previous=habits.find(item=>item.id===id); if(!previous) return;
    const wasComplete=isComplete(previous), before=todaySummary(habits).actionDay;
    await mutate({op:'progress',habitId:id,value},()=>{habits=setProgress(habits,id,value); if(previous.progress!==value) logs.push({habitId:id,from:previous.progress,to:value,at:new Date().toISOString(),day:currentDay()});});
    if(token!==epoch) return;
    const habit=habits.find(item=>item.id===id); if(!habit) return;
    const card=[...root.querySelectorAll('.habit-card')].find(item=>item.dataset.habitId===id);
    card?.classList.add(!wasComplete && isComplete(habit) ? 'celebrate' : 'progress-feedback');
    if(!reducedMotion() && !before && todaySummary(habits).actionDay) root.querySelector('.growth-card').animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:450});
    notify(!before && todaySummary(habits).actionDay ? '已保存，今天成为行动日。' : '进度已保存。');
  }
  const fieldIds=['delete-name','habit-name','habit-goal','habit-unit','habit-note','habit-progress'];
  for(const id of fieldIds) $(id).addEventListener('input',()=>showFieldErrors(root,{},[id],{focus:false}));
  function openDialog(habit, mode = 'create') {
    showFieldErrors(root,{},fieldIds,{focus:false});
    activeHabit = habit ? { id: habit.id, mode } : { mode }; lastFocus = document.activeElement;
    $('habit-form').reset(); $('dialog-error').textContent = ''; selectedIcon = 'leaf'; renderIconPicker(); setKind('complete');
    $('create-fields').hidden = mode !== 'create'; $('progress-fields').hidden = mode !== 'progress'; $('delete-fields').hidden = mode !== 'delete'; $('delete-name').disabled = mode !== 'delete'; if(mode==='delete') $('delete-expected').textContent=habit.name; $('quantity-fields').hidden = true;
    $('habit-name').required = mode === 'create'; $('habit-progress').required = mode === 'progress';
    $('habit-progress').disabled = mode !== 'progress'; $('habit-goal').disabled = true; $('habit-unit').disabled = true;
    $('dialog-title').textContent = mode === 'create' ? '添加一项打卡' : mode === 'delete' ? `删除“${habit.name}”？` : mode === 'undo' ? '撤销这次完成？' : habit.name;
    $('save-habit').textContent = mode === 'create' ? '添加打卡' : mode === 'delete' ? '确认删除' : mode === 'undo' ? '确认撤销' : '保存进度';
    if (mode === 'progress') { $('habit-progress').value = habit.progress; $('habit-progress').max = habit.goal; $('progress-note').textContent = `目标 ${habit.goal} ${habit.unit}；达到目标才算完成。输入 0 可清除今日进度。`; }
    if (mode === 'undo') $('dialog-error').textContent = '撤销后重新计算今日完成数；没有其他完成打卡时，今天不再是行动日。不再成立的金币奖励将同步撤回。';
    $('save-habit').classList.toggle('danger', mode === 'delete');

    dialog.showModal(); $('dialog-title').focus({preventScroll:true});
  }
  function closeDialog() { $('kind-options').hidden=true; dialog.close(); if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true}); }
  $('add-habit').onclick = () => { if(!loaded) { notify('请先恢复数据连接。'); return; } openDialog(null); };
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
  $('habit-form').onsubmit = async event => {
    event.preventDefault(); if(writing) return;
    const token=epoch, action={...activeHabit};
    const errors=checkinErrors(action.mode,{name:$('habit-name').value,kind:$('habit-kind').value,goal:$('habit-goal').value,unit:$('habit-unit').value,note:$('habit-note').value,progress:$('habit-progress').value,confirmationName:$('delete-name').value,expectedName:habits.find(h=>h.id===action.id)?.name},habits.find(h=>h.id===action.id)?.goal || 0);
    if(!showFieldErrors(root,errors,fieldIds)) return;
    $('dialog-error').textContent=''; $('save-habit').disabled=true;
    try {
      if(action.mode==='create') {
        const values={name:$('habit-name').value.trim(),kind:$('habit-kind').value,goal:Number($('habit-goal').value),unit:$('habit-unit').value.trim(),icon:selectedIcon,note:$('habit-note').value.trim()};
        addHabit([],values,'validate');
        await mutate({op:'create',...values},()=>{habits=addHabit(habits,values,crypto.randomUUID());});
        if(token!==epoch) return; filter='all'; selectedDay=currentDay(); dates(); updateFilters(); renderHabits(); $('habit-list').lastElementChild?.classList.add('habit-added'); notify('新打卡已保存，迈出第一步吧。');
      } else if(action.mode==='delete') {
        await mutate({op:'delete',habitId:action.id,confirmationName:$('delete-name').value},()=>{habits=removeHabit(habits,action.id);});
        if(token!==epoch) return; if(route==='detail') navigation.navigate('habits',{replace:true}); if(route==='archive') renderArchive(); notify('打卡已删除。');
      } else await updateProgress(action.id,action.mode==='undo' ? 0 : Number($('habit-progress').value));
      if(token!==epoch) return; closeDialog();
      if(action.mode==='create') { const card=$('habit-list').lastElementChild; if(card) { card.tabIndex=-1; card.focus({preventScroll:true}); card.scrollIntoView({block:'nearest',behavior:reducedMotion() ? 'instant' : 'smooth'}); } }
    } catch(error) { if(token===epoch) $('dialog-error').textContent=error.message; }
    finally { if(token===epoch) $('save-habit').disabled=false; }
  };
  function updateFilters() { root.querySelector('.habit-filters').style.setProperty('--filter-index', ['all','pending','done'].indexOf(filter)); for (const button of root.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); }
  function cancelResultsTransition() {
    ++filterRevision;
    resultAnimations.forEach(animation => animation.cancel()); resultAnimations = [];
    resultGhost?.remove(); resultGhost = null;
    $('filter-results').inert = false;
    $('filter-results').classList.remove('is-switching');
  }
  async function changeResults(update, direction) {
    const results = $('filter-results');
    const oldContent = $('habit-empty').hidden ? $('habit-list') : $('habit-empty');
    const oldStyle = getComputedStyle(oldContent);
    const previousTransform = oldStyle.transform, previousOpacity = oldStyle.opacity;
    const snapshot = reducedMotion() ? null : oldContent.cloneNode(true);
    cancelResultsTransition(); const revision = filterRevision;
    // Keep the scroll range while both visual layers slide together.
    results.style.minHeight = `${Math.max(results.scrollHeight, results.getBoundingClientRect().height)}px`;
    update(); renderHabits();
    if (!snapshot || root.hidden) return;
    snapshot.removeAttribute('id'); snapshot.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    snapshot.classList.add('result-ghost'); snapshot.setAttribute('aria-hidden', 'true'); snapshot.inert = true;
    resultGhost = snapshot; results.append(snapshot); results.inert = true; results.classList.add('is-switching');
    const newContent = $('habit-empty').hidden ? $('habit-list') : $('habit-empty');
    const options = { duration: slideDuration(), easing: slideEasing };
    resultAnimations = [
      snapshot.animate([{ opacity: previousOpacity, transform: previousTransform }, { opacity: 0, transform: `translateX(${-direction * 44}px)` }], options),
      newContent.animate([{ opacity: 0, transform: `translateX(${direction * 44}px)` }, { opacity: 1, transform: 'translateX(0)' }], options)
    ];
    await Promise.all(resultAnimations.map(animation => animation.finished.catch(() => {})));
    if (revision === filterRevision) cancelResultsTransition();
  }
  function changeFilter(next) {
    if (next === filter) return;
    const order = ['all', 'pending', 'done'], direction = order.indexOf(next) > order.indexOf(filter) ? 1 : -1;
    return changeResults(() => { filter = next; updateFilters(); }, direction);
  }
  for (const button of root.querySelectorAll('[data-filter]')) button.onclick = () => changeFilter(button.dataset.filter);
  function renderIconPicker() {
    $('icon-options').replaceChildren();
    for (const choice of currentIconChoices()) { const button = document.createElement('button'); button.type = 'button'; button.innerHTML = iconSvg(choice.id); button.setAttribute('aria-label', choice.name + '图标'); button.setAttribute('aria-pressed', String(choice.id === selectedIcon)); button.onclick = () => { selectedIcon = choice.id; renderIconPicker(); }; $('icon-options').append(button); }
  }

  const manage=$('manage-dialog'); let managedId;
  function cancelHold() { clearTimeout(holdTimer); holdStart=null; }
  function openManage(habit) {
    cancelHold(); managedId=habit.id; $('manage-title').textContent=habit.name; $('archive-habit').textContent=habit.archived ? '恢复打卡' : '归档打卡';
    const active=habits.filter(item=>!item.archived), index=active.findIndex(item=>item.id===habit.id);
    $('move-up').disabled=habit.archived || index<=0; $('move-down').disabled=habit.archived || index===active.length-1;
    if (!manage.open) { manage.showModal(); $('manage-title').focus({preventScroll:true}); }
  }
  $('close-manage').onclick=()=>manage.close();
  manage.addEventListener('close',()=>{ cancelHold(); setTimeout(()=>{suppressClick=false;},0); });
  for(const [id,amount] of [['move-up',-1],['move-down',1]]) $(id).onclick=async()=> { const token=epoch; try { await mutate({op:'move',habitId:managedId,direction:amount},()=>{habits=moveHabit(habits,managedId,amount);}); if(token!==epoch) return; manage.close(); notify('顺序已保存。'); } catch(error) { if(token===epoch) notify(error.message); } };
  $('archive-habit').onclick=async()=> { const habit=habits.find(item=>item.id===managedId), token=epoch; try { await mutate({op:'archive',habitId:habit.id,archived:!habit.archived},()=>{habits=archiveHabit(habits,habit.id,!habit.archived);}); if(token!==epoch) return; if(route==='detail') refreshDetail(); if(route==='archive') renderArchive(); manage.close(); notify(habit.archived ? '已恢复打卡。' : '已归档，记录保留；可从“我的”恢复。'); } catch(error) { if(token===epoch) notify(error.message); } };
  $('delete-managed').onclick=()=>{ const habit=habits.find(item=>item.id===managedId); manage.close(); openDialog(habit,'delete'); };
  // Block page pinch gestures and stationary double taps; retain single-finger scrolling and editing.
  let tapStart, previousTap, pinchActive = false;
  root.addEventListener('touchstart',event=> { if (event.touches.length>1) { pinchActive=true; tapStart=null; previousTap=null; cancelHold(); if(event.cancelable) event.preventDefault(); return; } tapStart=!pinchActive ? {x:event.touches[0].clientX,y:event.touches[0].clientY,at:Date.now()} : null; },{passive:false});
  root.addEventListener('touchmove',event=> { if (pinchActive || event.touches.length>1) { pinchActive=true; tapStart=null; cancelHold(); if(event.cancelable) event.preventDefault(); return; } if (tapStart && Math.hypot(event.touches[0].clientX-tapStart.x,event.touches[0].clientY-tapStart.y)>10) tapStart=null; },{passive:false});
  root.addEventListener('touchend',event=> { if (pinchActive) { if(event.cancelable) event.preventDefault(); pinchActive=event.touches.length>0; tapStart=null; previousTap=null; return; } if (!tapStart || Date.now()-tapStart.at>450 || event.target.closest('input,textarea,[contenteditable],#account-email,#data-message')) { previousTap=null; return; } const now=Date.now(); if (previousTap && now-previousTap.at<300 && Math.hypot(previousTap.x-tapStart.x,previousTap.y-tapStart.y)<24) { if(event.cancelable) event.preventDefault(); previousTap=null; } else previousTap={...tapStart,at:now}; tapStart=null; },{passive:false});
  root.addEventListener('touchcancel',()=>{pinchActive=false; tapStart=null; previousTap=null;},{passive:true});
  for (const type of ['gesturestart','gesturechange','gestureend']) document.addEventListener(type,event=> { if (!root.hidden && event.cancelable) event.preventDefault(); },{passive:false});
  $('logout').onclick = onLogout;
  $('check-data').onclick=async()=> { if(writing) { notify('正在保存，请稍候。'); return; } const token=epoch; $('check-data').disabled=true; try { if(preview) { $('data-message').textContent='公开预览不读取个人数据。'; return; } if(pending) await sendPending(); else await loadData(); if(token===epoch) $('data-message').textContent=loaded ? '打卡数据已同步。' : '连接未完成，请联网后重试。'; } catch(error) { if(token===epoch) $('data-message').textContent=error.message; } finally { $('check-data').disabled=false; } };
  function dates() {
    const today=new Date(`${currentDay()}T12:00:00`);
    $('today-date').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(today);
    $('week-strip').replaceChildren();
    for (let i=-4;i<=2;i++) { const date=new Date(today); date.setDate(today.getDate()+i); const li=document.createElement('li'), button=document.createElement('button'); const key=localDay(date); button.innerHTML=`<span>${date.getMonth()+1}月 · ${['日','一','二','三','四','五','六'][date.getDay()]}</span><b>${date.getDate()}</b>`; button.setAttribute('aria-label',`${key}${i===0 ? ' 今天' : ''}`); button.setAttribute('aria-pressed',String(key===selectedDay)); if (key===selectedDay) li.className='today'; button.onclick=()=>{ if (key===selectedDay) return; const direction=key>selectedDay ? 1 : -1; changeResults(()=>{ selectedDay=key; dates(); },direction); }; li.append(button); $('week-strip').append(li); }
  }
  return {
    enter(user) {
      ++epoch; writing=false; pending=null; root.removeAttribute('aria-busy');
      if(owner!==user.id) { statistics.clear(); snapshot=null; habits=preview ? sampleHabits() : []; logs=[]; records=[]; loaded=preview; selectedDay=localDay(); filter='all'; updateFilters(); }
      if(owner!==user.id) admin.clear();
      owner=user.id; account=user; appearance.enter(user); renderProfile(); $('data-message').textContent=''; dates(); renderHabits(); root.hidden=false;
      document.body.classList.add('workspace-active'); document.documentElement.classList.add('workspace-active');
      const requested=location.hash.slice(2); navigation.start(requested.startsWith('habit/') && habits.some(item=>item.id===requested.slice(6)) ? requested : [...routes,'archive',...accountRoutes].includes(requested) ? requested : 'habits');
      if(!preview) loadData();
    },
    leave(reset = false) { appearance.clear(reset); root.classList.remove('admin-active'); admin.clear(); statistics.clear(); ++epoch; writing=false; pending=null; loaded=preview; snapshot=null; habits=preview ? sampleHabits() : []; records=[]; logs=[]; $('habit-list').replaceChildren(); $('habit-detail').replaceChildren(); $('archive-list').replaceChildren(); account=null; renderProfile(); $('reward-balance').textContent='0'; $('coin-rules-content').replaceChildren(); root.removeAttribute('aria-busy'); $('save-habit').disabled=false; navigation.stop({reset}); root.hidden = true; cancelResultsTransition(); pinchActive=false; tapStart=null; previousTap=null; document.body.classList.remove('workspace-active'); document.documentElement.classList.remove('workspace-active'); cancelHold(); if (manage.open) manage.close(); $('account-email').textContent = ''; $('data-message').textContent = ''; if (dialog.open) dialog.close(); $('habit-form').reset(); clearTimeout(toastTimer); $('workspace-toast').hidden = true; if (reset) owner = null; },
    isEditing() { return appearance.busy() || admin.busy() || writing || !!pending || dialog.open || manage.open; }
  };
}
