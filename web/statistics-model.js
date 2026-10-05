// Calendar dates from the server; UTC arithmetic here never determines reward days.
const DAY=86400000;
export const shiftDay=(day,n)=>new Date(Date.parse(`${day}T00:00:00Z`)+n*DAY).toISOString().slice(0,10);
export function daysBetween(start,end) { const out=[]; for(let d=start;d<=end;d=shiftDay(d,1)) out.push(d); return out; }
export function monthBounds(day) { const [y,m]=day.split('-').map(Number); return [`${day.slice(0,7)}-01`,new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)]; }
export function weekBounds(day) { const weekday=new Date(`${day}T00:00:00Z`).getUTCDay(); const start=shiftDay(day,-((weekday+6)%7)); return [start,shiftDay(start,6)]; }
function streak(items,today) {
 let longest=0,run=0; for(const item of items) { run=item.done ? run+1 : 0;longest=Math.max(longest,run); }
 let current=0; const ended=items.filter(x=>x.day<today || x.done);
 for(let i=ended.length-1;i>=0 && ended[i].done;i--) current++;
 return {current,longest};
}
export function createStatisticsModel(snapshot) {
 if(!snapshot?.statistics) return null;
 const today=snapshot.today, habits=snapshot.statistics.habits;
 const plans=new Map(habits.map(h=>[h.id,snapshot.statistics.plans.filter(p=>p.habitId===h.id).sort((a,b)=>a.day.localeCompare(b.day))]));
 const recordMap=new Map(snapshot.records.map(r=>[`${r.habitId}:${r.day}`,r]));
 const first=[today,...snapshot.statistics.plans.map(p=>p.day),...snapshot.records.map(r=>r.day)].filter(d=>d<=today).sort()[0];
 const days=daysBetween(first,today).map(day=> {
  const items=habits.map(h=> { const plan=plans.get(h.id).findLast(p=>p.day<=day); const r=recordMap.get(`${h.id}:${day}`); const goal=r?.goal || plan?.goal || h.goal; return {habit:h,planned:!!plan?.active,progress:r?.progress || 0,goal,done:!!r && r.progress>=r.goal}; });
  return {day,items,completed:items.filter(x=>x.done).length,planned:items.filter(x=>x.planned).length,plannedCompleted:items.filter(x=>x.planned && x.done).length,partial:items.filter(x=>!x.done && x.progress>0).length};
 });
 const byDay=new Map(days.map(d=>[d.day,d]));
 const account=streak(days.map(d=>({day:d.day,done:d.completed>0})),today);
 function period(type='month') {
  const [start,end]=type==='week' ? weekBounds(today) : type==='month' ? monthBounds(today) : [first,today];
  const actual=days.filter(d=>d.day>=start && d.day<=end), ended=actual.filter(d=>d.day<today);
  const total=ended.reduce((s,d)=>s+d.planned,0), complete=ended.reduce((s,d)=>s+d.plannedCompleted,0);
  const count=actual.reduce((s,d)=>s+d.completed,0);
  const grain=type==='all' && actual.length>180 ? 'month' : type==='all' && actual.length>31 ? 'week' : 'day';
  const buckets=[];let cumulative=0;
  for(const day of daysBetween(start,end)) {
   const key=grain==='month' ? day.slice(0,7) : grain==='week' ? weekBounds(day)[0] : day;
   let bucket=buckets.at(-1); if(bucket?.key!==key) { bucket={key,start:day,end:day,count:0,cumulative,future:day>today,inProgress:false};buckets.push(bucket); }
   bucket.end=day; bucket.count+=byDay.get(day)?.completed || 0; bucket.inProgress ||=day===today; cumulative+=byDay.get(day)?.completed || 0; bucket.cumulative=cumulative;
  }
  const list=habits.filter(h=>!h.deleted && actual.some(d=>d.items.some(i=>i.habit.id===h.id && (i.planned || i.progress)))).map(h=> {
   const items=actual.flatMap(d=>d.items.filter(i=>i.habit.id===h.id).map(i=>({...i,day:d.day})));
   const expected=items.filter(i=>i.planned && i.day<today), done=items.filter(i=>i.done).length;
   const history=days.flatMap(d=>d.items.filter(i=>i.habit.id===h.id && i.planned).map(i=>({day:d.day,done:i.done})));
   const lifetime=days.reduce((sum,d)=>sum+Number(d.items.some(i=>i.habit.id===h.id && i.done)),0);
   return {habit:h,completed:done,lifetime,rate:expected.length ? expected.filter(i=>i.done).length/expected.length : null,...streak(history,today)};
  }).sort((a,b)=>b.completed-a.completed);
  return {start,end,count,actionDays:actual.filter(d=>d.completed>0).length,rate:total ? complete/total : null,denominator:total,numerator:complete,buckets,grain,list};
 }
 return {today,first,days,byDay,habits,account,period};
}
