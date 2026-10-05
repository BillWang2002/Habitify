import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatisticsModel,shiftDay,weekBounds,monthBounds} from '../web/statistics-model.js';
const habit=(id,extra={})=>({id,name:id,goal:8,unit:'杯',startDay:'2026-09-28',...extra});
const record=(habitId,day,progress=8,goal=8)=>({habitId,day,progress,goal});
function model(records=[],plans=[{habitId:'a',day:'2026-09-28',active:true,goal:8}],habits=[habit('a')],today='2026-10-04') {return createStatisticsModel({today,records,statistics:{habits,plans}});}
test('日历运算使用归属日，不受夏令时影响，周从周一开始',()=>{
 assert.equal(shiftDay('2026-10-04',1),'2026-10-05');assert.equal(shiftDay('2024-02-28',1),'2024-02-29');
 assert.deepEqual(weekBounds('2026-10-04'),['2026-09-28','2026-10-04']);assert.deepEqual(monthBounds('2024-02-01'),['2024-02-01','2024-02-29']);
});
test('部分进度不形成行动日；今日完成不混入截至昨天的完成率',()=>{
 const m=model([record('a','2026-10-01'),record('a','2026-10-02',1),record('a','2026-10-04')]);
 const p=m.period('month');assert.equal(p.count,2);assert.equal(p.actionDays,2);assert.equal(p.denominator,3);assert.equal(p.numerator,1);assert.equal(m.byDay.get('2026-10-02').partial,1);
 assert.equal(p.buckets[3].inProgress,true);assert.equal(p.buckets[4].future,true);assert.equal(p.buckets[3].cumulative,2);
});
test('归档次日起停计划，恢复当天开始；删除元数据和历史达标保留',()=>{
 const m=model([record('a','2026-09-28'),record('a','2026-09-29'),record('a','2026-10-02')],[{habitId:'a',day:'2026-09-28',active:true,goal:8},{habitId:'a',day:'2026-09-30',active:false,goal:8},{habitId:'a',day:'2026-10-02',active:true,goal:8},{habitId:'a',day:'2026-10-04',active:false,goal:8}],[habit('a',{deleted:true})]);
 const p=m.period('week');assert.equal(p.denominator,4);assert.equal(p.numerator,3);assert.equal(p.count,3);assert.deepEqual(p.list,[]);
 assert.equal(m.byDay.get('2026-09-30').planned,0);assert.equal(m.byDay.get('2026-10-02').planned,1);
 assert.equal(m.account.longest,2);
});
test('今天尚未完成保留昨日前连续，今日达标延长；空计划不显示0%误导',()=>{
 const m=model([record('a','2026-10-02'),record('a','2026-10-03')]);assert.equal(m.account.current,2);
 assert.equal(model([record('a','2026-10-02'),record('a','2026-10-03'),record('a','2026-10-04')]).account.current,3);
 const fresh=model([], [{habitId:'a',day:'2026-10-04',active:true,goal:8}]);assert.equal(fresh.period('month').rate,null);
 assert.equal(createStatisticsModel({today:'2026-10-04'}),null);
});
test('记录目标快照优先，重复记录不重复计数；全部按范围选择日/周/月',()=>{
 const m=model([record('a','2026-10-01',8,10),record('a','2026-10-02'),record('a','2026-10-02')]);assert.equal(m.period('month').count,1);
 assert.equal(m.period('all').grain,'day');
 const long=model([], [{habitId:'a',day:'2026-08-01',active:true,goal:8}]);assert.equal(long.period('all').grain,'week');
 const year=model([record('a','2026-01-01')],[{habitId:'a',day:'2026-01-01',active:true,goal:8}]);assert.equal(year.period('all').grain,'month');assert.equal(year.period('all').buckets.at(-1).cumulative,1);
});

test('打卡统计排除已删除项，保留正在执行和已归档项，历史概览与趋势不改写',()=>{
 const habits=[habit('active'),habit('archived',{archived:true}),habit('deleted',{deleted:true,archived:true})];
 const plans=habits.map(h=>({habitId:h.id,day:'2026-10-01',active:true,goal:8}));
 const m=model(habits.map(h=>record(h.id,'2026-10-02')),plans,habits);
 for(const type of ['week','month','all']) {
  const p=m.period(type);
  assert.deepEqual(p.list.map(i=>i.habit.id),['active','archived']);
  assert.equal(p.list[1].completed,1);assert.equal(p.list[1].lifetime,1);
  assert.equal(p.count,3);assert.equal(p.buckets.at(-1).cumulative,3);
 }
 assert.equal(m.byDay.get('2026-10-02').completed,3);
});
