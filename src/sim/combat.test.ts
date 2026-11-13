import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CONTENT, UNITS } from '../content';
import { createSim, enemySpeed, step, TICK_RATE, unitStats } from '.';
import type { Content, MissionConfig, Sim, SimEvent } from '.';

const dummy = (hp: number, speed: number) => ({ id: 'e', name: 'E', hp, speed, reward: 0, leakDamage: 1, tags: ['air'] });
/** Прямой путь по y=0; слоты на y=1. Контент — реальные юниты, враг — мишень. */
const mission = (slots: number[], over: Partial<MissionConfig> = {}): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 41, h: 3 },
  path: [{ x: 0, y: 0 }, { x: 40, y: 0 }],
  slots: slots.map((x) => ({ x, y: 1 })),
  startMoney: 10_000,
  baseLives: 99,
  waves: [{ prep: 0, groups: [{ enemy: 'e', count: 1, interval: 0 }] }],
  ...over,
});
const withEnemy = (hp: number, speed: number): Content => ({ units: CONTENT.units, enemies: { e: dummy(hp, speed) } });

function play(sim: Sim, ticks: number, buys: [string, number][] = []): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(sim, i === 0 ? buys.map(([unit, slot]) => ({ type: 'buy' as const, unit, slot })) : []);
    events.push(...sim.state.events.map((e) => ({ ...e, tick: sim.state.tick - 1 })));
  }
  return events;
}
const shots = (events: SimEvent[], unit?: number) =>
  events.filter((e): e is Extract<SimEvent, { type: 'shot' }> & { tick: number } => e.type === 'shot' && (unit === undefined || e.unit === unit));
const dealt = (events: SimEvent[], unit?: number) => shots(events, unit).reduce((s, e) => s + e.damage, 0);

describe('истребитель', () => {
  test('стреляет только по цели в радиусе, с темпом fireRate и уроном из конфига', () => {
    const f16 = UNITS.f16!;
    const sim = createSim(mission([10]), withEnemy(1e6, 1), 1);
    const ev = shots(play(sim, 20 * TICK_RATE, [['f16', 0]]));
    const period = Math.round(TICK_RATE / f16.stats.fireRate!);
    // Враг идёт 1 кл/с по y=0, юнит в (10,1): в радиусе при |x-10| ≤ sqrt(range²-1).
    const half = Math.sqrt(f16.stats.range! ** 2 - 1);
    expect(ev[0]!.tick / TICK_RATE).toBeGreaterThanOrEqual(10 - half);
    expect(ev[0]!.tick / TICK_RATE).toBeLessThan(10 - half + 2 / TICK_RATE);
    expect(ev.at(-1)!.tick / TICK_RATE).toBeLessThanOrEqual(10 + half);
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.tick - ev[i - 1]!.tick).toBe(period);
    expect(ev.every((e) => e.damage === f16.stats.damage)).toBe(true);
    expect(ev.length).toBe(Math.floor((2 * half * TICK_RATE) / period) + 1);
  });

  test('выбирает самого продвинутого врага в радиусе и убивает его', () => {
    const sim = createSim(
      mission([10], { waves: [{ prep: 0, groups: [{ enemy: 'e', count: 3, interval: 0.5 }] }] }),
      withEnemy(UNITS.f16!.stats.damage! * 2, 1),
      1,
    );
    const ev = play(sim, 20 * TICK_RATE, [['f16', 0]]);
    const order = shots(ev).map((e) => e.enemy);
    const first = order[0]!;
    expect(order.slice(0, 2)).toEqual([first, first]);
    expect(ev.filter((e) => e.type === 'kill').map((e) => e.enemy)).toEqual([first, first + 1, first + 2]);
    expect(sim.state.status).toBe('won');
  });
});

describe('юнит поддержки', () => {
  const run = (buys: [string, number][]) => {
    const sim = createSim(mission([10, 11, 30]), withEnemy(1e6, 1), 1);
    return { sim, ev: play(sim, 45 * TICK_RATE, buys) };
  };

  test('сам почти не наносит урон', () => {
    const solo = run([['growler', 0]]);
    const fighter = run([['f16', 0]]);
    expect(dealt(solo.ev)).toBeGreaterThan(0);
    expect(dealt(solo.ev)).toBeLessThan(dealt(fighter.ev) * 0.1);
  });

  test('аура измеримо усиливает ударных союзников в зоне, вне зоны и не по тегам — нет', () => {
    const base = run([['f16', 0], ['f16', 2]]);
    const { sim, ev } = run([['f16', 0], ['growler', 1], ['f16', 2]]);
    const [near, growler, far] = sim.state.units;
    expect(unitStats(sim, near!).fireRate).toBeCloseTo(UNITS.f16!.stats.fireRate! * 1.5);
    expect(unitStats(sim, far!).fireRate).toBe(UNITS.f16!.stats.fireRate);
    expect(unitStats(sim, growler!)).toEqual(UNITS.growler!.stats);
    // Ближний F-16 под аурой наносит заметно больше (ускорение стрельбы + замедление врага в зоне), дальний — как раньше.
    expect(dealt(ev, near!.id)).toBeGreaterThan(dealt(base.ev, base.sim.state.units[0]!.id) * 1.5);
    expect(dealt(ev, far!.id)).toBe(dealt(base.ev, base.sim.state.units[1]!.id));
  });

  test('глушение: враги в зоне замедляются, вне зоны — нет', () => {
    const sim = createSim(mission([10]), withEnemy(1e6, 1), 1);
    play(sim, 9 * TICK_RATE, [['growler', 0]]);
    const enemy = sim.state.enemies[0]!;
    expect(enemySpeed(sim, enemy)).toBeCloseTo(0.8);
    play(sim, 15 * TICK_RATE);
    expect(enemySpeed(sim, enemy)).toBe(1);
  });
});

describe('экономический юнит', () => {
  test('приносит доход при старте каждой волны и не стреляет', () => {
    const income = UNITS.c130!.stats.income!;
    const waves = [0, 5, 5].map((prep) => ({ prep, groups: [{ enemy: 'e', count: 1, interval: 0 }] }));
    const sim = createSim(mission([10, 11], { waves, startMoney: UNITS.c130!.cost * 2 }), withEnemy(1e6, 1), 1);
    const ev = play(sim, 12 * TICK_RATE, [['c130', 0], ['c130', 1]]);
    expect(ev.filter((e) => e.type === 'waveStart')).toHaveLength(3);
    expect(ev.filter((e) => e.type === 'income').map((e) => e.amount)).toEqual([income * 2, income * 2, income * 2]);
    expect(sim.state.money).toBe(income * 2 * 3);
    expect(shots(ev)).toHaveLength(0);
  });

  test('без экономических юнитов дохода между волнами нет', () => {
    const sim = createSim(mission([10]), withEnemy(1e6, 1), 1);
    const ev = play(sim, 5 * TICK_RATE, [['f16', 0]]);
    expect(ev.some((e) => e.type === 'income')).toBe(false);
  });
});

describe('контент = данные', () => {
  test('три юнита с разными ролями в реестре', () => {
    expect(Object.keys(UNITS)).toHaveLength(3);
    expect(new Set(Object.values(UNITS).map((u) => u.role)).size).toBe(3);
  });

  test('движок не ветвится по id юнитов и врагов', () => {
    const ids = [...Object.keys(CONTENT.units), ...Object.keys(CONTENT.enemies)];
    const src = readdirSync('src/sim')
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => readFileSync(`src/sim/${f}`, 'utf8'))
      .join('\n');
    for (const id of ids) expect(src).not.toMatch(new RegExp(`['"\`]${id}['"\`]`));
  });
});
