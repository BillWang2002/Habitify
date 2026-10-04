import { createStatisticsModel, daysBetween, monthBounds } from './statistics-model.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=value=>value===null ? '—' : `${Math.round(value*100)}%`;
export function createStatistics(root,{onHabit=()=>{}}={}) {
 let model=null, type='month', month=null, day=null, bucket=null;
 root.innerHTML=`<div class="page-title"><div><p class="date-label">看见每一步的积累</p><h1>统计</h1></div></div><p class="dialog-note" data-unavailable>正在读取行动记录…</p><div data-statistics hidden><div class="habit-filters stats-period" aria-label="统计时间范围"><span class="filter-slider" aria-hidden="true"></span>${['本周','本月','全部'].map((label,i)=>`<button data-period="${['week','month','all'][i]}" aria-pressed="${i===1}">${label}</button>`).join('')}</div><div data-overview class="stats-overview"></div><section class="detail-panel"><div class="stats-heading"><h2>行动趋势</h2><span data-grain></span></div><p class="stats-legend"><i></i>完成数 <b>⤴</b>累计完成数</p><div data-chart class="stats-chart" aria-label="完成数与累计完成数趋势图"></div><p data-bucket class="stats-selection" role="status"></p><p class="dialog-note">今天仍在进行中；未来日期不计为未完成。点击柱形或折线节点查看数值。</p></section><section class="detail-panel"><div class="stats-heading"><button data-month-prev aria-label="上个月">‹</button><h2 data-month></h2><button data-month-next aria-label="下个月">›</button></div><div class="stats-calendar" data-calendar></div><p class="dialog-note">● 已有达标行动 · ◐ 部分进度 · 空心为无达标行动</p><div data-day class="stats-day" aria-live="polite"></div></section><section class="detail-panel"><h2>打卡统计</h2><p class="dialog-note">完成率只统计截至昨天的计划；单项打卡连续记录按计划日计算。</p><div data-habits class="stats-habits"></div></section></div>`;
 const $=key=>root.querySelector(`[data-${key}]`);
 const periods=['week','month','all'];
 root.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=> { if(type===button.dataset.period)return;const direction=periods.indexOf(button.dataset.period)-periods.indexOf(type);type=button.dataset.period;bucket=null;render();if(!matchMedia('(prefers-reduced-motion: reduce)').matches) $('overview').animate([{opacity:.6,transform:`translateX(${Math.sign(direction)*18}px)`},{opacity:1,transform:'translateX(0)'}],{duration:480,easing:'cubic-bezier(.22,.8,.28,1)'}); });
 for(const [key,n] of [['month-prev',-1],['month-next',1]]) $(key).onclick=()=>{const date=new Date(`${month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+n);month=date.toISOString().slice(0,7);day=month===model.today.slice(0,7) ? model.today : month+'-01';if(day<model.first)day=model.first;calendar();};
 function render() {
  $('statistics').hidden=!model; $('unavailable').hidden=!!model;if(!model)return;
  const data=model.period(type);root.querySelector('.stats-period').style.setProperty('--filter-index',periods.indexOf(type));root.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===type)));
  const today=model.byDay.get(model.today);
  $('overview').innerHTML=[['完成打卡',data.count,'次达标行动'],['行动日',data.actionDays,'天至少一项打卡达标'],['计划完成率',percent(data.rate),data.denominator ? `${data.numerator} / ${data.denominator} · 截至昨天` : '暂无已结束计划'],['今日完成',`${today.completed} / ${today.planned}`,'归档当天仍计计划'],['当前连续',model.account.current,'账户连续行动日'],['最长连续',model.account.longest,'账户历史连续行动日']].map(([label,value,note])=>`<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
  $('grain').textContent=`${data.grain==='day' ? '按日' : data.grain==='week' ? '按周' : '按月'} · ${data.start} 至 ${data.end}`;
  chart(data);calendar();
  $('habits').innerHTML=data.list.length ? data.list.map(item=>`<${item.habit.deleted ? 'article' : 'button'} ${item.habit.deleted ? '' : `data-habit="${esc(item.habit.id)}"`} class="stats-habit"><strong>${esc(item.habit.name)}${item.habit.deleted ? ' · 已删除' : item.habit.archived ? ' · 已归档' : ''}</strong><span>${item.completed} 次完成 · 完成率 ${percent(item.rate)}</span><small>累计 ${item.lifetime} 次 · 连续 ${item.current} 个计划日 · 最长 ${item.longest} 个计划日</small></${item.habit.deleted ? 'article' : 'button'}>`).join('') : '<p class="dialog-note">这个时间范围还没有计划或行动。</p>';
  $('habits').querySelectorAll('[data-habit]').forEach(b=>b.onclick=()=>onHabit(b.dataset.habit));
 }
 function chart(data) {
  const width=Math.max(330,data.buckets.length*36+90),height=220,left=42,right=width-43,top=20,bottom=174;
  const max=Math.ceil(Math.max(2,...data.buckets.map(b=>b.count))/2)*2, cumulativeMax=Math.ceil(Math.max(2,...data.buckets.map(b=>b.cumulative))/2)*2;
  const step=(right-left)/data.buckets.length, x=i=>left+step*(i+.5), y=(value,limit)=>bottom-(bottom-top)*value/limit;
  let svg=`<svg viewBox="0 0 ${width} ${height}" style="min-width:${data.buckets.length>10 ? width : 0}px" role="group" aria-label="柱形为完成数，折线为累计完成数，左右坐标分别标示"><text x="0" y="12">完成</text><text x="${width-30}" y="12">累计</text>`;
  for(let i=0;i<=2;i++){const yy=bottom-(bottom-top)*i/2;svg+=`<path d="M${left},${yy}H${right}" class="stats-grid"/><text x="${left-8}" y="${yy+4}" text-anchor="end">${Math.round(max*i/2)}</text><text x="${right+8}" y="${yy+4}">${Math.round(cumulativeMax*i/2)}</text>`;}
  const actual=data.buckets.map((b,i)=>({...b,i})).filter(b=>!b.future);
  svg+=actual.map(b=>`<rect class="stats-bar" x="${x(b.i)-9}" y="${y(b.count,max)}" width="18" height="${bottom-y(b.count,max)}" rx="5"/>`).join('');
  svg+=`<polyline class="stats-line" points="${actual.map(b=>`${x(b.i)},${y(b.cumulative,cumulativeMax)}`).join(' ')}"/>`;
  svg+=data.buckets.map((b,i)=>`${!b.future ? `<circle class="stats-dot" cx="${x(i)}" cy="${y(b.cumulative,cumulativeMax)}" r="3.5"/>` : ''}<text x="${x(i)}" y="197" text-anchor="middle">${esc(data.grain==='month' ? b.key.slice(5)+'月' : b.start.slice(5))}</text>${b.inProgress ? `<text x="${x(i)}" y="212" text-anchor="middle">进行中</text>` : ''}<rect class="stats-hit" data-bucket-index="${i}" x="${x(i)-step/2}" y="${top}" width="${step}" height="${bottom-top}" role="button" tabindex="0" aria-label="${b.start}至${b.end}：${b.future ? '未来日期' : `完成${b.count}次，累计${b.cumulative}次`}"/>`).join('')+'</svg>';
  const scroll=$('chart').scrollLeft;$('chart').innerHTML=svg;$('chart').scrollLeft=scroll;
  const select=i=>{bucket=data.buckets[i].key;const b=data.buckets[i];$('bucket').textContent=`${b.start}${b.end!==b.start ? ' 至 '+b.end : ''} · ${b.future ? '尚未开始' : `完成 ${b.count} 次 · 累计 ${b.cumulative} 次${b.inProgress ? ' · 进行中' : ''}`}`;$('chart').querySelectorAll('[data-bucket-index]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.bucketIndex===i)));};
  $('chart').querySelectorAll('[data-bucket-index]').forEach(el=>{el.onclick=()=>select(+el.dataset.bucketIndex);el.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();select(+el.dataset.bucketIndex);}};});
  select(Math.max(0,data.buckets.findIndex(b=>b.key===(bucket || data.buckets.findLast(b=>!b.future)?.key))));

 }
 function calendar() {
  if(!model)return;month ||=model.today.slice(0,7);day ||=model.today;
  $('month').textContent=`${month.slice(0,4)}年${+month.slice(5)}月`;$('month-prev').disabled=month<=model.first.slice(0,7);$('month-next').disabled=month>=model.today.slice(0,7);
  const [start,end]=monthBounds(`${month}-01`),offset=(new Date(`${start}T00:00:00Z`).getUTCDay()+6)%7;
  $('calendar').innerHTML=['一','二','三','四','五','六','日'].map(d=>`<span class="stats-weekday">${d}</span>`).join('')+'<span aria-hidden="true"></span>'.repeat(offset)+daysBetween(start,end).map(d=>{const value=model.byDay.get(d);const state=d>model.today ? '未来日期' : d<model.first ? '尚未开始' : value?.completed ? '已达标行动' : value?.partial ? '部分进度' : '无达标行动';return `<button data-day-key="${d}" aria-pressed="${d===day}" aria-label="${d} ${state}" class="${value?.completed ? 'stats-day-done' : value?.partial ? 'stats-day-partial' : ''}" ${d>model.today || d<model.first ? 'disabled' : ''}><span>${+d.slice(8)}</span><small>${d>model.today ? '·' : value?.completed ? '●' : value?.partial ? '◐' : '○'}</small></button>`;}).join('');
  $('calendar').querySelectorAll('[data-day-key]').forEach(b=>b.onclick=()=>{day=b.dataset.dayKey;calendar();});
  const value=model.byDay.get(day), items=value?.items.filter(i=>i.planned || i.progress) || [];
  $('day').innerHTML=`<h3>${day}${day===model.today ? ' · 今天' : ''}</h3><p>${value?.planned || 0} 个计划 · ${value?.completed || 0} 个达标 · ${value?.partial || 0} 个部分进度</p>${items.length ? `<ul>${items.map(i=>`<li><span>${esc(i.habit.name)}</span><span class="stats-day-result"><b>${i.done ? '已完成' : i.progress ? '部分进度' : '未完成'}</b><span>${i.progress} / ${i.goal} ${esc(i.habit.unit)}</span></span></li>`).join('')}</ul>` : '<p class="dialog-note">这一天没有计划或行动记录。</p>'}`;
 }
 return {
  update(snapshot){model=createStatisticsModel(snapshot);if(model){month=month && month>=model.first.slice(0,7) && month<=model.today.slice(0,7) ? month : model.today.slice(0,7);day=day && day>=model.first && day<=model.today ? day : model.today;}else $('unavailable').textContent='统计服务尚未就绪，请稍后刷新数据。';render();},
  clear(){model=null;type='month';month=day=bucket=null;$('overview').replaceChildren();$('chart').replaceChildren();$('calendar').replaceChildren();$('day').replaceChildren();$('habits').replaceChildren();$('bucket').textContent='';$('unavailable').textContent='正在读取行动记录…';render();},
  getView(){return {type,month,day,bucket,chartScroll:$('chart').scrollLeft};},
  setView(view){if(!view)return;type=periods.includes(view.type) ? view.type : 'month';month=view.month;day=view.day;bucket=view.bucket;render();$('chart').scrollLeft=view.chartScroll || 0;}
 };
}
