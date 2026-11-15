import { describe, expect, test } from 'vitest';
import { CONTENT, ENEMIES, GROUPS } from '../content';
import { ARMOR_MIN_SHARE, armoredDamage, createSim, damageEnemy, enemyDetected, step, TICK_RATE } from '.';
import type { Content, EnemyConfig, LineupEntry, MissionConfig, Sim, SimEvent, SortiePhase } from '.';

/** Свойства врагов (броня, малозаметность, носитель) — общие поля конфига; здесь они проверяются на своих мишенях. */
const base = { name: 'T', hp: 1e6, speed: 0.01, reward: 5, leakDamage: 0 };
const enemies: Record<string, EnemyConfig> = {
  plain: { ...base, id: 'plain', tags: ['air'] },
  plated: { ...base, id: 'plated', tags: ['air', 'low'], armor: 10 },
  ghost: { ...base, id: 'ghost', tags: ['air'], stealth: true },
  mother: { ...base, id: 'mother', hp: 20, tags: ['air'], spawnOnDeath: { enemy: 'child', count: 3 } },
  child: { ...base, id: 'child', hp: 5, speedVar: 0.2, tags: ['air'] },
};
const content: Content = { enemies, groups: GROUPS };

const mission = (targets: string[], objective = false): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 41, h: 11 },
  airfield: { x: 0, y: 0 },
  ...(objective
    ? { spawns: [{ x: 4, y: 5 }], objective: { type: 'defend' as const, pos: { x: 30, y: 5 }, hp: 50, duration: 600 } }
    : { path: [{ x: 0, y: 5 }, { x: 40, y: 5 }] }),
  baseLives: 99,
  waves: [{ prep: 0, groups: targets.map((enemy) => ({ enemy, count: 1, interval: 0 })) }],
});
const NEAR = { x: 2, y: 5 };
const FAR = { x: 30, y: 5 };
const entry = (group: string, zone = NEAR): LineupEntry => ({ group, level: 0, zone });
const group = (sim: Sim, type: string) => sim.state.groups.find((g) => g.type === type)!;
const play = (sim: Sim, seconds: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    step(sim);
    out.push(...sim.state.events);
  }
  return out;
};
const until = (sim: Sim, type: string, phase: SortiePhase) => {
  for (let i = 0; group(sim, type).phase !== phase; i++) {
    if (i > 1e5) throw new Error(`${type} never reached ${phase}`);
    step(sim);
  }
};
const enemyOf = (sim: Sim, type: string) => sim.state.enemies.find((e) => e.type === type)!;

describe('броня', () => {
  test('armoredDamage: попадание теряет броню, но не меньше минимальной доли; без брони — без изменений', () => {
    expect(armoredDamage(45, 10)).toBe(35);
    expect(armoredDamage(12, 10)).toBe(2);
    expect(armoredDamage(8, 10)).toBeCloseTo(8 * ARMOR_MIN_SHARE);
    expect(armoredDamage(12)).toBe(12);
    expect(armoredDamage(12, 0)).toBe(12);
  });

  test('слабое оружие почти не наносит урона бронированному, тяжёлое пробивает; статистика считает урон после брони', () => {
    const lost = (type: string, target: string) => {
      const sim = createSim(mission([target]), content, 1, [entry(type)]);
      const shots = play(sim, 30).filter((e) => e.type === 'groupShot');
      expect(shots.length).toBeGreaterThan(0);
      const e = enemyOf(sim, target);
      const tally = sim.state.stats.groups[0]!;
      expect(tally.damage).toBeCloseTo(enemies[target]!.hp - e.hp);
      return { perShot: (enemies[target]!.hp - e.hp) / shots.length, nominal: (shots[0] as { damage: number }).damage };
    };
    const gunPlain = lost('f16', 'plain');
    const gunPlated = lost('f16', 'plated');
    const missile = lost('a10', 'plated');
    expect(gunPlain.perShot).toBeCloseTo(gunPlain.nominal);
    expect(gunPlated.perShot).toBeCloseTo(armoredDamage(gunPlated.nominal, 10));
    expect(gunPlated.perShot).toBeLessThan(gunPlain.perShot * 0.25);
    expect(missile.perShot).toBeCloseTo(missile.nominal - 10);
    expect(missile.perShot).toBeGreaterThan(missile.nominal * 0.7);
  });
});

describe('малозаметность', () => {
  test('без группы обнаружения малозаметного не атакуют, обычного — атакуют', () => {
    const sim = createSim(mission(['ghost', 'plain']), content, 1, [entry('f16')]);
    const shots = play(sim, 30).filter((e) => e.type === 'groupShot') as { enemy: number }[];
    expect(shots.length).toBeGreaterThan(0);
    expect(new Set(shots.map((s) => s.enemy))).toEqual(new Set([enemyOf(sim, 'plain').id]));
    expect(enemyDetected(sim, enemyOf(sim, 'ghost'))).toBe(false);
    expect(enemyDetected(sim, enemyOf(sim, 'plain'))).toBe(true);
  });

  test('ДРЛО в патруле делает малозаметного в своей зоне мишенью; вне зоны и после ухода ДРЛО — снова нет', () => {
    const sim = createSim(mission(['ghost']), content, 1, [entry('f16'), entry('e3')]);
    until(sim, 'e3', 'patrol');
    until(sim, 'f16', 'patrol');
    expect(enemyDetected(sim, enemyOf(sim, 'ghost'))).toBe(true);
    expect(play(sim, 5).some((e) => e.type === 'groupShot')).toBe(true);
    until(sim, 'e3', 'return');
    expect(enemyDetected(sim, enemyOf(sim, 'ghost'))).toBe(false);

    const apart = createSim(mission(['ghost']), content, 1, [entry('f16'), entry('e3', FAR)]);
    until(apart, 'e3', 'patrol');
    until(apart, 'f16', 'patrol');
    expect(enemyDetected(apart, enemyOf(apart, 'ghost'))).toBe(false);
    expect(play(apart, 5).some((e) => e.type === 'groupShot')).toBe(false);
  });
});

