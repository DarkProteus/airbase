import { describe, expect, test } from 'vitest';
import { createSim, flightTicks, groupStats, snapshot, step, TICK_RATE } from '.';
import type { AirGroupConfig, Content, LineupEntry, MissionConfig, SimEvent, SortiePhase } from '.';

const group = (over: Partial<AirGroupConfig> = {}): AirGroupConfig => ({
  id: 'g',
  name: 'G',
  role: 'test',
  cost: 100,
  tags: ['air'],
  speed: 3,
  fuel: 20,
  ammo: 4,
  takeoffTime: 1,
  rearmTime: 2,
  zoneRadius: 2,
  weapons: [{ damage: 5, fireRate: 1, targetTags: [] }],
  auras: [],
  upgrades: [{ cost: 50, modifiers: [{ stat: 'fuel', op: 'add', value: 10, scope: 'self' }] }],
  ...over,
});

const content = (groups: AirGroupConfig[] = [group()]): Content => ({
  enemies: {
    // Живучий и медленный: идёт по y = 0 со скоростью 0,5 клетки/с.
    e: { id: 'e', name: 'E', hp: 1e6, speed: 0.5, reward: 1, leakDamage: 1, tags: ['ground'] },
    j: { id: 'j', name: 'J', hp: 20, speed: 1, speedVar: 0.5, reward: 1, leakDamage: 1, tags: ['air'] },
  },
  groups: Object.fromEntries(groups.map((g) => [g.id, g])),
});

/** Карта 21×11, аэродром на левом краю; по умолчанию врагов нет. */
const mission = (over: Partial<MissionConfig> = {}): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 21, h: 11 },
  airfield: { x: 0, y: 5 },
  path: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ],
  baseLives: 5,
  waves: [],
  ...over,
});

const enemyWave = (enemy: string, count = 1): MissionConfig['waves'] => [{ prep: 0, groups: [{ enemy, count, interval: 1 }] }];
const at = (x: number, y = 5, level = 0, id = 'g'): LineupEntry => ({ group: id, level, zone: { x, y } });

/** Шагает, пока первая группа не войдёт в фазу. */
function until(sim: ReturnType<typeof createSim>, phase: SortiePhase): void {
  for (let i = 0; sim.state.groups[0]!.phase !== phase; i++) {
    if (i > 1e5) throw new Error(`phase ${phase} not reached`);
    step(sim);
  }
}

/** Прогоняет матч и возвращает тики, на которых первая группа входила в очередную фазу. */
function timeline(sim: ReturnType<typeof createSim>, ticks: number): { phase: SortiePhase; tick: number }[] {
  const g = sim.state.groups[0]!;
  const out = [{ phase: g.phase, tick: 0 }];
  for (let i = 0; i < ticks; i++) {
    step(sim);
    if (g.phase !== out[out.length - 1]!.phase) out.push({ phase: g.phase, tick: sim.state.tick });
  }
  return out;
}

/** Длительность каждой фазы первого вылета в тиках. */
function durations(zoneX: number): Record<string, number> {
  const tl = timeline(createSim(mission(), content(), 1, [at(zoneX)]), 900);
  return Object.fromEntries(tl.slice(0, 5).map((p, i) => [p.phase, tl[i + 1]!.tick - p.tick]));
}

