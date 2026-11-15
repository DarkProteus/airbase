import { describe, expect, test } from 'vitest';
import { baseTypes, createSim, inMap, moveClass, navRoute, onMapEdge, profileLineup, snapshot, step, terrainCells, terrainNav, terrainProblems, TICK_RATE, zoneRejection } from '../sim';
import type { MissionConfig, MoveClass, TerrainKind, Vec2 } from '../sim';
import { CONTENT, DEFAULT_LINEUP, DEFAULT_ZONES, ENEMIES, GROUPS, LINEUP_SIZE, MISSIONS } from '.';

test.each(Object.values(MISSIONS))('аэродром миссии $id лежит на краю карты', (m) => {
  expect(onMapEdge(m.size, m.airfield)).toBe(true);
});

const withObjective = Object.values(MISSIONS).filter((m) => m.objective);
const LIMIT = 600 * TICK_RATE;
const play = (m: MissionConfig, seed: number, lineup = DEFAULT_LINEUP) => {
  const sim = createSim(m, CONTENT, seed, lineup);
  while (sim.state.status === 'running' && sim.state.tick < LIMIT) step(sim);
  return snapshot(sim);
};

describe('миссии с целью (headless)', () => {
  test('типы целей прежние: defend и escort, каждого по две миссии и больше', () => {
    const types = withObjective.map((m) => m.objective!.type);
    expect([...new Set(types)].sort()).toEqual(['defend', 'escort']);
    for (const type of ['defend', 'escort']) expect(types.filter((t) => t === type).length).toBeGreaterThanOrEqual(2);
  });

  test.each(withObjective)('$id: точки входа, цель и маршрут лежат на карте', (m) => {
    const o = m.objective!;
    const cells = [...m.bases!.map((b) => b.pos), ...(o.type === 'escort' ? o.route : [o.pos])];
    for (const c of cells) expect(inMap(m.size, c)).toBe(true);
  });

  test.each(withObjective)('$id: прогон доходит до победы или поражения', (m) => {
    expect(['won', 'lost']).toContain(play(m, 1).status);
    // Без авиации цель не выживает: исход решают группы, а не таймер.
    expect(play(m, 1, []).status).toBe('lost');
  });

  test.each(withObjective)('$id: полный прогон детерминирован по сиду', (m) => {
    const a = play(m, 7);
    expect(play(m, 7)).toEqual(a);
    expect(play(m, 8)).not.toEqual(a);
  });
});

const NEW_IDS = ['radar', 'bastion', 'river', 'pass'];
const created = NEW_IDS.map((id) => MISSIONS[id]!);
const sameCells = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

