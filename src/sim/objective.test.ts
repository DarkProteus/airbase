import { describe, expect, test } from 'vitest';
import { createSim, OBJECTIVE_REACH, snapshot, step, TICK_RATE } from '.';
import type { Content, EnemyConfig, MissionConfig, ObjectiveConfig, SimEvent } from '.';

const enemy = (id: string, over: Partial<EnemyConfig> = {}): EnemyConfig => ({ id, name: id, hp: 100, speed: 5, reward: 1, leakDamage: 2, tags: ['air'], ...over });
const content: Content = {
  groups: {
    t: { id: 't', name: 'T', role: 'test', cost: 0, tags: [], speed: 5, fuel: 100, ammo: 100, takeoffTime: 0, rearmTime: 1, zoneRadius: 100, weapons: [{ damage: 1, fireRate: 30, targetTags: [] }], auras: [], upgrades: [] },
  },
  enemies: { fast: enemy('fast'), slow: enemy('slow', { speed: 1 }), jitter: enemy('jitter', { speedVar: 0.5 }) },
};

const DEFEND: ObjectiveConfig = { type: 'defend', pos: { x: 10, y: 5 }, hp: 3, duration: 2 };
const ESCORT: ObjectiveConfig = { type: 'escort', route: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], hp: 3, speed: 1 };

/** Карта 21×11 без пути: враги появляются в spawns и летят на цель. */
const mission = (objective: ObjectiveConfig, over: Partial<MissionConfig> = {}): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 21, h: 11 },
  airfield: { x: 0, y: 5 },
  objective,
  spawns: [{ x: 0, y: 5 }],
  baseLives: 5,
  waves: [],
  ...over,
});
const wave = (enemyId: string, count = 1, spawn = 0): MissionConfig['waves'] => [{ prep: 0, groups: [{ enemy: enemyId, count, interval: 0.5, spawn }] }];
const run = (sim: ReturnType<typeof createSim>, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(sim);
};
const play = (sim: ReturnType<typeof createSim>, maxTicks = 1e5) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < maxTicks && sim.state.status === 'running'; i++) {
    step(sim);
    events.push(...sim.state.events);
  }
  return events;
};

describe('цель в конфиге миссии', () => {
  test('состояние цели создаётся из конфига: прочность и стартовая позиция', () => {
    expect(createSim(mission(DEFEND), content, 1).state.objective).toEqual({ hp: 3, pos: { x: 10, y: 5 }, progress: 0 });
    expect(createSim(mission(ESCORT), content, 1).state.objective).toEqual({ hp: 3, pos: { x: 0, y: 0 }, progress: 0 });
  });

  test('миссия без цели живёт по-старому: путь и жизни базы', () => {
    const sim = createSim(mission(DEFEND, { objective: undefined, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], waves: wave('fast') }), content, 1);
    expect(sim.state.objective).toBeUndefined();
    play(sim);
    expect(sim.state.lives).toBe(3);
  });

  test('некорректный конфиг отклоняется при создании', () => {
    expect(() => createSim(mission(DEFEND, { objective: undefined }), content, 1)).toThrow(/path or an objective/);
    expect(() => createSim(mission(DEFEND, { waves: wave('fast', 1, 3) }), content, 1)).toThrow(/spawn point 3/);
    expect(() => createSim(mission(DEFEND, { spawns: undefined, waves: wave('fast') }), content, 1)).toThrow(/spawn point 0/);
    expect(() => createSim(mission({ ...DEFEND, hp: 0 }), content, 1)).toThrow(/hp/);
    expect(() => createSim(mission({ ...ESCORT, speed: 0 }), content, 1)).toThrow(/speed/);
    expect(() => createSim(mission({ ...ESCORT, route: [{ x: 0, y: 0 }] }), content, 1)).toThrow();
  });
});

describe('defend', () => {
  test('победа, когда объект продержался N секунд', () => {
    const sim = createSim(mission(DEFEND), content, 1);
    run(sim, 2 * TICK_RATE - 1);
    expect(sim.state.status).toBe('running');
    step(sim);
    expect(sim.state.status).toBe('won');
    expect(sim.state.objective!.hp).toBe(3);
  });

  test('дошедший до объекта враг наносит ему урон и исчезает; жизни базы не трогаются', () => {
    const sim = createSim(mission({ ...DEFEND, duration: 100 }, { waves: wave('fast') }), content, 1);
    const events = play(sim, 3 * TICK_RATE);
    const leak = events.filter((e) => e.type === 'leak');
    expect(leak).toEqual([{ type: 'leak', enemy: expect.any(Number), damage: 2 }]);
    expect(sim.state.objective!.hp).toBe(1);
    expect(sim.state.enemies).toEqual([]);
    expect(sim.state.lives).toBe(5);
    expect(sim.state.status).toBe('running');
  });

  test('враг летит по прямой от точки входа к объекту и достаёт его с OBJECTIVE_REACH', () => {
    const sim = createSim(mission({ ...DEFEND, duration: 100 }, { spawns: [{ x: 0, y: 5 }], waves: wave('slow') }), content, 1);
    run(sim, TICK_RATE);
    const e = sim.state.enemies[0]!;
    expect(e.pos.x).toBeCloseTo(1, 6);
    expect(e.pos.y).toBe(5);
    while (!sim.state.events.some((ev) => ev.type === 'leak') && sim.state.tick < 20 * TICK_RATE) step(sim);
    // 10 клеток со скоростью 1: удар раньше, чем враг дошёл бы до центра, на радиус досягаемости.
    expect(sim.state.tick / TICK_RATE).toBeCloseTo(10 - OBJECTIVE_REACH, 1);
  });

  test('поражение при прочности объекта ≤ 0, даже если таймер ещё идёт', () => {
    const sim = createSim(mission({ ...DEFEND, duration: 100 }, { waves: wave('fast', 2) }), content, 1);
    play(sim);
    expect(sim.state.status).toBe('lost');
    expect(sim.state.objective!.hp).toBe(-1);
    expect(sim.state.tick).toBeLessThan(100 * TICK_RATE);
  });
});

