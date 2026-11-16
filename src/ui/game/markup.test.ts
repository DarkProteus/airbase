import { describe, expect, test } from 'vitest';
import { CONTENT, GROUPS, MISSIONS } from '../../content';
import { createSim, damageEnemy, moveClass, navRoute, snapshot, step, TERRAIN_BLOCKS, terrainCells, terrainNav, TICK_RATE } from '../../sim';
import type { LineupEntry, MissionConfig, Sim } from '../../sim';
import { ATTACK_LINGER_TICKS, attackLinks, baseMarks, baseUpgradeNotice, enemyMarks, groupCanHit, groupTargetKinds, PATH_ENTRY_NAME, targetKind, TERRAIN_LABEL, terrainLegend, warningRoutes, waveWarning } from './markup';
import { groupRows, world } from './selectors';

const evac = MISSIONS.evac!;
/** Та же миссия, но базы выпускают любых врагов с первой волны — для тестовых волн не по расписанию. */
const open = (m: MissionConfig): MissionConfig => ({ ...m, bases: m.bases?.map((b) => ({ ...b, roster: [] })) });
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
    expect(w).toMatchObject({ wave: 1, waves: 4, total: 4 });
    expect(w.seconds).toBeCloseTo(4, 6);
    expect(w.entries).toEqual([
      { base: 0, name: evac.bases![0]!.name, at: { x: 0, y: 1 }, items: [{ enemy: 'drone', name: 'Дрон', count: 4, kind: 'air', hitBy: ['F-16'], fresh: false }] },
    ]);
  });

  test('волна с несколькими входами: состав по входам, воздух и земля, бить некому — пустой hitBy', () => {
    const m: MissionConfig = { ...open(evac), waves: evac.waves.slice(1) };
    const w = warn(m, 0)!;
    expect(w.entries.map((e) => e.base)).toEqual([1, 2]);
    expect(w.entries.map((e) => e.name)).toEqual([evac.bases![1]!.name, evac.bases![2]!.name]);
    expect(w.entries[0]!.items).toEqual([{ enemy: 'tank', name: 'Бронетехника', count: 2, kind: 'ground', hitBy: [], fresh: false }]);
    expect(w.entries[1]!.at).toEqual(evac.bases![2]!.pos);
    expect(w.entries[1]!.items[0]).toMatchObject({ enemy: 'drone', count: 4, kind: 'air' });
    expect(w.total).toBe(6);
  });

  test('одинаковые враги одного входа складываются', () => {
    const m: MissionConfig = {
      ...evac,
      waves: [{ prep: 5, groups: [{ enemy: 'drone', count: 2, interval: 1 }, { enemy: 'drone', count: 3, interval: 1, delay: 4 }] }],
    };
    expect(warn(m, 0)!.entries[0]!.items).toEqual([expect.objectContaining({ enemy: 'drone', count: 5 })]);
  });

  test('миссия с путём: вход — начало пути', () => {
    const m: MissionConfig = { ...evac, objective: undefined, bases: undefined, path: [{ x: 0, y: 3 }, { x: 8, y: 3 }] };
    expect(warn(m, 0)!.entries[0]).toMatchObject({ at: { x: 0, y: 3 }, name: PATH_ENTRY_NAME });
    expect(baseMarks(m, createSim(m, CONTENT, 1).state)).toEqual([]);
  });

  test('тип, который база выпускает впервые с этой волны, помечен как новый', () => {
    const m: MissionConfig = { ...evac, waves: [evac.waves[0]!, { ...evac.waves[1]!, start: 'clear' }, evac.waves[2]!] };
    const w = warn(m, 6 * TICK_RATE + 5)!;
    expect(w.wave).toBe(2);
    // Со второй волны танковая база открывает бронетехнику, полевой лагерь — дроны.
    expect(w.entries.map((e) => e.items.map((i) => [i.enemy, i.fresh]))).toEqual([[['tank', true]], [['drone', true]]]);
    // Первая волна — исходный набор баз, новых типов в ней нет.
    expect(warn(evac, 0)!.entries.every((e) => e.items.every((i) => !i.fresh))).toBe(true);
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

describe('малозаметные враги в разметке', () => {
  const ghostWave: MissionConfig = { ...open(evac), waves: [{ prep: 2, groups: [{ enemy: 'ghost', count: 1, interval: 0, base: 0 }] }] };

  test('предупреждение: без группы обнаружения в составе малозаметного бить некому, с ДРЛО — есть кому', () => {
    const zone = evac.bases![0]!.pos;
    const blind = createSim(ghostWave, CONTENT, 1, [at(zone, 'f16'), at(zone, 'a10')]);
    expect(waveWarning(world(ghostWave, CONTENT, blind.state))!.entries[0]!.items[0]!.hitBy).toEqual([]);
    const seeing = createSim(ghostWave, CONTENT, 1, [at(zone, 'f16'), at(zone, 'e3')]);
    expect(waveWarning(world(ghostWave, CONTENT, seeing.state))!.entries[0]!.items[0]!.hitBy).toEqual([GROUPS.f16!.name]);
  });

  test('метка врага: hidden, пока малозаметный вне зоны патрулирующего ДРЛО', () => {
    const zone = evac.bases![0]!.pos;
    const sim = createSim(ghostWave, CONTENT, 1, [at(zone, 'f16'), at(zone, 'e3')]);
    while (!sim.state.enemies.length) step(sim);
    const hidden = () => enemyMarks(CONTENT, sim.state)[0]!.hidden;
    const awacs = sim.state.groups.find((g) => g.type === 'e3')!;
    expect(awacs.phase).not.toBe('patrol');
    expect(hidden()).toBe(true);
    for (let i = 0; i < 3000 && awacs.phase !== 'patrol' && sim.state.enemies.length; i++) step(sim);
    if (sim.state.enemies.length && awacs.phase === 'patrol') {
      const e = sim.state.enemies[0]!;
      const inZone = Math.hypot(e.pos.x - awacs.zone.x, e.pos.y - awacs.zone.y) <= 3.5;
      expect(hidden()).toBe(!inZone);
    }
  });
});

describe('вражеские базы в разметке', () => {
  test('метки баз: позиция, название и типы, доступные к ближайшей волне', () => {
    const state = createSim(evac, CONTENT, 1).state;
    const types = (wave: number, phase: typeof state.phase) => baseMarks(evac, { ...state, wave, phase }).map((b) => b.types);
    expect(baseMarks(evac, state).map((b) => [b.name, b.at])).toEqual(evac.bases!.map((b) => [b.name, b.pos]));
    // Подготовка к первой волне и сама первая волна: только исходный набор.
    expect(types(0, 'prep')).toEqual([['drone'], [], []]);
    expect(types(1, 'wave')).toEqual([['drone'], [], []]);
    // В подготовке показан состав следующей волны.
    expect(types(1, 'prep')).toEqual([['drone'], ['tank'], ['drone']]);
    expect(types(4, 'wave')).toEqual([['drone', 'runner'], ['tank'], ['drone', 'runner']]);
  });

  test('сообщение об улучшении базы называет базу и новый тип врага', () => {
    expect(baseUpgradeNotice(evac, CONTENT, [{ type: 'waveStart', wave: 1 }])).toBeUndefined();
    expect(baseUpgradeNotice(evac, CONTENT, [{ type: 'baseUpgrade', base: 1, enemy: 'tank' }, { type: 'baseUpgrade', base: 2, enemy: 'drone' }])).toBe(
      `${evac.bases![1]!.name}: новый тип — ${CONTENT.enemies.tank!.name} · ${evac.bases![2]!.name}: новый тип — ${CONTENT.enemies.drone!.name}`,
    );
  });
});

describe('рельеф на карте: маршруты волны и легенда', () => {
  const routesAtStart = (m: MissionConfig) => warningRoutes(world(m, CONTENT, snapshot(createSim(m, CONTENT, 1, [at({ x: 0, y: 0 }, 'f16')]))));

  test('маршруты ближайшей волны — по одному на базу и класс движения, от базы до цели', () => {
    const routes = routesAtStart(evac);
    const first = evac.waves[0]!.groups;
    const expected = new Set(first.map((g) => `${g.base}:${moveClass(CONTENT.enemies[g.enemy]!.tags)}`));
    expect(new Set(routes.map((r) => `${r.base}:${r.kind}`))).toEqual(expected);
    const goal = evac.objective!.type === 'defend' ? evac.objective!.pos : undefined;
    for (const r of routes) {
      expect(r.points[0]).toEqual(evac.bases![r.base]!.pos);
      expect(r.points.at(-1)).toEqual(goal);
    }
  });

  test('маршрут — та же навигация, что ведёт врагов в sim: совпадает с navRoute и не заходит на закрытые клетки', () => {
    for (const m of Object.values(MISSIONS)) {
      const nav = terrainNav(m);
      const closed = new Set(terrainCells(m).map((c) => `${c.x},${c.y},${c.kind}`));
      for (const r of routesAtStart(m)) {
        expect(r.points, m.id).toEqual(navRoute(nav, r.kind, m.bases![r.base]!.pos, r.points.at(-1)!));
        for (const p of r.points.slice(1, -1))
          for (const kind of Object.keys(TERRAIN_BLOCKS) as (keyof typeof TERRAIN_BLOCKS)[])
            if (TERRAIN_BLOCKS[kind].includes(r.kind)) expect(closed.has(`${Math.round(p.x)},${Math.round(p.y)},${kind}`), `${m.id} ${p.x},${p.y}`).toBe(false);
      }
    }
  });

  test('хотя бы в одной миссии маршрут первой волны — ломаная в обход преграды', () => {
    expect(Object.values(MISSIONS).some((m) => routesAtStart(m).some((r) => r.points.length > 2))).toBe(true);
  });

  test('пока предупреждения о волне нет, маршруты не показываются', () => {
    const sim = createSim(evac, CONTENT, 1, [at({ x: 0, y: 0 }, 'f16')]);
    run(sim, (evac.waves[0]!.prep + 1) * TICK_RATE);
    expect(waveWarning(world(evac, CONTENT, snapshot(sim)))).toBeNull();
    expect(warningRoutes(world(evac, CONTENT, snapshot(sim)))).toEqual([]);
  });

  test('легенда перечисляет только виды преград с карты миссии, а кому закрыт путь — из таблицы sim', () => {
    for (const m of Object.values(MISSIONS)) {
      const present = new Set(terrainCells(m).map((c) => c.kind));
      const legend = terrainLegend(m);
      expect(new Set(legend.map((n) => n.kind)), m.id).toEqual(present);
      for (const n of legend) {
        expect(n.name).toBe(TERRAIN_LABEL[n.kind]);
        expect(n.text.includes('наземным') || n.text.includes('никому')).toBe(TERRAIN_BLOCKS[n.kind].includes('ground'));
        expect(n.text.includes('воздушным') || n.text.includes('никому')).toBe(TERRAIN_BLOCKS[n.kind].includes('air'));
      }
    }
    expect(terrainLegend({ ...evac, terrain: undefined })).toEqual([]);
  });
});