describe('состав на вылет', () => {
  test('группы, уровни и стартовые зоны задаются при создании матча', () => {
    const sim = createSim(mission(), content([group(), group({ id: 'h' })]), 1, [at(6, 5, 1), at(3, 2, 0, 'h')]);
    expect(sim.state.groups.map((g) => [g.type, g.level, g.zone, g.phase, g.pos])).toEqual([
      ['g', 1, { x: 6, y: 5 }, 'takeoff', { x: 0, y: 5 }],
      ['h', 0, { x: 3, y: 2 }, 'takeoff', { x: 0, y: 5 }],
    ]);
    expect(new Set(sim.state.groups.map((g) => g.id)).size).toBe(2);
  });

  test('без состава групп нет', () => {
    const sim = createSim(mission(), content(), 1);
    step(sim);
    expect(sim.state.groups).toEqual([]);
  });

  test('неверный состав или аэродром не на краю — ошибка создания', () => {
    expect(() => createSim(mission(), content(), 1, [at(6, 5, 0, 'nope')])).toThrow(/unknown group/);
    expect(() => createSim(mission(), content(), 1, [at(99)])).toThrow(/zone outside/);
    expect(() => createSim(mission(), content(), 1, [at(6, 5, 2)])).toThrow(/bad level/);
    expect(() => createSim(mission({ airfield: { x: 5, y: 5 } }), content(), 1, [at(6)])).toThrow(/airfield/);
  });

  test('уровень улучшения применяет self-модификаторы к параметрам группы', () => {
    const c = content();
    expect(groupStats({ content: c }, { type: 'g', level: 0 }).fuel).toBe(20);
    expect(groupStats({ content: c }, { type: 'g', level: 1 }).fuel).toBe(30);
    expect(createSim(mission(), c, 1, [at(6, 5, 1)]).state.groups[0]!.fuel).toBe(30 * TICK_RATE);
  });
});

describe('цикл вылета', () => {
  test('взлёт → перелёт → патруль → возврат → перезарядка → снова, длительности из конфига', () => {
    // Зона в 6 клетках: перелёт 6 / 3 = 2 с; топливо 20 с = 2 + 16 (патруль) + 2; взлёт 1 с, перезарядка 2 с.
    const tl = timeline(createSim(mission(), content(), 1, [at(6)]), 24 * TICK_RATE);
    expect(tl).toEqual([
      { phase: 'takeoff', tick: 0 },
      { phase: 'transit', tick: 1 * TICK_RATE },
      { phase: 'patrol', tick: 3 * TICK_RATE },
      { phase: 'return', tick: 19 * TICK_RATE },
      { phase: 'rearm', tick: 21 * TICK_RATE },
      { phase: 'takeoff', tick: 23 * TICK_RATE },
      { phase: 'transit', tick: 24 * TICK_RATE },
    ]);
  });

  test('длительности следуют за конфигом', () => {
    const slow = group({ takeoffTime: 3, rearmTime: 5, speed: 1.5, fuel: 30 });
    const tl = timeline(createSim(mission(), content([slow]), 1, [at(6)]), 40 * TICK_RATE);
    // Перелёт 6 / 1,5 = 4 с; патруль 30 − 4 − 4 = 22 с.
    expect(tl.map((p) => p.tick / TICK_RATE)).toEqual([0, 3, 7, 29, 33, 38]);
  });

  test('время перелёта = расстояние / скорость', () => {
    for (const x of [3, 6, 9]) {
      const d = durations(x);
      expect(d.transit).toBe((x / 3) * TICK_RATE);
      expect(d.return).toBe((x / 3) * TICK_RATE);
      expect(d.transit).toBe(flightTicks({ x: 0, y: 5 }, { x, y: 5 }, 3));
    }
  });

  test('чем дальше зона от аэродрома, тем меньше времени в зоне за вылет', () => {
    const [near, mid, far] = [3, 6, 9].map((x) => durations(x).patrol!);
    expect(near).toBe(18 * TICK_RATE);
    expect(mid).toBe(16 * TICK_RATE);
    expect(far).toBe(14 * TICK_RATE);
  });

  test('группа в патруле стоит в центре зоны, после возврата — на аэродроме', () => {
    const sim = createSim(mission(), content(), 1, [at(6, 2)]);
    const g = sim.state.groups[0]!;
    until(sim, 'patrol');
    expect(g.pos).toEqual({ x: 6, y: 2 });
    until(sim, 'rearm');
    expect(g.pos).toEqual({ x: 0, y: 5 });
  });
});

