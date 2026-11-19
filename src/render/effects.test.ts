import { expect, test } from 'vitest';
import { CONTENT } from '../content';
import type { SimEvent } from '../sim';
import { blastSize, debrisAt, dyingScale, effectProgress, EFFECT_COLORS, missilePath, planEffects, recoilScale, trimEffects } from './effects';
import type { EffectContext, EffectSpec } from './effects';
import { retarget, tweenDuration, tweenValue } from './motion';

const ctx: EffectContext = {
  groupPos: (id) => (id === 1 ? { x: 0, y: 1, z: 0 } : undefined),
  enemyPos: (id) => (id === 7 ? { x: 3, y: 0, z: 4 } : undefined),
  basePos: { x: 9, y: 0, z: 9 },
};

const shot = (damage = 5): SimEvent => ({ type: 'groupShot', group: 1, enemy: 7, damage });
const kinds = (specs: readonly EffectSpec[]) => specs.map((e) => e.kind);

test('groupShot по умолчанию — очередь трассеров + вспышки у ствола и цели; группа отмечена для отдачи, враг — для встряски', () => {
  const plan = planEffects([shot()], ctx);
  expect(kinds(plan.effects).filter((k) => k === 'tracer')).toHaveLength(3);
  expect(plan.effects.some((e) => e.kind === 'burst' && Math.abs(e.at.x - 3) < 1e-9)).toBe(true); // попадание у цели
  expect(plan.effects.some((e) => e.kind === 'burst' && e.at.x === 0)).toBe(true); // вспышка у ствола
  const tracer = plan.effects.find((e) => e.kind === 'tracer');
  expect(tracer && tracer.kind === 'tracer' && Math.hypot(tracer.to.x - 3, tracer.to.z - 4)).toBeLessThan(0.2); // разброс очереди мал
  expect(plan.fired).toEqual([1]);
  expect(plan.hit).toEqual([7]);
});

test('очередь пушки расписана по времени: трассеры стартуют друг за другом, попадания — после прилёта', () => {
  const plan = planEffects([shot()], ctx);
  const tracers = plan.effects.filter((e) => e.kind === 'tracer');
  expect(tracers.map((t) => t.delay)).toEqual([0, 55, 110]);
  const hits = plan.effects.filter((e) => e.kind === 'burst' && e.at.x > 1);
  expect(hits.length).toBeGreaterThan(0);
  for (const h of hits) expect(h.delay ?? 0).toBeGreaterThan(50);
});

test('ракета: тело, дымный след вдоль пути и попадание с задержкой на время полёта', () => {
  const plan = planEffects([shot(45)], { ...ctx, shotKind: () => 'missile' });
  expect(kinds(plan.effects)).not.toContain('tracer');
  const missile = plan.effects.find((e) => e.kind === 'missile')!;
  expect(missile).toMatchObject({ from: { x: 0, y: 1, z: 0 }, to: { x: 3, y: 0, z: 4 } });
  const smoke = plan.effects.filter((e) => e.kind === 'smoke');
  expect(smoke.length).toBeGreaterThanOrEqual(5);
  // след: каждое облачко появляется, когда ракета проходит эту точку
  for (const puff of smoke.slice(0, 6)) {
    if (puff.kind !== 'smoke' || puff.delay! >= missile.ttl) continue;
    const f = (puff.at.x - 0) / 3;
    expect(missilePath((puff.delay ?? 0) / missile.ttl)).toBeCloseTo(f, 6);
  }
  const impact = plan.effects.find((e) => e.kind === 'burst' && e.at.x === 3)!;
  expect(impact.delay).toBeCloseTo(missile.ttl, 9);
  expect(impact.kind === 'burst' && impact.radius).toBeGreaterThan(0.3);
});

test('виды выстрела различаются планом: пушка и ракета дают разные наборы эффектов', () => {
  const gun = kinds(planEffects([shot()], { ...ctx, shotKind: () => 'gun' }).effects);
  const missile = kinds(planEffects([shot()], { ...ctx, shotKind: () => 'missile' }).effects);
  expect(gun).toContain('tracer');
  expect(missile).toContain('missile');
  expect(gun).not.toContain('missile');
  expect(missile).not.toContain('tracer');
});

test('трассер берёт цвет группы, если контекст его знает', () => {
  const colored = planEffects([shot()], { ...ctx, groupColor: (id) => (id === 1 ? 0x4f9de8 : undefined) });
  expect(colored.effects.find((e) => e.kind === 'tracer')).toMatchObject({ color: 0x4f9de8 });
  const plain = planEffects([shot()], { ...ctx, groupColor: () => undefined });
  expect(plain.effects.find((e) => e.kind === 'tracer')).toMatchObject({ color: EFFECT_COLORS.tracer });
});

test('groupShot с неизвестной позицией не падает и не рисует эффектов', () => {
  const plan = planEffects([{ type: 'groupShot', group: 1, enemy: 99, damage: 5 }], ctx);
  expect(plan.effects).toEqual([]);
  expect(plan.fired).toEqual([1]);
});