describe('набор из шести миссий', () => {
  test('миссий шесть, у ключа реестра и id совпадение', () => {
    expect(Object.keys(MISSIONS)).toHaveLength(6);
    for (const [key, m] of Object.entries(MISSIONS)) expect(m.id).toBe(key);
    for (const m of created) expect(m, m.id).toBeDefined();
  });

  test('новые миссии отличаются размером карты, положением аэродрома и числом входов', () => {
    // Прежние миссии делят карту 13×11 и аэродром, поэтому сравниваем новые с одной из них.
    const all = [MISSIONS.evac!, ...created];
    const key = (f: (m: MissionConfig) => unknown) => new Set(all.map((m) => JSON.stringify(f(m)))).size;
    expect(key((m) => m.size)).toBe(all.length);
    expect(key((m) => m.airfield)).toBe(all.length);
    // Края карты разные: аэродромы лежат не на одном и том же краю.
    const edges = new Set(created.map((m) => (m.airfield.x === 0 ? 'left' : m.airfield.x === m.size.w - 1 ? 'right' : m.airfield.y === 0 ? 'top' : 'bottom')));
    expect(edges.size).toBeGreaterThanOrEqual(3);
    const counts = created.map((m) => m.bases!.length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(5);
    expect(new Set(counts).size).toBeGreaterThanOrEqual(3);
  });

  test('новые миссии длиннее: 6–8 волн, награда растёт с длиной и выше прежних', () => {
    for (const m of created) {
      expect(m.waves.length, m.id).toBeGreaterThanOrEqual(6);
      expect(m.waves.length, m.id).toBeLessThanOrEqual(8);
      expect(m.reward!.win, m.id).toBeGreaterThan(MISSIONS.convoy!.reward!.win);
      expect(m.reward!.loss, m.id).toBeGreaterThanOrEqual(MISSIONS.convoy!.reward!.loss);
    }
    const byLength = [...created].sort((a, b) => a.waves.length - b.waves.length || a.reward!.win - b.reward!.win);
    expect(byLength.map((m) => m.reward!.win)).toEqual(byLength.map((m) => m.reward!.win).sort((a, b) => a - b));
  });

  test('волны нарастают: чем позже волна, тем больше в ней врагов или выше суммарное здоровье', () => {
    for (const m of created) {
      const power = m.waves.map((w) => w.groups.reduce((sum, g) => sum + g.count * ENEMIES[g.enemy]!.hp, 0));
      expect(power.at(-1), m.id).toBeGreaterThan(power[0]!);
      expect(Math.max(...power), m.id).toBeGreaterThan(power[0]! * 1.5);
    }
  });

  test('каждая волна ссылается на существующих врагов и точки входа', () => {
    for (const m of Object.values(MISSIONS))
      for (const w of m.waves)
        for (const g of w.groups) {
          expect(ENEMIES[g.enemy], `${m.id}: ${g.enemy}`).toBeDefined();
          expect(g.base ?? 0, m.id).toBeLessThan(m.bases!.length);
        }
  });

  test('в новых миссиях встречаются все три механики врагов, а бомбардировщик — только в финальной волне', () => {
    const enemiesOf = (m: MissionConfig) => new Set(m.waves.flatMap((w) => w.groups.map((g) => ENEMIES[g.enemy]!)));
    const all = created.flatMap((m) => [...enemiesOf(m)]);
    expect(all.some((e) => e.armor)).toBe(true);
    expect(all.some((e) => e.stealth)).toBe(true);
    expect(all.some((e) => e.spawnOnDeath)).toBe(true);
    for (const m of created) {
      const bomberWaves = m.waves.flatMap((w, i) => (w.groups.some((g) => g.enemy === 'bomber') ? [i] : []));
      for (const i of bomberWaves) expect(i, m.id).toBe(m.waves.length - 1);
    }
  });

  test('дорога и вход не совпадают: цель, маршрут и входы не лежат друг на друге', () => {
    for (const m of created) {
      const o = m.objective!;
      const start = o.type === 'escort' ? o.route[0]! : o.pos;
      for (const s of m.bases!.map((b) => b.pos)) expect(sameCells(s, start), m.id).toBe(false);
      expect(m.bases!.some((b) => sameCells(b.pos, m.airfield)), m.id).toBe(false);
    }
  });
});

describe('вражеские базы', () => {
  const all = Object.values(MISSIONS);

  test.each(all)('$id: у каждой базы свой id, своё название и непустой список типов из реестра врагов', (m) => {
    const bases = m.bases!;
    expect(bases.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bases.map((b) => b.id)).size).toBe(bases.length);
    expect(new Set(bases.map((b) => b.name)).size).toBe(bases.length);
    for (const b of bases) {
      expect(b.name.trim(), b.id).not.toBe('');
      expect(b.roster.length, b.id).toBeGreaterThan(0);
      expect(new Set(b.roster.map((r) => r.enemy)).size, b.id).toBe(b.roster.length);
      for (const r of b.roster) {
        expect(ENEMIES[r.enemy], `${b.id}: ${r.enemy}`).toBeDefined();
        expect(r.fromWave ?? 1, b.id).toBeGreaterThanOrEqual(1);
        expect(r.fromWave ?? 1, b.id).toBeLessThanOrEqual(m.waves.length);
      }
    }
  });

  test.each(all)('$id: каждая группа волны идёт с базы, у которой её тип к этой волне уже доступен', (m) => {
    m.waves.forEach((w, i) => {
      for (const g of w.groups) expect(baseTypes(m.bases![g.base ?? 0]!, i + 1), `${m.id}, волна ${i + 1}: ${g.enemy}`).toContain(g.enemy);
    });
  });

  test.each(all)('$id: тип появляется в бою в той же волне, с которой он открыт у базы, — сигнал об улучшении не ложный', (m) => {
    m.bases!.forEach((b, base) => {
      for (const r of b.roster) {
        const wave = m.waves[(r.fromWave ?? 1) - 1]!;
        expect(wave.groups.some((g) => (g.base ?? 0) === base && g.enemy === r.enemy), `${m.id}/${b.id}: ${r.enemy}`).toBe(true);
      }
    });
  });

  test.each(all)('$id: базы растут — хотя бы одна получает новый тип после первой волны', (m) => {
    expect(m.bases!.some((b) => b.roster.some((r) => (r.fromWave ?? 1) > 1))).toBe(true);
  });

  test('конфиг с врагом не со своей базы отвергается', () => {
    const evac = MISSIONS.evac!;
    const tankBase = evac.bases!.findIndex((b) => b.roster.every((r) => r.enemy === 'tank'));
    expect(tankBase).toBeGreaterThanOrEqual(0);
    const last = evac.waves.length - 1;
    const broken: MissionConfig = { ...evac, waves: evac.waves.map((w, i) => (i === last ? { ...w, groups: [...w.groups, { enemy: 'drone', count: 1, interval: 1, base: tankBase }] } : w)) };
    expect(() => createSim(broken, CONTENT, 1)).toThrow(/does not launch drone/);
    // И слишком рано: танки с первой волны, хотя база открывает их со второй.
    const early: MissionConfig = { ...evac, waves: [{ prep: 1, groups: [{ enemy: 'tank', count: 1, interval: 1, base: tankBase }] }] };
    expect(() => createSim(early, CONTENT, 1)).toThrow(/does not launch tank in wave 1/);
  });
});

