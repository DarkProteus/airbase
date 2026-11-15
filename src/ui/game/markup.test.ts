import { describe, expect, test } from 'vitest';
import { CONTENT, GROUPS, MISSIONS } from '../../content';
import { createSim, damageEnemy, snapshot, step, TICK_RATE } from '../../sim';
import type { LineupEntry, MissionConfig, Sim } from '../../sim';
import { ATTACK_LINGER_TICKS, attackLinks, enemyMarks, groupCanHit, groupTargetKinds, targetKind, waveWarning } from './markup';
import { groupRows, world } from './selectors';

const evac = MISSIONS.evac!;
const at = (zone: { x: number; y: number }, group: string): LineupEntry => ({ group, level: 0, zone });
const run = (sim: Sim, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(sim);
};

describe('типы целей из тегов конфига', () => {
  test('тип врага — воздух или земля по тегам', () => {
    expect(targetKind(CONTENT.enemies.drone!.tags)).toBe('air');
    expect(targetKind(CONTENT.enemies.tank!.tags)).toBe('ground');
    expect(targetKind(['light'])).toBeUndefined();
  });

  test('типы целей группы — из targetTags её оружия, пустой targetTags — любые, без оружия — пусто', () => {
    expect(groupTargetKinds(GROUPS.f16!)).toEqual(['air']);
    expect(groupTargetKinds(GROUPS.a10!)).toEqual(['ground']);
    expect(groupTargetKinds(GROUPS.growler!)).toEqual([]);
    expect(groupTargetKinds({ weapons: [{ damage: 1, fireRate: 1, targetTags: [] }] })).toEqual(['air', 'ground']);
    expect(groupTargetKinds({ weapons: [{ damage: 1, fireRate: 1, targetTags: ['air'] }, { damage: 1, fireRate: 1, targetTags: ['ground'] }] })).toEqual(['air', 'ground']);
  });

  test('кто кого может бить совпадает с правилом sim', () => {
    expect(groupCanHit(GROUPS.f16!, CONTENT.enemies.drone!.tags)).toBe(true);
    expect(groupCanHit(GROUPS.f16!, CONTENT.enemies.tank!.tags)).toBe(false);
    expect(groupCanHit(GROUPS.a10!, CONTENT.enemies.tank!.tags)).toBe(true);
    expect(groupCanHit(GROUPS.a10!, CONTENT.enemies.drone!.tags)).toBe(false);
  });
});

describe('полоски здоровья врагов', () => {
  const sim = createSim(evac, CONTENT, 1, [at({ x: 5, y: 5 }, 'f16')]);
  run(sim, 7 * TICK_RATE);

  test('доля здоровья из снапшота и конфига, падает при попаданиях', () => {
    const e = sim.state.enemies[0]!;
    expect(enemyMarks(CONTENT, snapshot(sim)).find((m) => m.id === e.id)).toMatchObject({ ratio: 1, kind: 'air', hittable: null });
    const before = sim.state.enemies.length;
    damageEnemy(sim, e.id, CONTENT.enemies.drone!.hp / 3);
    expect(sim.state.enemies).toHaveLength(before);
    expect(enemyMarks(CONTENT, snapshot(sim)).find((m) => m.id === e.id)!.ratio).toBeCloseTo(2 / 3, 6);
  });

  test('ratio ограничен 0..1 и есть метка у каждого врага', () => {
    const s = snapshot(sim);
    s.enemies = [{ ...s.enemies[0]!, id: 901 }, { ...s.enemies[0]!, id: 902 }];
    s.enemies[0]!.hp = -5;
    s.enemies[1]!.hp = 1e9;
    const marks = enemyMarks(CONTENT, s);
    expect(marks).toHaveLength(s.enemies.length);
    expect(marks[0]!.ratio).toBe(0);
    expect(marks[1]!.ratio).toBe(1);
  });

  test('при выбранной группе помечено, каких врагов она может бить', () => {
    const state = snapshot(sim);
    state.enemies.push({ id: 999, type: 'tank', wave: 0, hp: 210, speed: 1, dist: 0, pos: { x: 1, y: 1 } });
    const f16 = state.groups[0]!.id;
    const marks = enemyMarks(CONTENT, state, f16);
    expect(marks.find((m) => m.id === 999)).toMatchObject({ kind: 'ground', hittable: false });
    expect(marks.find((m) => m.id !== 999)).toMatchObject({ kind: 'air', hittable: true });
    expect(enemyMarks(CONTENT, state, 12345).every((m) => m.hittable === null)).toBe(true);
  });
});