describe('escort', () => {
  test('колонна движется по маршруту из конфига', () => {
    const sim = createSim(mission(ESCORT), content, 1);
    run(sim, 2 * TICK_RATE);
    expect(sim.state.objective!.pos.x).toBeCloseTo(2, 9);
    expect(sim.state.objective!.pos.y).toBeCloseTo(0, 9);
    run(sim, 3 * TICK_RATE);
    expect(sim.state.objective!.pos.x).toBeCloseTo(4, 9);
    expect(sim.state.objective!.pos.y).toBeCloseTo(1, 9);
    expect(sim.state.status).toBe('running');
  });

  test('победа, когда колонна дошла до выхода', () => {
    const sim = createSim(mission(ESCORT), content, 1);
    play(sim);
    expect(sim.state.status).toBe('won');
    expect(sim.state.tick).toBe(7 * TICK_RATE);
    expect(sim.state.objective!.pos).toEqual({ x: 4, y: 3 });
  });

  test('поражение, когда колонна уничтожена', () => {
    const sim = createSim(mission(ESCORT, { spawns: [{ x: 4, y: 6 }], waves: wave('fast', 2) }), content, 1);
    play(sim);
    expect(sim.state.status).toBe('lost');
    expect(sim.state.objective!.hp).toBeLessThanOrEqual(0);
    expect(sim.state.tick).toBeLessThan(7 * TICK_RATE);
  });
});

describe('наведение врагов на цель', () => {
  const LONG: ObjectiveConfig = { type: 'escort', route: [{ x: 0, y: 0 }, { x: 20, y: 0 }], hp: 100, speed: 2 };

  test('каждый тик враг идёт на текущую позицию цели и меняет курс вслед за колонной', () => {
    const sim = createSim(mission(LONG, { spawns: [{ x: 10, y: 10 }], waves: wave('slow') }), content, 1);
    step(sim);
    const headings: number[] = [];
    for (let i = 0; i < 6 * TICK_RATE; i++) {
      const before = { ...sim.state.enemies[0]!.pos };
      step(sim);
      const e = sim.state.enemies[0]!;
      const goal = sim.state.objective!.pos;
      const move = { x: e.pos.x - before.x, y: e.pos.y - before.y };
      const toGoal = { x: goal.x - before.x, y: goal.y - before.y };
      // Смещение за тик сонаправлено вектору на цель (её позицию в этом же тике).
      expect(move.x * toGoal.y - move.y * toGoal.x).toBeCloseTo(0, 9);
      expect(move.x * toGoal.x + move.y * toGoal.y).toBeGreaterThan(0);
      headings.push(Math.atan2(move.y, move.x));
    }
    // Колонна прошла под врагом слева направо: курс довернул с «влево-вниз» на «вправо-вниз».
    expect(Math.cos(headings[0]!)).toBeLessThan(0);
    expect(Math.cos(headings.at(-1)!)).toBeGreaterThan(0);
    for (let i = 1; i < headings.length; i++) expect(headings[i]).not.toBe(headings[i - 1]);
  });

  test('к неподвижной цели курс не меняется', () => {
    const sim = createSim(mission({ ...DEFEND, duration: 100 }, { spawns: [{ x: 0, y: 0 }], waves: wave('slow') }), content, 1);
    run(sim, 2);
    const a = { ...sim.state.enemies[0]!.pos };
    run(sim, 60);
    const b = sim.state.enemies[0]!.pos;
    expect(Math.atan2(b.y - a.y, b.x - a.x)).toBeCloseTo(Math.atan2(5, 10), 9);
  });

  test('стрельба выбирает врага, который ближе к цели', () => {
    const m = mission({ ...DEFEND, duration: 100 }, {
      spawns: [{ x: 0, y: 5 }, { x: 14, y: 5 }],
      waves: [{ prep: 0, groups: [{ enemy: 'slow', count: 1, interval: 0, spawn: 0 }, { enemy: 'slow', count: 1, interval: 0, spawn: 1 }] }],
    });
    const sim = createSim(m, content, 1, [{ group: 't', level: 0, zone: { x: 5, y: 5 } }]);
    step(sim);
    const near = sim.state.enemies.find((e) => e.pos.x > 10)!;
    while (sim.state.groups[0]!.phase !== 'patrol') step(sim);
    step(sim);
    const shots = sim.state.events.filter((e) => e.type === 'groupShot');
    expect(shots).toEqual([{ type: 'groupShot', group: sim.state.groups[0]!.id, enemy: near.id, damage: 1 }]);
  });
});

test('прогон с целью детерминирован по сиду, а разброс скорости зависит от сида', () => {
  const m = mission({ ...DEFEND, hp: 50, duration: 10 }, { waves: wave('jitter', 6) });
  const final = (seed: number) => {
    const sim = createSim(m, content, seed);
    play(sim);
    return snapshot(sim);
  };
  expect(final(3)).toEqual(final(3));
  expect(final(4).objective).not.toEqual(undefined);
  const mid = (seed: number) => {
    const sim = createSim(m, content, seed);
    run(sim, 40);
    return snapshot(sim).enemies;
  };
  expect(mid(3)).not.toEqual(mid(4));
});