describe('стартовые зоны патруля', () => {
  const trio = ['f16', 'a10', 'growler'].slice(0, LINEUP_SIZE);
  const zonesOf = (m: MissionConfig) => m.zones ?? DEFAULT_ZONES;

  test.each(Object.values(MISSIONS))('$id: зон хватает на состав, они на карте и проходят проверку команды sim', (m) => {
    const zones = zonesOf(m);
    expect(zones.length).toBeGreaterThanOrEqual(LINEUP_SIZE);
    const sim = createSim(m, CONTENT, 1, profileLineup({ currency: 0, levels: { f16: 0, a10: 0, growler: 0 }, lineup: trio }, zones));
    for (const g of sim.state.groups) {
      expect(inMap(m.size, g.zone), `${m.id}: ${g.type}`).toBe(true);
      expect(zoneRejection(sim, g.id, g.zone), `${m.id}: ${g.type}`).toBeUndefined();
    }
  });

  test.each(Object.values(MISSIONS))('$id: зоны попарно различны, не ближе клетки друг к другу', (m) => {
    const zones = zonesOf(m).slice(0, LINEUP_SIZE);
    for (const [i, a] of zones.entries())
      for (const b of zones.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y), m.id).toBeGreaterThanOrEqual(1);
  });

  test.each(created)('$id: зоны заданы данными миссии и лежат рядом с целью (в радиусе зоны F-16 вокруг объекта или головы колонны + 4)', (m) => {
    expect(m.zones).toBeDefined();
    const o = m.objective!;
    const focus = o.type === 'escort' ? o.route[0]! : o.pos;
    const reach = GROUPS.f16!.zoneRadius + 4;
    for (const z of m.zones!) expect(Math.hypot(z.x - focus.x, z.y - focus.y), m.id).toBeLessThanOrEqual(reach);
  });

  test('наборы зон у новых миссий различны между собой и не совпадают с общими', () => {
    const sets = created.map((m) => JSON.stringify(m.zones));
    expect(new Set(sets).size).toBe(created.length);
    expect(sets).not.toContain(JSON.stringify(DEFAULT_ZONES));
  });

  test.each(created)('$id: зоны не стоят на клетке аэродрома и входа', (m) => {
    for (const z of m.zones!) {
      expect(sameCells(z, m.airfield), m.id).toBe(false);
      for (const s of m.bases!.map((b) => b.pos)) expect(sameCells(z, s), m.id).toBe(false);
    }
  });
});

