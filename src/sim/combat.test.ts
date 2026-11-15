import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CONTENT, GROUPS } from '../content';
import { createSim, DT, effectiveGroupStats, enemySpeed, groupStats, step, TICK_RATE } from '.';
import type { AirGroupConfig, Content, LineupEntry, MissionConfig, Sim, SimEvent, SortiePhase } from '.';

type Shot = Extract<SimEvent, { type: 'groupShot' }>;

/** Мишени: неубиваемые и почти неподвижные, появляются в (0,5). */
const enemies: Content['enemies'] = {
  air: { id: 'air', name: 'Air', hp: 1e9, speed: 0.01, reward: 0, leakDamage: 0, tags: ['air'] },
  ground: { id: 'ground', name: 'Ground', hp: 1e9, speed: 0.01, reward: 0, leakDamage: 0, tags: ['ground'] },
};
const content = (extra: AirGroupConfig[] = []): Content => ({
  enemies,
  groups: { ...GROUPS, ...Object.fromEntries(extra.map((g) => [g.id, g])) },
});

/** Карта 41×11: путь врагов по y = 5, аэродром на верхнем краю над точкой входа. */
const mission = (targets: string[] = ['air', 'ground']): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 41, h: 11 },
  airfield: { x: 0, y: 0 },
  path: [{ x: 0, y: 5 }, { x: 40, y: 5 }],
  baseLives: 99,
  waves: targets.length ? [{ prep: 0, groups: targets.map((enemy) => ({ enemy, count: 1, interval: 0 })) }] : [],
});

/** Зона рядом с мишенями (NEAR) и далеко от них (FAR). */
const NEAR = { x: 2, y: 5 };
const FAR = { x: 30, y: 5 };
const entry = (group: string, zone = NEAR, level = 0): LineupEntry => ({ group, level, zone });
const group = (sim: Sim, type: string) => sim.state.groups.find((g) => g.type === type)!;

/** Прогон на `seconds`; каждое событие дополняется фазами групп на начало его тика. */
function play(sim: Sim, seconds: number) {
  const events: (SimEvent & { phases: Record<string, SortiePhase> })[] = [];
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    const phases = Object.fromEntries(sim.state.groups.map((g) => [g.type, g.phase]));
    step(sim);
    events.push(...sim.state.events.map((e) => ({ ...e, phases })));
  }
  return events;
}
const shots = <T extends SimEvent>(events: T[], sim: Sim, type: string) =>
  events.filter((e): e is T & Shot => e.type === 'groupShot' && e.group === group(sim, type).id);
const until = (sim: Sim, type: string, phase: SortiePhase) => {
  for (let i = 0; group(sim, type).phase !== phase; i++) {
    if (i > 1e5) throw new Error(`${type} never reached ${phase}`);
    step(sim);
  }
};

describe('таргетинг по тегам', () => {
  const targetTags = (type: string) => {
    const sim = createSim(mission(), content(), 1, [entry(type)]);
    const hit = shots(play(sim, 30), sim, type).map((s) => sim.state.enemies.find((e) => e.id === s.enemy)!.type);
    expect(hit.length).toBeGreaterThan(0);
    return new Set(hit);
  };

  test('F-16 бьёт только air и не атакует ground', () => {
    expect(targetTags('f16')).toEqual(new Set(['air']));
  });

  test('A-10 бьёт только ground и не атакует air', () => {
    expect(targetTags('a10')).toEqual(new Set(['ground']));
  });

  test('без подходящих целей группа не стреляет и не тратит боекомплект', () => {
    const sim = createSim(mission(['ground']), content(), 1, [entry('f16')]);
    expect(shots(play(sim, 30), sim, 'f16')).toEqual([]);
    expect(group(sim, 'f16').ammo).toBe(GROUPS.f16!.ammo);
    expect(group(sim, 'f16').lastShot).toBeUndefined();
  });

  test('lastShot хранит цель и тик последнего выстрела группы', () => {
    const sim = createSim(mission(['air']), content(), 1, [entry('f16')]);
    const ev = shots(play(sim, 20), sim, 'f16');
    expect(ev.length).toBeGreaterThan(1);
    const g = group(sim, 'f16');
    expect(g.lastShot).toEqual({ enemy: ev.at(-1)!.enemy, tick: expect.any(Number) });
    expect(g.lastShot!.tick).toBeLessThan(sim.state.tick);
  });
});

