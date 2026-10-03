import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleHabits, setProgress, todaySummary, addHabit } from '../web/habits-model.js';
test('喝水只记录 1 杯不形成行动日，达到 8 杯才完成', () => {
  const partial = setProgress(sampleHabits(), 'water', 1); assert.equal(todaySummary(partial).actionDay, false);
  assert.deepEqual(todaySummary(setProgress(partial, 'water', 8)), { completed: 1, total: 3, actionDay: true });
});
test('重复设置同一完成不会增加完成数，撤销最后一个完成清除行动日', () => {
  let habits = setProgress(sampleHabits(), 'read', 1); habits = setProgress(habits, 'read', 1);
  assert.equal(todaySummary(habits).completed, 1); assert.equal(todaySummary(setProgress(habits, 'read', 0)).actionDay, false);
});
test('撤销一个完成但另一个已完成时，行动日仍成立', () => {
  let habits = setProgress(sampleHabits(), 'read', 1); habits = setProgress(habits, 'water', 8); habits = setProgress(habits, 'read', 0);
  assert.deepEqual(todaySummary(habits), { completed: 1, total: 3, actionDay: true });
});
test('非法进度被拒绝且不改写原记录', () => {
  const habits = sampleHabits();
  for (const value of [-1, 1.5, NaN, 9]) assert.throws(() => setProgress(habits, 'water', value));
  assert.equal(habits[1].progress, 0); assert.throws(() => setProgress(habits, 'missing', 1));
});
test('新增数量型目标必须有效，空列表不生成行动日', () => {
  assert.deepEqual(todaySummary([]), { completed: 0, total: 0, actionDay: false });
  assert.throws(() => addHabit([], { name: '水', kind: 'quantity', goal: 0, unit: '杯' }, 'new'));
  const habits = addHabit([], { name: '  喝水 ', kind: 'quantity', goal: 8, unit: '杯' }, 'new');
  assert.equal(habits[0].name, '喝水'); assert.equal(todaySummary(habits).actionDay, false);
});
test('删除最后完成的习惯重算行动日，输入列表和历史快照不改写', async () => {
  const { removeHabit } = await import('../web/habits-model.js');
  const before = setProgress(sampleHabits(), 'read', 1);
  const after = removeHabit(before, 'read');
  assert.equal(todaySummary(after).actionDay, false); assert.equal(before.length, 3); assert.equal(before[0].progress, 1);
  assert.throws(() => removeHabit(after, 'read'));
});
test('未授权和未知图标回退默认，创建习惯保留合法图标 ID', async () => {
  const { resolveHabitIcon } = await import('../web/theme.js');
  assert.equal(resolveHabitIcon('sun', []), 'leaf'); assert.equal(resolveHabitIcon('<script>'), 'leaf');
  assert.equal(addHabit([], {name:'晒太阳',kind:'complete',unit:'',icon:'sun'}, 'sun-habit')[0].icon, 'sun');
});
test('归档保存进度和行动日，移出计划列表且不允许继续打卡，恢复重新计入', async () => {
  const { archiveHabit } = await import('../web/habits-model.js');
  const archived = archiveHabit(setProgress(sampleHabits(), 'read', 1), 'read');
  assert.equal(archived[0].progress,1); assert.deepEqual(todaySummary(archived),{completed:0,total:2,actionDay:true});
  assert.throws(()=>setProgress(archived,'read',0));
  assert.deepEqual(todaySummary(archiveHabit(archived,'read',false)),{completed:1,total:3,actionDay:true});
});
test('排序仅改变顺序，跳过归档项并保留各自进度，边界无变化', async () => {
  const { archiveHabit, moveHabit } = await import('../web/habits-model.js');
  const habits=archiveHabit(setProgress(sampleHabits(),'water',3),'read');
  const ordered=moveHabit(habits,'walk',-1);
  assert.deepEqual(ordered.map(item=>item.id),['read','walk','water']); assert.equal(ordered[2].progress,3);
  assert.equal(moveHabit(ordered,'walk',-1),ordered); assert.throws(()=>moveHabit(ordered,'read',1));
});