describe('носитель', () => {
  for (const objective of [false, true]) {
    test(`при гибели выпускает врагов из конфига (${objective ? 'миссия с целью' : 'миссия с путём'})`, () => {
      const sim = createSim(mission(['mother'], objective), content, 1, []);
      for (let i = 0; i < 10 && !sim.state.enemies.length; i++) step(sim);
      const mother = enemyOf(sim, 'mother');
      const at = { ...mother.pos };
      sim.state.events = [];
      expect(damageEnemy(sim, mother.id, 1e3)).toBe(true);
      const kids = sim.state.enemies;
      expect(kids.map((e) => e.type)).toEqual(['child', 'child', 'child']);
      expect(new Set(kids.map((e) => e.id)).size).toBe(3);
      for (const k of kids) {
        expect(k.wave).toBe(mother.wave);
        expect(k.hp).toBe(enemies['child']!.hp);
        expect(Math.hypot(k.pos.x - at.x, k.pos.y - at.y)).toBeLessThan(1.5);
      }
      expect(sim.state.events.filter((e) => e.type === 'spawn')).toEqual(kids.map((k) => ({ type: 'spawn', enemy: k.id, from: mother.id })));
      const wave = sim.state.stats.waves[0]!;
      expect(wave).toMatchObject({ spawned: 4, killed: 1, leaked: 0 });
      // Матч не выигран, пока выпущенные враги живы; они идут дальше как обычные.
      step(sim);
      expect(sim.state.status).toBe('running');
      for (const k of [...kids]) damageEnemy(sim, k.id, 1e3);
      expect(sim.state.stats.waves[0]).toMatchObject({ spawned: 4, killed: 4 });
    });
  }
});

describe('детерминизм и данные', () => {
  const run = (seed: number) => {
    const m: MissionConfig = {
      ...mission([]),
      waves: [{ prep: 0, groups: ['carrier', 'ghost', 'gunship'].map((enemy) => ({ enemy, count: 2, interval: 1, delay: 6 })) }],
    };
    const at = (x: number) => ({ x, y: 5 });
    const sim = createSim(m, CONTENT, seed, [entry('f16', at(4)), entry('f16', at(10)), entry('f16', at(16)), entry('a10', at(6)), entry('e3', at(8))]);
    const events = play(sim, 90);
    return { events, state: JSON.stringify(sim.state) };
  };

  test('один сид — один исход; настоящие враги контента гибнут, носитель выпускает дронов', () => {
    const a = run(7);
    expect(run(7)).toEqual(a);
    expect(run(8).state).not.toBe(a.state);
    const spawned = a.events.filter((e) => e.type === 'spawn');
    const born = spawned.filter((e) => 'from' in e);
    const brood = ENEMIES['carrier']!.spawnOnDeath!.count;
    expect(born.length).toBeGreaterThanOrEqual(brood);
    expect(born.length % brood).toBe(0);
    // Гибнут носитель, малозаметные под ДРЛО, вертолёты и часть выпущенных дронов.
    expect(a.events.filter((e) => e.type === 'kill').length).toBeGreaterThan(4);
  });

  test('в контенте есть враг на каждое свойство, и свойства заданы полями конфига', () => {
    const all = Object.values(ENEMIES);
    expect(all.some((e) => (e.armor ?? 0) > 0)).toBe(true);
    expect(all.some((e) => e.stealth)).toBe(true);
    const carriers = all.filter((e) => e.spawnOnDeath);
    expect(carriers.length).toBeGreaterThan(0);
    for (const c of carriers) {
      expect(ENEMIES[c.spawnOnDeath!.enemy]).toBeDefined();
      expect(c.spawnOnDeath!.count).toBeGreaterThan(0);
    }
    // Хотя бы одна группа умеет обнаруживать, и хотя бы одно оружие пробивает броню бронированного врага с его тегами.
    const groups = Object.values(GROUPS);
    expect(groups.some((g) => g.auras.some((m) => m.stat === 'detect' && m.side === 'enemy'))).toBe(true);
    for (const e of all.filter((x) => (x.armor ?? 0) > 0)) {
      const hits = groups.flatMap((g) => g.weapons).filter((w) => w.targetTags.length === 0 || w.targetTags.some((t) => e.tags.includes(t)));
      expect(hits.some((w) => armoredDamage(w.damage, e.armor) >= w.damage * 0.7)).toBe(true);
      expect(hits.some((w) => armoredDamage(w.damage, e.armor) <= w.damage * 0.25)).toBe(true);
    }
  });
});