describe('аура Growler', () => {
  const growler = GROUPS.growler!;
  const slow = growler.auras.find((m) => m.side === 'enemy' && m.stat === 'speed')!.value;
  const boost = growler.auras.find((m) => m.side !== 'enemy' && m.stat === 'damage')!.value;
  const base = GROUPS.f16!.weapons[0]!.damage;

  test('в зоне патруля враги медленнее; вне зоны и вне фазы патруля — нет', () => {
    const sim = createSim(mission(['air']), content(), 1, [entry('growler')]);
    step(sim);
    const e = sim.state.enemies[0]!;
    // Зона уже накрывает врага, но Growler ещё на взлёте.
    expect(group(sim, 'growler').phase).toBe('takeoff');
    expect(enemySpeed(sim, e)).toBe(e.speed);
    until(sim, 'growler', 'patrol');
    expect(enemySpeed(sim, e)).toBeCloseTo(e.speed * slow);
    const before = e.dist;
    step(sim);
    expect(e.dist - before).toBeCloseTo(e.speed * slow * DT);
    // Улетел на возврат — эффект пропал.
    until(sim, 'growler', 'return');
    expect(enemySpeed(sim, e)).toBe(e.speed);

    const far = createSim(mission(['air']), content(), 1, [entry('growler', FAR)]);
    until(far, 'growler', 'patrol');
    expect(enemySpeed(far, far.state.enemies[0]!)).toBe(far.state.enemies[0]!.speed);
  });

  test('strike-группы в зоне сильнее, только пока Growler патрулирует', () => {
    const sim = createSim(mission(['air']), content(), 1, [entry('f16'), entry('growler')]);
    const ev = shots(play(sim, 90), sim, 'f16');
    const boosted = ev.filter((s) => s.phases.growler === 'patrol');
    const plain = ev.filter((s) => s.phases.growler !== 'patrol');
    expect(boosted.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    for (const s of boosted) expect(s.damage).toBeCloseTo(base * boost);
    for (const s of plain) expect(s.damage).toBe(base);
  });

  test('вне зоны Growler и без тега strike усиления нет', () => {
    const apart = createSim(mission(['air']), content(), 1, [entry('f16'), entry('growler', FAR)]);
    const ev = shots(play(apart, 60), apart, 'f16');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((s) => s.damage === base)).toBe(true);

    const plainJet: AirGroupConfig = { ...GROUPS.f16!, id: 'jet', tags: ['air'] };
    const sim = createSim(mission(['air']), content([plainJet]), 1, [entry('jet'), entry('growler')]);
    const jet = shots(play(sim, 60), sim, 'jet');
    expect(jet.length).toBeGreaterThan(0);
    expect(jet.every((s) => s.damage === base)).toBe(true);
  });
});

describe('C-130', () => {
  const income = (level: number) => groupStats({ content: CONTENT }, { type: 'c130', level }).income;
  const flySorties = (lineup: LineupEntry[], n: number) => {
    const sim = createSim(mission([]), content(), 1, lineup);
    const g = sim.state.groups[0]!;
    const events: SimEvent[] = [];
    for (let i = 0; g.sorties < n; i++) {
      if (i > 1e5) throw new Error('sorties not finished');
      step(sim);
      events.push(...sim.state.events);
    }
    return { sim, events };
  };

  test('каждый завершённый вылет увеличивает награду миссии', () => {
    expect(income(0)).toBeGreaterThan(0);
    const { sim, events } = flySorties([entry('c130')], 3);
    expect(sim.state.money).toBe(3 * income(0));
    expect(events.filter((e) => e.type === 'income')).toEqual([1, 2, 3].map(() => ({ type: 'income', group: sim.state.groups[0]!.id, amount: income(0) })));
    // Бонус приходит ровно на событии завершения вылета, не раньше.
    const done = events.filter((e) => e.type === 'sortieDone' || e.type === 'income').map((e) => e.type);
    expect(done).toEqual(['sortieDone', 'income', 'sortieDone', 'income', 'sortieDone', 'income']);
  });

  test('улучшение повышает бонус; группы без income награду за вылет не дают', () => {
    expect(income(1)).toBeGreaterThan(income(0));
    expect(flySorties([entry('c130', NEAR, 1)], 2).sim.state.money).toBe(2 * income(1));
    const f16 = flySorties([entry('f16')], 2);
    expect(f16.sim.state.money).toBe(0);
    expect(f16.events.some((e) => e.type === 'income')).toBe(false);
  });
});