describe('топливо и боекомплект', () => {
  test('топливо кончается — группа уходит на возврат с полным боекомплектом и садится с пустым баком', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const g = sim.state.groups[0]!;
    until(sim, 'return');
    expect(g.ammo).toBe(4);
    expect(g.fuel).toBe(flightTicks(g.pos, sim.mission.airfield, 3));
    until(sim, 'rearm');
    expect(g.fuel).toBe(0);
  });

  test('боекомплект кончается раньше топлива — группа уходит на возврат', () => {
    // Зона накрывает начало пути врага; 4 выстрела по одному в секунду.
    const sim = createSim(mission({ waves: enemyWave('e') }), content(), 1, [at(1, 1)]);
    const g = sim.state.groups[0]!;
    until(sim, 'return');
    expect(g.ammo).toBe(0);
    expect(g.fuel).toBeGreaterThan(10 * TICK_RATE);
  });

  test('после перезарядки топливо и боекомплект восстановлены', () => {
    const sim = createSim(mission({ waves: enemyWave('e') }), content(), 1, [at(1, 1)]);
    const g = sim.state.groups[0]!;
    until(sim, 'rearm');
    expect(g.ammo).toBe(0);
    expect(g.fuel).toBeLessThan(20 * TICK_RATE);
    until(sim, 'takeoff');
    expect(g.ammo).toBe(4);
    expect(g.fuel).toBe(20 * TICK_RATE);
  });

  test('группа без оружия и боекомплекта патрулирует, пока есть топливо', () => {
    const unarmed = group({ ammo: 0, weapons: [] });
    const tl = timeline(createSim(mission({ waves: enemyWave('e') }), content([unarmed]), 1, [at(6)]), 20 * TICK_RATE);
    expect(tl.map((p) => p.tick / TICK_RATE)).toEqual([0, 1, 3, 19]);
  });
});

describe('огонь', () => {
  /**
   * Враг идёт по y = 0 и находится в зоне (центр 3;1, радиус 2) примерно с 2,5 по 9,5 с.
   * Группа медленная: взлёт 1 с + перелёт 5 с — прилетает, когда враг уже в зоне.
   */
  const setup = (over: Partial<AirGroupConfig> = {}) =>
    createSim(mission({ waves: enemyWave('e') }), content([group({ speed: 1, fuel: 60, ammo: 100, ...over })]), 1, [at(3, 1)]);

  function shots(sim: ReturnType<typeof createSim>, seconds: number) {
    const g = sim.state.groups[0]!;
    const out: { tick: number; phase: SortiePhase; enemyX: number; ammoUsed: number }[] = [];
    for (let i = 0; i < seconds * TICK_RATE; i++) {
      const before = { tick: sim.state.tick, phase: g.phase, ammo: g.ammo, enemyX: (sim.state.enemies[0]?.dist ?? NaN) };
      step(sim);
      const n = sim.state.events.filter((e) => e.type === 'groupShot').length;
      if (n) out.push({ tick: before.tick, phase: before.phase, enemyX: before.enemyX, ammoUsed: before.ammo - g.ammo });
    }
    return out;
  }

  test('группа атакует только в фазе патруля', () => {
    const fired = shots(setup(), 20);
    expect(fired.length).toBeGreaterThan(0);
    expect(new Set(fired.map((s) => s.phase))).toEqual(new Set(['patrol']));
    // Враг вошёл в зону раньше, но до прилёта группы (6 с) по нему не стреляют.
    expect(fired[0]!.tick).toBe(6 * TICK_RATE);
  });

  test('группа атакует только врагов внутри своей зоны', () => {
    const fired = shots(setup(), 20);
    for (const s of fired) expect(Math.hypot(s.enemyX - 3, 0 - 1)).toBeLessThanOrEqual(2);
    // Враг вышел из зоны около 9,5 с; группа ещё в патруле, но больше не стреляет.
    expect(fired[fired.length - 1]!.tick).toBeLessThan(9.5 * TICK_RATE);
    expect(fired.length).toBe(4);
  });

  test('каждый выстрел расходует один боекомплект', () => {
    const sim = setup();
    const fired = shots(sim, 20);
    expect(fired.every((s) => s.ammoUsed === 1)).toBe(true);
    expect(sim.state.groups[0]!.ammo).toBe(100 - fired.length);
  });

  test('оружие бьёт только врагов с целевым тегом', () => {
    const antiAir = { weapons: [{ damage: 5, fireRate: 1, targetTags: ['air'] }] };
    expect(shots(setup(antiAir), 20)).toEqual([]);
    const antiGround = { weapons: [{ damage: 5, fireRate: 1, targetTags: ['ground'] }] };
    expect(shots(setup(antiGround), 20).length).toBe(4);
  });
});

