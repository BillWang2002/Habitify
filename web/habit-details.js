import { isComplete } from './habits-model.js';
import { iconSvg, resolveHabitIcon } from './theme.js';
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function renderDetail(root, habit, logs, month, { onMenu, onProgress, records=[], busy=false, today:todayKey=localDay() }) {
  root.innerHTML = `<div class="detail-header"><a href="#/habits" class="back-link" aria-label="返回上一页">‹</a><h1></h1><button id="detail-menu" aria-label="打卡管理菜单">•••</button></div>
  <div class="detail-profile"><span class="habit-icon"></span><div><strong id="detail-plan"></strong><p id="detail-note"></p></div></div>
  <div class="detail-today"><div><h2>今日进度</h2><p id="detail-progress"></p></div><button id="detail-check" class="habit-action"></button></div>
  <section class="detail-panel"><h2>打卡概览</h2><div class="detail-metrics"><div><strong id="detail-days"></strong><span>完成天数</span></div><div><strong id="detail-month-days">0</strong><span>本月完成</span></div><div><strong id="detail-log-count"></strong><span>操作日志</span></div></div><p class="dialog-note">累计完成按保存的每日目标计算；最多展示最近 200 条操作日志。</p></section>
  <section class="detail-panel"><div class="calendar-heading"><button id="month-prev" aria-label="上个月">‹</button><h2 id="calendar-month"></h2><button id="month-next" aria-label="下个月">›</button></div><p id="month-summary" class="dialog-note"></p><div class="calendar-week">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid" id="calendar-grid"></div><p id="calendar-selection" role="status" class="dialog-note"></p><p class="calendar-legend">✓ 已完成 · ◐ 部分进度 · ○ 今日待完成 · — 无完成记录</p></section>
  <details class="detail-panel" id="detail-logs"><summary>打卡日志</summary><ol id="detail-log-list"></ol></details>`;
  root.querySelector('h1').textContent = habit.name;
  root.querySelector('.habit-icon').innerHTML = iconSvg(resolveHabitIcon(habit.icon));
  root.querySelector('#detail-plan').textContent = `${habit.archived ? '已归档 · ' : ''}每天 · ${habit.kind === 'quantity' ? `目标 ${habit.goal} ${habit.unit}` : '完成一次'}`;
  root.querySelector('#detail-note').textContent = `备注：${habit.note || '无'}`;
  root.querySelector('#detail-progress').textContent = `${habit.progress} / ${habit.goal} ${habit.unit} · ${isComplete(habit) ? '已完成' : '待完成'}`;
  const check = root.querySelector('#detail-check'); check.textContent = habit.archived ? '已归档' : habit.kind === 'quantity' ? '修改进度' : isComplete(habit) ? '撤销完成' : '打卡'; check.disabled = !!habit.archived || busy; check.onclick = onProgress;
  root.querySelector('#detail-menu').onclick = onMenu;
  const ownLogs = logs.filter(item=>item.habitId === habit.id);
  const ownRecords=records.filter(item=>item.habitId===habit.id);
  root.querySelector('#detail-days').textContent=ownRecords.filter(item=>item.progress>=item.goal).length;
  root.querySelector('#detail-log-count').textContent = ownLogs.length;
  const today = new Date(`${todayKey}T12:00:00`);
  const [year, index] = month;
  root.querySelector('#calendar-month').textContent = `${year}年${index+1}月`;
  const prefix=`${year}-${String(index+1).padStart(2,'0')}-`, monthCount=ownRecords.filter(item=>item.day.startsWith(prefix) && item.progress>=item.goal).length;
  root.querySelector('#month-summary').textContent=`本月完成 ${monthCount} 天`; root.querySelector('#detail-month-days').textContent=monthCount;
  const first = (new Date(year,index,1).getDay()+6)%7, length = new Date(year,index+1,0).getDate();
  const grid = root.querySelector('#calendar-grid');
  for (let i=0;i<first;i++) { const space = document.createElement('span'); space.setAttribute('aria-hidden','true'); grid.append(space); }
  for (let i=1;i<=length;i++) {
    const date = new Date(year,index,i), key = localDay(date), current = key === todayKey;
    const record=ownRecords.find(item=>item.day===key), done=record && record.progress>=record.goal, partial=record?.progress>0;
    const label=done ? '已完成' : partial ? '部分进度，尚未达标' : current ? '今日待完成' : key>todayKey ? '未来日期' : key<habit.startDay ? '尚未创建' : '无完成记录';
    const cell=document.createElement('button'); cell.textContent=`${i}${done ? ' ✓' : partial ? ' ◐' : current ? ' ○' : ''}`; cell.setAttribute('aria-label',`${index+1}月${i}日：${label}`);
    cell.className=done ? 'calendar-complete' : current || partial ? 'calendar-today' : 'calendar-unknown';
    cell.onclick = () => { for (const button of grid.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button===cell)); root.querySelector('#calendar-selection').textContent = `${key}：${label}。历史日期仅查看，补签后续接入。`; };
    grid.append(cell);
  }
  root.querySelector('#calendar-selection').textContent = '点击日期查看保存的记录；历史日期仅查看。';
  const list = root.querySelector('#detail-log-list');
  for (const log of [...ownLogs].reverse()) { const item = document.createElement('li'); item.textContent = `${new Date(log.at).toLocaleString('zh-CN')} · ${log.from} → ${log.to} ${habit.unit}${log.to >= habit.goal ? ' · 达标' : ' · 未达标'}`; list.append(item); }
  if (!ownLogs.length) { const item=document.createElement('li'); item.textContent='还没有打卡操作。'; list.append(item); }
}
