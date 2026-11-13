import { expect, test } from 'vitest';
import type { SimEvent } from '../sim';
import { dyingScale, effectProgress, planEffects, recoilScale } from './effects';
import type { EffectContext } from './effects';
import { retarget, tweenDuration, tweenValue } from './motion';

const ctx: EffectContext = {
  groupPos: (id) => (id === 1 ? { x: 0, y: 1, z: 0 } : undefined),
  enemyPos: (id) => (id === 7 ? { x: 3, y: 0, z: 4 } : undefined),
  basePos: { x: 9, y: 0, z: 9 },
};

test('groupShot -> трассер + вспышка попадания, группа отмечена для отдачи', () => {
  const plan = planEffects([{ type: 'groupShot', group: 1, enemy: 7, damage: 5 }], ctx);
  expect(plan.effects.map((e) => e.kind)).toEqual(['tracer', 'burst']);
  expect(plan.effects[0]).toMatchObject({ from: { x: 0, y: 1, z: 0 }, to: { x: 3, y: 0, z: 4 } });
  expect(plan.fired).toEqual([1]);
});

test('groupShot с неизвестной позицией не падает и не рисует трассер', () => {
  const plan = planEffects([{ type: 'groupShot', group: 1, enemy: 99, damage: 5 }], ctx);
  expect(plan.effects).toEqual([]);
  expect(plan.fired).toEqual([1]);
});

test('kill -> взрыв в позиции врага и пометка гибели; leak -> вспышка у базы и пометка прорыва', () => {
  const events: SimEvent[] = [
    { type: 'kill', enemy: 7, reward: 10 },
    { type: 'leak', enemy: 8, damage: 2 },
  ];
  const plan = planEffects(events, ctx);
  expect(plan.killed).toEqual([7]);
  expect(plan.leaked).toEqual([8]);
  expect(plan.effects[0]).toMatchObject({ kind: 'burst', at: { x: 3, y: 0, z: 4 } });
  expect(plan.effects[1]).toMatchObject({ kind: 'burst', at: { x: 9, y: 0, z: 9 } });
});

test('прочие события (waveStart, income, sortieDone и будущие) игнорируются', () => {
  const events = [
    { type: 'waveStart', wave: 0 },
    { type: 'income', group: 1, amount: 5 },
    { type: 'sortieDone', group: 1, sortie: 1 },
    { type: 'future' },
  ] as unknown as SimEvent[];
  expect(planEffects(events, ctx)).toEqual({ effects: [], fired: [], killed: [], leaked: [] });
});

test('effectProgress / dyingScale / recoilScale: границы', () => {
  expect(effectProgress(100, 200, 100)).toBe(0);
  expect(effectProgress(100, 200, 200)).toBe(0.5);
  expect(effectProgress(100, 200, 300)).toBeNull();
  expect(effectProgress(100, 200, 50)).toBe(0);
  expect(dyingScale(0)).toBe(1);
  expect(dyingScale(1)).toBe(0);
  expect(recoilScale(0)).toBe(1);
  expect(recoilScale(0.5)).toBeCloseTo(1.18);
  expect(recoilScale(1)).toBeCloseTo(1);
});

test('твин: линейная интерполяция между тиками, без скачка при перенацеливании', () => {
  const t = retarget(undefined, 10, 0, 100);
  expect(tweenValue(t, 50)).toBe(10); // первое появление — сразу в точке
  const t2 = retarget(t, 12, 0, tweenDuration(3, 1 / 30));
  expect(t2.duration).toBeCloseTo(100);
  expect(tweenValue(t2, 0)).toBe(10);
  expect(tweenValue(t2, 50)).toBeCloseTo(11);
  expect(tweenValue(t2, 1000)).toBe(12);
  const t3 = retarget(t2, 14, 50, 100); // перенацеливание на полпути стартует с 11
  expect(tweenValue(t3, 50)).toBeCloseTo(11);
  expect(tweenValue(t3, 150)).toBe(14);
  expect(tweenValue({ from: 1, to: 2, start: 0, duration: 0 }, 0)).toBe(2);
});