describe('события и детерминизм', () => {
  test('завершённый вылет попадает в события sim в тик посадки', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const seen: { tick: number; ev: SimEvent }[] = [];
    for (let i = 0; i < 45 * TICK_RATE; i++) {
      step(sim);
      for (const ev of sim.state.events) if (ev.type === 'sortieDone') seen.push({ tick: sim.state.tick, ev });
    }
    const id = sim.state.groups[0]!.id;
    // Первый вылет садится на 21-й секунде, цикл повторяется каждые 23 с.
    expect(seen).toEqual([
      { tick: 21 * TICK_RATE, ev: { type: 'sortieDone', group: id, sortie: 1 } },
      { tick: 44 * TICK_RATE, ev: { type: 'sortieDone', group: id, sortie: 2 } },
    ]);
    expect(sim.state.groups[0]!.sorties).toBe(2);
  });

  test('два прогона с одним сидом дают идентичный снапшот, другой сид — другой', () => {
    const play = (seed: number) => {
      const sim = createSim(mission({ waves: enemyWave('j', 12) }), content([group(), group({ id: 'h', speed: 2 })]), seed, [
        at(4, 1),
        at(9, 2, 0, 'h'),
      ]);
      for (let i = 0; i < 20 * TICK_RATE; i++) step(sim);
      return snapshot(sim);
    };
    const a = play(7);
    expect(a.groups.length).toBe(2);
    expect([a.tick, a.status]).toEqual([20 * TICK_RATE, 'running']);
    expect(play(7)).toEqual(a);
    expect(play(8)).not.toEqual(a);
  });
});