describe('рельеф-преграда', () => {
  const all = Object.values(MISSIONS);
  const withTerrain = all.filter((m) => terrainCells(m).length);
  /** Точки, к которым идут враги: объект или вершины маршрута колонны. */
  const targets = (m: MissionConfig): Vec2[] => (m.objective!.type === 'escort' ? m.objective!.route : [m.objective!.pos]);
  /** Классы движения врагов базы — по тегам из конфигов. */
  const classes = (m: MissionConfig, base: number): MoveClass[] => [...new Set(m.bases![base]!.roster.map((r) => moveClass(ENEMIES[r.enemy]!.tags)))];
  const angle = (a: Vec2, b: Vec2) => {
    const d = Math.abs(Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    return (Math.min(d, 2 * Math.PI - d) * 180) / Math.PI;
  };
  /** Наибольший разворот подхода: угол между прямой «база → цель» и последним отрезком маршрута в обход преград. */
  const bend = (m: MissionConfig): number =>
    Math.max(
      0,
      ...m.bases!.flatMap((b, i) =>
        classes(m, i).flatMap((cls) =>
          targets(m).map((t) => {
            const route = navRoute(terrainNav(m), cls, b.pos, t);
            const from = route.at(-2)!;
            return route.length > 2 ? angle({ x: from.x - t.x, y: from.y - t.y }, { x: b.pos.x - t.x, y: b.pos.y - t.y }) : 0;
          }),
        ),
      ),
    );

  test.each(all)('$id: рельеф не отрезает базы и маршрут от цели', (m) => {
    expect(terrainProblems(m, CONTENT)).toEqual([]);
  });

  test('миссия, где преграды отрезают базу врага от цели, отвергается', () => {
    const bastion = MISSIONS.bastion!;
    const o = bastion.objective!;
    const at = o.type === 'defend' ? o.pos : o.route[0]!;
    // Сплошное кольцо хребта вокруг объекта: ни наземным, ни воздушным не пройти.
    const ring = (ch: string) => bastion.terrain!.map((row, y) => [...row].map((c, x) => (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) === 2 ? ch : c)).join(''));
    const sealed: MissionConfig = { ...bastion, terrain: ring('#') };
    const flaws = terrainProblems(sealed, CONTENT);
    expect(flaws.length).toBe(bastion.bases!.reduce((n, _, i) => n + classes(bastion, i).length, 0));
    for (const f of flaws) expect(f).toMatch(/is cut off from the objective/);
    expect(() => createSim(sealed, CONTENT, 1)).toThrow(/bad terrain/);
    // Кольцо гор отрезает только наземных: воздушные базы остаются в порядке.
    const ground = terrainProblems({ ...bastion, terrain: ring('^') }, CONTENT);
    expect(ground.length).toBeGreaterThan(0);
    for (const f of ground) expect(f).toMatch(/for ground enemies/);
  });

  test('миссия, где преграда перекрывает маршрут колонны, отвергается', () => {
    const river = MISSIONS.river!;
    const o = river.objective!;
    const mid = o.type === 'escort' ? o.route[Math.floor(o.route.length / 2)]! : o.pos;
    const cut: MissionConfig = { ...river, terrain: river.terrain!.map((row, y) => (y === mid.y ? row.slice(0, mid.x) + '~' + row.slice(mid.x + 1) : row)) };
    expect(terrainProblems(cut, CONTENT).some((f) => /route crosses water/.test(f))).toBe(true);
    expect(() => createSim(cut, CONTENT, 1)).toThrow(/bad terrain/);
  });

  test('рельеф есть минимум в трёх миссиях, и в каждой он уводит хотя бы один маршрут с прямой', () => {
    expect(withTerrain.length).toBeGreaterThanOrEqual(3);
    for (const m of withTerrain) expect(bend(m), m.id).toBeGreaterThan(0);
  });

  test('минимум в трёх миссиях проход меняет выгодное место зоны: враги подходят к цели с другой стороны (разворот от 20°)', () => {
    const turned = withTerrain.filter((m) => bend(m) >= 20);
    expect(turned.length, turned.map((m) => m.id).join()).toBeGreaterThanOrEqual(3);
  });

  test('встречаются все виды преград, и у воздушных врагов есть свои — хребты', () => {
    const kinds = new Set<TerrainKind>(withTerrain.flatMap((m) => terrainCells(m).map((c) => c.kind)));
    expect([...kinds].sort()).toEqual(['mountain', 'ridge', 'water']);
    // Миссия только с воздушными врагами получает хребты, иначе рельеф в ней ничего не решает.
    for (const m of withTerrain) {
      const air = m.bases!.every((_, i) => classes(m, i).every((c) => c === 'air'));
      if (air) expect(terrainCells(m).every((c) => c.kind === 'ridge'), m.id).toBe(true);
    }
  });

  test.each(withTerrain)('$id: клетки вокруг аэродрома и клетки баз свободны от преград', (m) => {
    const cells = terrainCells(m);
    const near = (p: Vec2, r: number) => cells.some((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= r);
    expect(near(m.airfield, 1)).toBe(false);
    for (const b of m.bases!) expect(near(b.pos, 0), b.id).toBe(false);
  });
});
