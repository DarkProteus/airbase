import { describe, expect, test } from 'vitest';
import { GROUPS } from '../content';
import { botZone, createSim, moveClass, navCell, navRoute, snapshot, step, terrainCells, terrainNav, terrainProblems, TICK_RATE } from '.';
import type { Content, EnemyConfig, EnemyState, MissionConfig, ObjectiveConfig, Sim, Vec2 } from '.';

const base = { name: 'T', hp: 1e6, reward: 0, leakDamage: 1 };
const enemies: Record<string, EnemyConfig> = {
  tank: { ...base, id: 'tank', speed: 1, tags: ['ground'] },
  drone: { ...base, id: 'drone', speed: 2, tags: ['air'] },
};
const content: Content = { enemies, groups: GROUPS };

/** Стена поперёк карты между базой (слева) и объектом (справа): проходы только у верхнего и нижнего края. */
const wall = (ch: string) => ['.........', `...${ch}.....`, `...${ch}.....`, `...${ch}.....`, `...${ch}.....`, `...${ch}.....`, '.........'];
const HQ: ObjectiveConfig = { type: 'defend', pos: { x: 7, y: 3 }, hp: 100, duration: 600 };

const mission = (terrain: string[] | undefined, enemy: string, objective: ObjectiveConfig = HQ, at: Vec2 = { x: 0, y: 3 }): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 9, h: 7 },
  airfield: { x: 8, y: 0 },
  objective,
  bases: [{ id: 'b', name: 'B', pos: at, roster: [] }],
  baseLives: 1,
  waves: [{ prep: 0, groups: [{ enemy, count: 1, interval: 1 }] }],
  ...(terrain ? { terrain } : {}),
});

/** Прогон до первого прорыва: след врага по тикам и тик прорыва. */
function trace(m: MissionConfig, seconds = 60): { track: Vec2[]; leak: number | undefined; sim: Sim } {
  const sim = createSim(m, content, 1);
  const track: Vec2[] = [];
  let leak: number | undefined;
  for (let i = 0; i < seconds * TICK_RATE && leak === undefined; i++) {
    step(sim);
    const e = sim.state.enemies[0];
    if (e) track.push({ ...e.pos });
    if (sim.state.events.some((ev) => ev.type === 'leak')) leak = sim.state.tick;
  }
  return { track, leak, sim };
}

const kindAt = (m: MissionConfig, p: Vec2) => terrainCells(m).find((c) => c.x === Math.round(p.x) && c.y === Math.round(p.y))?.kind;

describe('рельеф — данные миссии', () => {
  test('карта разбирается по символам; миссия без преград навигации не строит', () => {
    const m = mission(['.........', '.~.......', '..^......', '...#.....', '.........', '.........', '.........'], 'tank');
    expect(terrainCells(m)).toEqual([
      { x: 1, y: 1, kind: 'water' },
      { x: 2, y: 2, kind: 'mountain' },
      { x: 3, y: 3, kind: 'ridge' },
    ]);
    const nav = terrainNav(m)!;
    expect([...nav.blocked.ground].filter(Boolean)).toHaveLength(3);
    expect([...nav.blocked.air].filter(Boolean)).toHaveLength(1);
    expect(terrainNav(mission(undefined, 'tank'))).toBeUndefined();
    expect(terrainNav(mission(wall('.'), 'tank'))).toBeUndefined();
  });

  test('неверный размер и неизвестный символ отвергаются', () => {
    expect(() => terrainCells(mission(['...'], 'tank'))).toThrow(/rows/);
    expect(() => terrainCells(mission(wall('^').map((r, i) => (i ? r : r + '.')), 'tank'))).toThrow(/cells/);
    expect(() => terrainCells(mission(wall('X'), 'tank'))).toThrow(/unknown terrain/);
    expect(() => createSim(mission(wall('X'), 'tank'), content, 1)).toThrow(/bad terrain/);
  });

  test('класс движения — из тегов конфига', () => {
    expect(moveClass(['ground', 'armored'])).toBe('ground');
    expect(moveClass(['air', 'low'])).toBe('air');
  });
});