describe('команда setZone', () => {
  const setZone = (sim: ReturnType<typeof createSim>, zone: { x: number; y: number }, groupId = sim.state.groups[0]!.id) =>
    step(sim, [{ type: 'setZone', group: groupId, zone }]);
  /** Шагает до патруля (или иной фазы) и возвращает позицию группы в момент входа. */
  const reach = (sim: ReturnType<typeof createSim>, phase: SortiePhase) => {
    until(sim, phase);
    return sim.state.groups[0]!;
  };

  test('команда задаёт центр зоны и шлёт событие; радиус зоны остаётся из конфига', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const g = sim.state.groups[0]!;
    setZone(sim, { x: 9, y: 2 });
    expect(g.zone).toEqual({ x: 9, y: 2 });
    expect(sim.state.events).toContainEqual({ type: 'zoneSet', group: g.id, zone: { x: 9, y: 2 } });
    expect(groupStats(sim, g).zoneRadius).toBe(2);
  });

  test('во время взлёта: зона применяется к перелёту', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    setZone(sim, { x: 6, y: 9 });
    const g = reach(sim, 'patrol');
    expect(g.pos).toEqual({ x: 6, y: 9 });
  });

  test('во время перелёта: группа сразу меняет курс, фаза остаётся перелётом', () => {
    const sim = createSim(mission(), content(), 1, [at(12)]);
    const g = reach(sim, 'transit');
    for (let i = 0; i < 10; i++) step(sim);
    const before = { ...g.pos };
    setZone(sim, { x: 4, y: 10 });
    // Тот же тик уже летит к новой точке: по y вниз, а не по прямой к старой зоне.
    expect(g.phase).toBe('transit');
    expect(g.pos.y).toBeGreaterThan(before.y);
    reach(sim, 'patrol');
    expect(g.pos).toEqual({ x: 4, y: 10 });
  });

  test('во время патруля: группа сразу уходит в перелёт к новой зоне и патрулирует её', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const g = reach(sim, 'patrol');
    expect(g.pos).toEqual({ x: 6, y: 5 });
    setZone(sim, { x: 12, y: 5 });
    expect(g.phase).toBe('transit');
    expect(g.pos.x).toBeGreaterThan(6);
    const fuel = g.fuel;
    until(sim, 'patrol');
    expect(g.pos).toEqual({ x: 12, y: 5 });
    expect(g.fuel).toBeLessThan(fuel);
  });

  test('во время возврата: курс не меняется, зона учтётся в следующем вылете', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const g = reach(sim, 'return');
    setZone(sim, { x: 3, y: 9 });
    expect(g.phase).toBe('return');
    expect(g.zone).toEqual({ x: 3, y: 9 });
    step(sim);
    expect(g.pos.y).toBe(5); // всё ещё домой по прямой, не к новой зоне
    until(sim, 'rearm');
    expect(g.pos).toEqual({ x: 0, y: 5 });
    until(sim, 'takeoff');
    expect(reach(sim, 'patrol').pos).toEqual({ x: 3, y: 9 });
    expect(g.sorties).toBe(1);
  });

  test('во время перезарядки: зона применяется к следующему вылету', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const g = reach(sim, 'rearm');
    setZone(sim, { x: 9, y: 1 });
    expect(g.phase).toBe('rearm');
    expect(g.pos).toEqual({ x: 0, y: 5 });
    until(sim, 'takeoff');
    expect(g.fuel).toBe(20 * TICK_RATE);
    expect(reach(sim, 'patrol').pos).toEqual({ x: 9, y: 1 });
  });

  test('зона вне карты отклоняется событием с причиной, зона не меняется', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const g = sim.state.groups[0]!;
    for (const zone of [{ x: -1, y: 5 }, { x: 21, y: 5 }, { x: 5, y: 11 }, { x: 5, y: -0.5 }, { x: NaN, y: 3 }]) {
      const cmd = { type: 'setZone' as const, group: g.id, zone };
      step(sim, [cmd]);
      expect(sim.state.events).toContainEqual({ type: 'rejected', command: cmd, reason: 'outOfMap' });
      expect(g.zone).toEqual({ x: 6, y: 5 });
    }
    // Граница карты — внутри.
    setZone(sim, { x: 20, y: 10 });
    expect(g.zone).toEqual({ x: 20, y: 10 });
  });

  test('неизвестная группа отклоняется событием с причиной, остальные группы не затронуты', () => {
    const sim = createSim(mission(), content(), 1, [at(6)]);
    const cmd = { type: 'setZone' as const, group: 99, zone: { x: 3, y: 3 } };
    step(sim, [cmd]);
    expect(sim.state.events).toEqual([{ type: 'rejected', command: cmd, reason: 'unknownGroup' }]);
    expect(sim.state.groups[0]!.zone).toEqual({ x: 6, y: 5 });
  });

  test('группы переносятся независимо', () => {
    const sim = createSim(mission(), content([group(), group({ id: 'h' })]), 1, [at(6), at(8, 2, 0, 'h')]);
    setZone(sim, { x: 4, y: 4 }, sim.state.groups[1]!.id);
    expect(sim.state.groups.map((g) => g.zone)).toEqual([{ x: 6, y: 5 }, { x: 4, y: 4 }]);
  });
});