describe('новые ауры одними данными', () => {
  /** Условный ДРЛО: +радиус зоны союзников в своей зоне. */
  const awacs: AirGroupConfig = {
    ...GROUPS.growler!,
    id: 'awacs',
    name: 'ДРЛО',
    speed: 6,
    fuel: 300,
    zoneRadius: 4,
    auras: [{ stat: 'range', op: 'add', value: 1.5, scope: 'aura' }],
    upgrades: [],
  };
  /** Условный заправщик: +время патруля союзников (запас топлива) в своей зоне. */
  const tanker: AirGroupConfig = {
    ...awacs,
    id: 'tanker',
    name: 'Заправщик',
    auras: [{ stat: 'fuel', op: 'add', value: 20, scope: 'aura' }],
  };
  const fighter: AirGroupConfig = { ...GROUPS.f16!, id: 'fighter', zoneRadius: 3, fuel: 30, ammo: 1000, upgrades: [] };
  /** Центр зоны в 4 клетках от мишени: базовый радиус 3 не достаёт, с ДРЛО (4,5) — достаёт. */
  const EDGE = { x: 4, y: 5 };

  test('ДРЛО: союзник в его зоне получает больший радиус и достаёт цель за базовым радиусом', () => {
    const alone = createSim(mission(['air']), content([fighter]), 1, [entry('fighter', EDGE)]);
    expect(shots(play(alone, 20), alone, 'fighter')).toEqual([]);

    const sim = createSim(mission(['air']), content([fighter, awacs]), 1, [entry('fighter', EDGE), entry('awacs', EDGE)]);
    until(sim, 'fighter', 'patrol');
    expect(group(sim, 'awacs').phase).toBe('patrol');
    expect(effectiveGroupStats(sim, group(sim, 'fighter')).zoneRadius).toBe(fighter.zoneRadius + 1.5);
    // Сам ДРЛО свою ауру не получает.
    expect(effectiveGroupStats(sim, group(sim, 'awacs')).zoneRadius).toBe(awacs.zoneRadius);
    expect(shots(play(sim, 10), sim, 'fighter').length).toBeGreaterThan(0);
  });

  test('заправщик: союзник в его зоне патрулирует дольше', () => {
    const patrolTicks = (lineup: LineupEntry[], extra: AirGroupConfig[]) => {
      const sim = createSim(mission([]), content(extra), 1, lineup);
      until(sim, 'fighter', 'patrol');
      const from = sim.state.tick;
      until(sim, 'fighter', 'return');
      return sim.state.tick - from;
    };
    const alone = patrolTicks([entry('fighter')], [fighter]);
    const refuelled = patrolTicks([entry('fighter'), entry('tanker')], [fighter, tanker]);
    // Бак 30 с + 20 с от заправщика: патруль длиннее минимум на половину от 20 с.
    expect(refuelled - alone).toBeGreaterThan(10 * TICK_RATE);
    expect(refuelled - alone).toBeLessThanOrEqual(Math.ceil(20 * TICK_RATE * (1 + 20 / 30)));
  });
});

describe('контент = данные', () => {
  test('четыре группы с разными ролями описаны как AirGroupConfig в реестре', () => {
    expect(Object.keys(GROUPS).sort()).toEqual(['a10', 'c130', 'f16', 'growler']);
    expect(new Set(Object.values(GROUPS).map((g) => g.role)).size).toBe(4);
    for (const [id, g] of Object.entries(GROUPS)) expect(g.id).toBe(id);
  });

  test('движок не ветвится по id групп и врагов', () => {
    const ids = [...Object.keys(CONTENT.groups), ...Object.keys(CONTENT.enemies)];
    const src = readdirSync('src/sim')
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => readFileSync(`src/sim/${f}`, 'utf8'))
      .join('\n');
    for (const id of ids) expect(src).not.toMatch(new RegExp(`['"\`]${id}['"\`]`));
  });
});