describe('враги обходят преграды', () => {
  test.each(['^', '~', '#'])('наземный враг обходит «%s» и доходит до цели', (ch) => {
    const m = mission(wall(ch), 'tank');
    const { track, leak } = trace(m);
    expect(leak).toBeDefined();
    for (const p of track) expect(kindAt(m, p)).toBeUndefined();
    // Обход длиннее прямой: 7 клеток по прямой, в обход стены — заметно больше.
    const straight = trace(mission(undefined, 'tank')).leak!;
    expect(leak!).toBeGreaterThan(straight * 1.15);
    // Проход — у края карты: враг уходит от оси база–цель.
    expect(Math.max(...track.map((p) => Math.abs(p.y - 3)))).toBeGreaterThan(2);
  });

  test.each(['^', '~'])('воздушный враг летит над «%s» прямо', (ch) => {
    const over = trace(mission(wall(ch), 'drone'));
    const open = trace(mission(undefined, 'drone'));
    expect(over.leak).toBe(open.leak);
    expect(over.track).toEqual(open.track);
  });

  test('воздушный враг обходит высокий хребет', () => {
    const m = mission(wall('#'), 'drone');
    const { track, leak } = trace(m);
    expect(leak).toBeGreaterThan(trace(mission(undefined, 'drone')).leak!);
    for (const p of track) expect(kindAt(m, p)).toBeUndefined();
  });

  test('без преграды на пути враг идёт по прямой, как без рельефа', () => {
    const terrain = ['.........', '.........', '.........', '.........', '.........', '.^.....^.', '.........'];
    expect(trace(mission(terrain, 'tank')).track).toEqual(trace(mission(undefined, 'tank')).track);
  });

  test('путь детерминирован: тот же сид — тот же след и то же состояние', () => {
    const a = trace(mission(wall('^'), 'tank'), 2);
    const b = trace(mission(wall('^'), 'tank'), 2);
    expect(a.track).toEqual(b.track);
    expect(snapshot(a.sim)).toEqual(snapshot(b.sim));
    expect(a.sim.state.enemies[0]!.via).toBeDefined();
  });

  test('путь пересчитывается за подвижной целью: колонна уходит за стену, враг меняет проход', () => {
    // Колонна идёт справа от стены сверху вниз; база — слева у верхнего края.
    const escort: ObjectiveConfig = { type: 'escort', route: [{ x: 6, y: 0 }, { x: 6, y: 6 }], hp: 100, speed: 0.5 };
    const full = ['...^.....', '...^.....', '...^.....', '...^.....', '...^.....', '...^.....', '.........'];
    const m = mission(full, 'tank', escort, { x: 0, y: 0 });
    const sim = createSim(m, content, 1);
    const goals = new Set<number>();
    const vias = new Set<string>();
    for (let i = 0; i < 40 * TICK_RATE && sim.state.status === 'running' && !sim.state.events.some((e) => e.type === 'leak'); i++) {
      step(sim);
      const e = sim.state.enemies[0];
      if (e?.via) {
        goals.add(e.viaGoal!);
        vias.add(`${e.via.x},${e.via.y}`);
      }
      if (e) expect(kindAt(m, e.pos)).toBeUndefined();
    }
    // Цель сменила несколько клеток — путевая точка выбиралась под каждую.
    expect(goals.size).toBeGreaterThan(2);
    expect(vias.size).toBeGreaterThan(1);
    expect(sim.state.objective!.hp).toBeLessThan(100);
  });

  test('враг, оказавшийся на закрытой клетке, выходит с неё и идёт к цели', () => {
    const m = mission(wall('^'), 'tank');
    const sim = createSim(m, content, 1);
    sim.state.enemies.push({ id: 99, type: 'tank', wave: 0, hp: 1, speed: 1, dist: 0, pos: { x: 3, y: 3 } } satisfies EnemyState);
    let leaked = false;
    for (let i = 0; i < 60 * TICK_RATE && !leaked; i++) {
      step(sim);
      leaked = sim.state.events.some((e) => e.type === 'leak' && e.enemy === 99);
    }
    expect(leaked).toBe(true);
  });
});

