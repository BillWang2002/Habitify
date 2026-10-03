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
