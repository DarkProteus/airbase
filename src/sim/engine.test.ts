import { describe, expect, test } from 'vitest';
import { CONTENT, MISSIONS } from '../content';
import { applyModifiers, createSim, damageEnemy, DT, pointAt, simTime, snapshot, step, TICK_RATE } from '.';
import type { Content, MissionConfig } from '.';

const content: Content = {
  groups: {},
  enemies: {
    e: { id: 'e', name: 'E', hp: 10, speed: 2, reward: 7, leakDamage: 3, tags: [] },
    j: { id: 'j', name: 'J', hp: 10, speed: 2, speedVar: 0.5, reward: 1, leakDamage: 1, tags: [] },
  },
};

const mission = (over: Partial<MissionConfig> = {}): MissionConfig => ({
  id: 'm',
  name: 'M',
  path: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
  ],
  size: { w: 21, h: 11 },
  airfield: { x: 0, y: 0 },
  baseLives: 5,
  waves: [{ prep: 1, groups: [{ enemy: 'e', count: 3, interval: 0.5 }] }],
  ...over,
});

const run = (sim: ReturnType<typeof createSim>, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(sim);
};

describe('тик', () => {
  test('N шагов продвигают время ровно на N*dt', () => {
    const sim = createSim(mission(), content, 1);
    run(sim, 45);
    expect(sim.state.tick).toBe(45);
    expect(simTime(sim)).toBe(45 * DT);
  });
});

describe('волны', () => {
  test('спавн по расписанию из конфига', () => {
    const sim = createSim(mission(), content, 1);
    const spawnTicks: number[] = [];
    for (let i = 0; i < 3 * TICK_RATE; i++) {
      const tick = sim.state.tick;
      step(sim);
      for (const ev of sim.state.events) if (ev.type === 'spawn') spawnTicks.push(tick);
    }
    expect(spawnTicks).toEqual([1, 1.5, 2].map((s) => s * TICK_RATE));
  });

  test('группы волны сливаются в расписание волны, смещения от старта волны', () => {
    const sim = createSim(
      mission({
        waves: [
          { prep: 0, groups: [{ enemy: 'e', count: 2, interval: 1 }, { enemy: 'j', count: 1, interval: 0, delay: 0.5 }] },
          { prep: 3, groups: [{ enemy: 'j', count: 1, interval: 0 }] },
        ],
      }),
      content,
      1,
    );
    expect(sim.waveSpawns.map((w) => w.map((s) => [s.tick / TICK_RATE, s.enemy]))).toEqual([
      [[0, 'e'], [0.5, 'j'], [1, 'e']],
      [[0, 'j']],
    ]);
  });

  test('неизвестный враг в волне — ошибка при создании', () => {
    expect(() => createSim(mission({ waves: [{ prep: 0, groups: [{ enemy: 'nope', count: 1, interval: 0 }] }] }), content, 1)).toThrow();
  });
});

describe('путь', () => {
  test('pointAt интерполирует по полилинии', () => {
    const path = createSim(mission(), content, 1).path!;
    expect(path.length).toBe(8);
    expect(pointAt(path, 2)).toEqual({ x: 2, y: 0 });
    expect(pointAt(path, 6)).toEqual({ x: 4, y: 2 });
    expect(pointAt(path, 99)).toEqual({ x: 4, y: 4 });
  });

  test('враг идёт по пути и при достижении конца отнимает жизни базы', () => {
    const sim = createSim(mission({ waves: [{ prep: 0, groups: [{ enemy: 'e', count: 1, interval: 0 }] }] }), content, 1);
    run(sim, TICK_RATE);
    expect(sim.state.enemies[0]!.dist).toBeCloseTo(2, 9);
    expect(sim.state.lives).toBe(5);
    run(sim, 3 * TICK_RATE + 1);
    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.state.lives).toBe(2);
  });

  test('жизни ≤ 0 → lost, симуляция останавливается', () => {
    const sim = createSim(mission({ baseLives: 3 }), content, 1);
    run(sim, 20 * TICK_RATE);
    expect(sim.state.status).toBe('lost');
    const tick = sim.state.tick;
    step(sim);
    expect(sim.state.tick).toBe(tick);
  });
});

describe('награда', () => {
  test('награда за убийство; победа после зачистки последней волны', () => {
    const sim = createSim(mission({ waves: [{ prep: 0, groups: [{ enemy: 'e', count: 1, interval: 0 }] }] }), content, 1);
    step(sim);
    const id = sim.state.enemies[0]!.id;
    expect(damageEnemy(sim, id, 4)).toBe(false);
    expect(sim.state.money).toBe(0);
    expect(damageEnemy(sim, id, 6)).toBe(true);
    expect(sim.state.money).toBe(7);
    step(sim);
    expect(sim.state.status).toBe('won');
  });
});

describe('детерминизм', () => {
  const play = (seed: number) => {
    const sim = createSim(mission({ waves: [{ prep: 0, groups: [{ enemy: 'j', count: 4, interval: 0.3 }] }] }), content, seed);
    run(sim, 2 * TICK_RATE);
    return snapshot(sim);
  };

  test('один сид → идентичный снапшот, разные сиды → разный', () => {
    expect(play(42)).toEqual(play(42));
    expect(play(42)).not.toEqual(play(43));
  });

  test('снапшот — независимая копия', () => {
    const sim = createSim(mission(), content, 1);
    const snap = snapshot(sim);
    run(sim, 10);
    expect(snap.tick).toBe(0);
  });
});

describe('модификаторы', () => {
  test('(база + Σadd) * Πmul', () => {
    expect(
      applyModifiers({ damage: 10, range: 3 }, [
        { stat: 'damage', op: 'mul', value: 2, scope: 'self' },
        { stat: 'damage', op: 'add', value: 5, scope: 'self' },
        { stat: 'income', op: 'add', value: 4, scope: 'global' },
      ]),
    ).toEqual({ damage: 30, range: 3, income: 4 });
  });
});

describe('контент', () => {
  test.each(Object.values(MISSIONS))('миссия $id проходит через движок; без авиации цель не выживает', (m) => {
    const sim = createSim(m, CONTENT, 7);
    run(sim, 300 * TICK_RATE);
    expect(sim.state.status).toBe('lost');
  });
});