describe('маршрут', () => {
  test('без преград — прямая; с преградой — ломаная от точки до цели мимо закрытых клеток', () => {
    const from = { x: 0, y: 3 };
    expect(navRoute(undefined, 'ground', from, HQ.pos)).toEqual([from, HQ.pos]);
    const m = mission(wall('^'), 'tank');
    const nav = terrainNav(m)!;
    const route = navRoute(nav, 'ground', from, HQ.pos);
    expect(route.length).toBeGreaterThan(2);
    expect(route[0]).toEqual(from);
    expect(route.at(-1)).toEqual(HQ.pos);
    for (let i = 1; i < route.length; i++)
      for (let k = 0; k <= 20; k++) {
        const p = { x: route[i - 1]!.x + ((route[i]!.x - route[i - 1]!.x) * k) / 20, y: route[i - 1]!.y + ((route[i]!.y - route[i - 1]!.y) * k) / 20 };
        expect(nav.blocked.ground[navCell(nav, p)]).toBe(0);
      }
    // Воздушному горы не мешают.
    expect(navRoute(nav, 'air', from, HQ.pos)).toEqual([from, HQ.pos]);
  });
});

describe('связность', () => {
  const sealed = ['...^.....', '...^.....', '...^.....', '...^.....', '...^.....', '...^.....', '...^.....'];

  test('база, отрезанная от цели, — ошибка; движок такую миссию не запускает', () => {
    const m = mission(sealed, 'tank');
    expect(terrainProblems(m, content)).toEqual([expect.stringContaining('base b is cut off from the objective for ground enemies')]);
    expect(() => createSim(m, content, 1)).toThrow(/cut off/);
  });

  test('преграда отрезает только тех, кому она закрыта: воздушной базе горы не мешают, хребет — мешает', () => {
    expect(terrainProblems(mission(sealed, 'drone'), content)).toEqual([]);
    expect(terrainProblems(mission(sealed.map((r) => r.replace('^', '#')), 'drone'), content)).toEqual([expect.stringContaining('for air enemies')]);
  });

  test('маршрут колонны через преграду, цель, база и аэродром на преграде — ошибки', () => {
    const escort: ObjectiveConfig = { type: 'escort', route: [{ x: 1, y: 6 }, { x: 7, y: 6 }], hp: 10, speed: 1 };
    expect(terrainProblems(mission(sealed, 'drone', escort), content)).toEqual([expect.stringContaining('route crosses mountain at 3,6')]);
    const row = (y: number, x: number, ch: string) => wall('.').map((r, i) => (i === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));
    expect(terrainProblems(mission(row(3, 7, '~'), 'drone'), content)).toEqual([expect.stringContaining('objective stands on water')]);
    expect(terrainProblems(mission(row(3, 0, '^'), 'drone'), content)).toEqual([expect.stringContaining('base b stands on mountain')]);
    expect(terrainProblems(mission(row(0, 8, '#'), 'drone'), content)).toEqual([expect.stringContaining('airfield stands on ridge')]);
  });

  test('проходимый рельеф ошибок не даёт', () => {
    expect(terrainProblems(mission(wall('^'), 'tank'), content)).toEqual([]);
    expect(terrainProblems(mission(undefined, 'tank'), content)).toEqual([]);
  });
});

describe('бот учитывает маршруты', () => {
  /** Матч с A-10 на объекте и танком в заданной точке. */
  const zoneFor = (terrain: string[] | undefined, pos: Vec2): Vec2 => {
    const sim = createSim(mission(terrain, 'tank'), content, 1, [{ group: 'a10', level: 0, zone: { ...HQ.pos } }]);
    sim.state.enemies = [{ id: 100, type: 'tank', wave: 0, hp: 1, speed: 1, dist: 0, pos }];
    return botZone(sim, sim.state.groups[0]!);
  };

  test('враг за стеной: зона уходит к проходу, откуда он выйдет, а не к нему по прямой', () => {
    // Танк слева от стены у её нижнего конца: к цели он выйдет через нижний проход.
    const pos = { x: 2, y: 5 };
    const open = zoneFor(undefined, pos);
    const walled = zoneFor(wall('^'), pos);
    // Без рельефа зона смещается к врагу: больше влево, чем вниз.
    expect(HQ.pos.x - open.x).toBeGreaterThan(open.y - HQ.pos.y);
    // С рельефом — к проходу у нижнего края: заметно ниже.
    expect(walled.y).toBeGreaterThan(open.y + 0.2);
    expect(walled).not.toEqual(HQ.pos);
  });

  test('враг в прямой видимости цели — зона ставится так же, как без рельефа', () => {
    const pos = { x: 5, y: 3 };
    expect(zoneFor(wall('^'), pos)).toEqual(zoneFor(undefined, pos));
  });
});