test('kill -> взрыв: вспышка, огненный шар, кольцо, осколки и дым; пометка гибели', () => {
  const plan = planEffects([{ type: 'kill', enemy: 7, reward: 10 }], ctx);
  expect(plan.killed).toEqual([7]);
  const ks = kinds(plan.effects);
  expect(ks.filter((k) => k === 'burst').length).toBeGreaterThanOrEqual(2);
  expect(ks).toContain('ring');
  expect(ks).toContain('smoke');
  expect(ks.filter((k) => k === 'debris').length).toBeGreaterThanOrEqual(5);
  for (const e of plan.effects) {
    if (e.kind === 'tracer' || e.kind === 'missile') throw new Error('взрыв без снарядов');
    expect(e.at.x).toBeCloseTo(3, 0);
    expect(e.at.z).toBeCloseTo(4, 0);
  }
});

test('взрыв крупнее у крупного врага, размер — из прочности и масштаба в данных', () => {
  const small = blastSize(CONTENT.enemies.runner!.hp, CONTENT.enemies.runner!.visual!.scale);
  const mid = blastSize(CONTENT.enemies.tank!.hp, CONTENT.enemies.tank!.visual!.scale);
  const big = blastSize(CONTENT.enemies.bomber!.hp, CONTENT.enemies.bomber!.visual!.scale);
  expect(small).toBeLessThan(mid);
  expect(mid).toBeLessThan(big);
  const radiusOf = (size: number) => {
    const plan = planEffects([{ type: 'kill', enemy: 7, reward: 1 }], { ...ctx, enemySize: () => size });
    const fire = plan.effects.filter((e) => e.kind === 'burst').sort((a, b) => (b as { radius: number }).radius - (a as { radius: number }).radius)[0]!;
    return { r: (fire as { radius: number }).radius, debris: plan.effects.filter((e) => e.kind === 'debris').length };
  };
  expect(radiusOf(big).r).toBeGreaterThan(radiusOf(small).r * 2);
  expect(radiusOf(big).debris).toBeGreaterThan(radiusOf(small).debris);
});

test('осколки детерминированы и разлетаются в разные стороны, летят по дуге и падают', () => {
  const run = () => planEffects([{ type: 'kill', enemy: 7, reward: 1 }], ctx).effects.filter((e) => e.kind === 'debris');
  expect(run()).toEqual(run());
  const debris = run().filter((e): e is Extract<EffectSpec, { kind: 'debris' }> => e.kind === 'debris');
  const dirs = new Set(debris.map((d) => Math.round(Math.atan2(d.vel.z, d.vel.x) * 10)));
  expect(dirs.size).toBeGreaterThan(debris.length / 2);
  const d = debris[0]!;
  expect(debrisAt(d.at, d.vel, 0)).toEqual(d.at);
  expect(debrisAt(d.at, d.vel, 0.1).y).toBeGreaterThan(d.at.y);
  expect(debrisAt(d.at, d.vel, 2).y).toBeLessThan(d.at.y);
  const other = planEffects([{ type: 'kill', enemy: 8, reward: 1 }], { ...ctx, enemyPos: () => ({ x: 3, y: 0, z: 4 }) }).effects.filter((e) => e.kind === 'debris');
  expect(other).not.toEqual(run()); // у другого врага другой веер
});

test('leak -> взрыв у базы и пометка прорыва', () => {
  const plan = planEffects([{ type: 'leak', enemy: 8, damage: 2 }], ctx);
  expect(plan.leaked).toEqual([8]);
  expect(plan.effects.some((e) => e.kind === 'burst' && e.color === EFFECT_COLORS.leak)).toBe(true);
  for (const e of plan.effects) if ('at' in e) expect(e.at.x).toBeCloseTo(9, 0);
});

test('trimEffects: при нехватке места первыми уходят дым и осколки, снаряды и вспышки остаются', () => {
  const plan = planEffects([{ type: 'kill', enemy: 7, reward: 1 }, shot(45)], { ...ctx, shotKind: () => 'missile' });
  const all = plan.effects;
  expect(trimEffects(all, 1000)).toEqual(all);
  expect(trimEffects(all, 0)).toEqual([]);
  const room = all.filter((e) => e.kind === 'burst' || e.kind === 'missile').length;
  const trimmed = trimEffects(all, room);
  expect(trimmed).toHaveLength(room);
  expect(trimmed.every((e) => e.kind === 'burst' || e.kind === 'missile')).toBe(true);
  const more = trimEffects(all, room + 3);
  expect(more).toHaveLength(room + 3);
  // порядок сохраняется
  expect(all.filter((e) => more.includes(e))).toEqual(more);
});

test('прочие события (waveStart, income, sortieDone и будущие) игнорируются', () => {
  const events = [
    { type: 'waveStart', wave: 0 },
    { type: 'income', group: 1, amount: 5 },
    { type: 'sortieDone', group: 1, sortie: 1 },
    { type: 'future' },
  ] as unknown as SimEvent[];
  expect(planEffects(events, ctx)).toEqual({ effects: [], fired: [], hit: [], killed: [], leaked: [] });
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
