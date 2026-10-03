import { resolveHabitIcon } from './theme.js';
// This model is only for the explicitly labelled interface preview. No persistence or coins.
export const sampleHabits = () => [
  { id: 'read', name: '读一会儿书', kind: 'complete', goal: 1, unit: '次', step: 1, progress: 0, icon: 'book' },
  { id: 'water', name: '好好喝水', kind: 'quantity', goal: 8, unit: '杯', step: 1, progress: 0, icon: 'water' },
  { id: 'walk', name: '出去走走', kind: 'quantity', goal: 20, unit: '分钟', step: 5, progress: 0, icon: 'walk' }
];
export const isComplete = habit => habit.progress >= habit.goal;
export function todaySummary(habits) {
  const active = habits.filter(item => !item.archived);
  const completed = active.filter(isComplete).length;
  return { completed, total: active.length, actionDay: habits.some(isComplete) };
}
export function setProgress(habits, id, value) {
  const habit = habits.find(item => item.id === id);
  if (!habit || habit.archived || !Number.isSafeInteger(value) || value < 0 || value > habit.goal) throw new Error('请输入 0 到目标之间的整数。');
  return habits.map(item => item.id === id ? { ...item, progress: value } : item);
}
export function addHabit(habits, { name, kind, goal, unit, icon }, id) {
  name = name.trim(); unit = unit.trim();
  if (!name || name.length > 30 || !['complete', 'quantity'].includes(kind)) throw new Error('请填写不超过 30 个字的习惯名称。');
  if (kind === 'quantity' && (!Number.isSafeInteger(goal) || goal < 1 || goal > 100000 || !unit || unit.length > 6)) throw new Error('请填写正整数目标和不超过 6 个字的单位。');
  if (habits.some(item => item.id === id)) throw new Error('请重新添加。');
  return [...habits, { id, name, kind, goal: kind === 'complete' ? 1 : goal, unit: kind === 'complete' ? '次' : unit, step: 1, progress: 0, icon: resolveHabitIcon(icon || (kind === 'complete' ? 'leaf' : 'target')) }];
}

export function removeHabit(habits, id) {
  if (!habits.some(item => item.id === id)) throw new Error('该习惯已不存在。');
  return habits.filter(item => item.id !== id);
}

export function archiveHabit(habits, id, archived = true) {
  if (!habits.some(item => item.id === id)) throw new Error('该习惯已不存在。');
  return habits.map(item => item.id === id ? { ...item, archived } : item);
}
export function moveHabit(habits, id, direction) {
  if (![1, -1].includes(direction)) throw new Error('排序方向无效。');
  const index = habits.findIndex(item => item.id === id);
  if (index < 0 || habits[index].archived) throw new Error('请先恢复该习惯。');
  let next = index + direction;
  while (next >= 0 && next < habits.length && habits[next].archived) next += direction;
  if (next < 0 || next >= habits.length) return habits;
  const reordered = [...habits]; [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
  return reordered;
}