describe('предупреждение о волне', () => {
  const lineup = [at({ x: 5, y: 5 }, 'f16'), at({ x: 6, y: 5 }, 'growler')];
  const warn = (m: MissionConfig, ticks: number) => {
    const sim = createSim(m, CONTENT, 1, lineup);
    run(sim, ticks);
    return waveWarning(world(m, CONTENT, snapshot(sim)));
  };

  test('до старта: секунды, точки входа, состав, кто может бить', () => {
    const w = warn(evac, 2 * TICK_RATE)!;
    expect(w).toMatchObject({ wave: 1, waves: 4, total: 5 });
    expect(w.seconds).toBeCloseTo(4, 6);
    expect(w.entries).toEqual([
      { spawn: 0, at: { x: 0, y: 1 }, items: [{ enemy: 'drone', name: 'Дрон', count: 5, kind: 'air', hitBy: ['F-16'] }] },
    ]);
  });

  test('волна с несколькими входами: состав по входам, воздух и земля, бить некому — пустой hitBy', () => {
    const m: MissionConfig = { ...evac, waves: evac.waves.slice(1) };
    const w = warn(m, 0)!;
    expect(w.entries.map((e) => e.spawn)).toEqual([1, 2]);
    expect(w.entries[0]!.items).toEqual([{ enemy: 'tank', name: 'Бронетехника', count: 2, kind: 'ground', hitBy: [] }]);
    expect(w.entries[1]!.at).toEqual(evac.spawns![2]);
    expect(w.entries[1]!.items[0]).toMatchObject({ enemy: 'drone', count: 5, kind: 'air' });
    expect(w.total).toBe(7);
  });

  test('одинаковые враги одного входа складываются', () => {
    const m: MissionConfig = {
      ...evac,
      waves: [{ prep: 5, groups: [{ enemy: 'drone', count: 2, interval: 1 }, { enemy: 'drone', count: 3, interval: 1, delay: 4 }] }],
    };
    expect(warn(m, 0)!.entries[0]!.items).toEqual([expect.objectContaining({ enemy: 'drone', count: 5 })]);
  });

  test('миссия с путём: вход — начало пути', () => {
    const m: MissionConfig = { ...evac, objective: undefined, spawns: undefined, path: [{ x: 0, y: 3 }, { x: 8, y: 3 }] };
    expect(warn(m, 0)!.entries[0]!.at).toEqual({ x: 0, y: 3 });
  });

  test('во время волны с таймерной следующей предупреждения нет; с правилом clear — «после зачистки»', () => {
    const wave = (start?: 'clear') => ({ ...evac, waves: [evac.waves[0]!, { ...evac.waves[1]!, start }] });
    const during = (m: MissionConfig) => warn(m, 6 * TICK_RATE + 5);
    expect(during(wave())).toBeNull();
    expect(during(wave('clear'))).toMatchObject({ wave: 2, seconds: null });
  });

  test('после последней волны и в конце матча предупреждения нет', () => {
    const m: MissionConfig = { ...evac, waves: [evac.waves[0]!] };
    expect(warn(m, 7 * TICK_RATE)).toBeNull();
    const sim = createSim(evac, CONTENT, 1, lineup);
    const s = snapshot(sim);
    s.status = 'lost';
    expect(waveWarning(world(evac, CONTENT, s))).toBeNull();
  });

  test('отсчёт идёт к нулю и совпадает с моментом старта волны', () => {
    const sim = createSim(evac, CONTENT, 1, lineup);
    let ticks = 0;
    while (sim.state.wave === 0) {
      step(sim);
      ticks++;
    }
    expect(ticks).toBe(evac.waves[0]!.prep * TICK_RATE + 1);
    // Волна пошла: идёт спавн, следующая (таймерная) ещё не отсчитывает.
    expect(waveWarning(world(evac, CONTENT, snapshot(sim)))).toBeNull();
  });
});

describe('кто кого атакует', () => {
  const sim = createSim(evac, CONTENT, 1, [at({ x: 3, y: 3 }, 'f16')]);
  run(sim, 40 * TICK_RATE);

  test('недавний выстрел по живому врагу даёт связь, потом она гаснет', () => {
    const state = snapshot(sim);
    const g = state.groups[0]!;
    const target = state.enemies[0]!;
    g.lastShot = { enemy: target.id, tick: state.tick };
    expect(attackLinks(state)).toEqual([{ group: g.id, enemy: target.id }]);
    g.lastShot = { enemy: target.id, tick: state.tick - ATTACK_LINGER_TICKS - 1 };
    expect(attackLinks(state)).toEqual([]);
    g.lastShot = { enemy: 424242, tick: state.tick };
    expect(attackLinks(state)).toEqual([]);
  });

  test('строка группы называет атакуемого врага и его тип; цвет и типы целей из конфига', () => {
    const state = snapshot(sim);
    const target = state.enemies[0]!;
    state.groups[0]!.lastShot = { enemy: target.id, tick: state.tick };
    const row = groupRows(world(evac, CONTENT, state))[0]!;
    expect(row.attack).toEqual({ enemyName: CONTENT.enemies[target.type]!.name, kind: targetKind(CONTENT.enemies[target.type]!.tags) });
    expect(row.targets).toEqual(['air']);
    expect(row.color).toBe(GROUPS.f16!.visual!.color);
    state.groups[0]!.lastShot = undefined;
    expect(groupRows(world(evac, CONTENT, state))[0]!.attack).toBeNull();
  });

  test('реальная стрельба sim порождает связь', () => {
    const real = createSim(evac, CONTENT, 1, [at({ x: 3, y: 3 }, 'f16')]);
    let seen = false;
    for (let i = 0; i < 60 * TICK_RATE && !seen; i++) {
      step(real);
      seen = attackLinks(real.state).length > 0;
    }
    expect(seen).toBe(true);
  });
});
