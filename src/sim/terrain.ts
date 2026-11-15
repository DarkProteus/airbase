import type { Content, MissionConfig, TerrainKind, Vec2 } from './types';

/**
 * Рельеф как преграда. Данные — `MissionConfig.terrain`: строки-карта, по символу на клетку.
 * Наземные враги обходят воду, горы и хребты; воздушные — только хребты. Свои авиагруппы летают выше рельефа.
 * Всё здесь — чистые функции от конфига миссии: поля расстояний и маршруты кэшируются по объекту миссии.
 */

/** Класс движения врага: задаётся тегом `ground` в конфиге, остальные — воздушные. */
export type MoveClass = 'ground' | 'air';
export const MOVE_CLASSES: readonly MoveClass[] = ['ground', 'air'];

export const moveClass = (tags: readonly string[]): MoveClass => (tags.includes('ground') ? 'ground' : 'air');

/** Символы карты рельефа: строка `terrain[y]`, символ `[x]`. */
export const TERRAIN_CHARS: Readonly<Record<string, TerrainKind | null>> = { '.': null, '~': 'water', '^': 'mountain', '#': 'ridge' };

/** Кому преграда закрывает клетку. */
export const TERRAIN_BLOCKS: Readonly<Record<TerrainKind, readonly MoveClass[]>> = {
  water: ['ground'],
  mountain: ['ground'],
  ridge: ['ground', 'air'],
};

/** Запас, с которым прямой путь обходит преграду, клеток: враг не трётся о склон. */
export const TERRAIN_MARGIN = 0.2;

export interface TerrainCell extends Vec2 {
  kind: TerrainKind;
}

/** Поле расстояний до клетки цели: длина кратчайшего пути по клеткам и следующая клетка на нём (−1 — нет). */
interface Field {
  dist: Float64Array;
  next: Int16Array;
}

export interface Nav {
  w: number;
  h: number;
  /** Преграда в клетке (индекс y * w + x); null — свободно. */
  kinds: (TerrainKind | null)[];
  blocked: Record<MoveClass, Uint8Array>;
  /** Центры закрытых клеток по классам — для проверки прямой видимости. */
  boxes: Record<MoveClass, Vec2[]>;
  fields: Record<MoveClass, Map<number, Field>>;
  routes: Record<MoveClass, Map<number, Vec2[]>>;
}

/** Разбор карты рельефа миссии; ошибка — размер не совпал с картой или символ неизвестен. */
export function terrainCells(mission: Pick<MissionConfig, 'id' | 'size' | 'terrain'>): TerrainCell[] {
  const rows = mission.terrain;
  if (!rows) return [];
  const { w, h } = mission.size;
  if (rows.length !== h) throw new Error(`terrain needs ${h} rows: ${mission.id}`);
  const out: TerrainCell[] = [];
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`terrain row ${y} needs ${w} cells: ${mission.id}`);
    for (let x = 0; x < w; x++) {
      const kind = TERRAIN_CHARS[row[x]!];
      if (kind === undefined) throw new Error(`unknown terrain char "${row[x]}" at ${x},${y}: ${mission.id}`);
      if (kind) out.push({ x, y, kind });
    }
  });
  return out;
}

const navCache = new WeakMap<object, Nav | null>();

/** Навигация по рельефу миссии; undefined — преград нет, враги идут по прямой. */
export function terrainNav(mission: MissionConfig): Nav | undefined {
  let nav = navCache.get(mission);
  if (nav === undefined) {
    const cells = terrainCells(mission);
    nav = cells.length ? buildNav(mission.size, cells) : null;
    navCache.set(mission, nav);
  }
  return nav ?? undefined;
}

function buildNav(size: { w: number; h: number }, cells: readonly TerrainCell[]): Nav {
  const { w, h } = size;
  const kinds = new Array<TerrainKind | null>(w * h).fill(null);
  const blocked = { ground: new Uint8Array(w * h), air: new Uint8Array(w * h) };
  const boxes: Record<MoveClass, Vec2[]> = { ground: [], air: [] };
  for (const c of cells) {
    kinds[c.y * w + c.x] = c.kind;
    for (const cls of TERRAIN_BLOCKS[c.kind]) {
      blocked[cls][c.y * w + c.x] = 1;
      boxes[cls].push({ x: c.x, y: c.y });
    }
  }
  return { w, h, kinds, blocked, boxes, fields: { ground: new Map(), air: new Map() }, routes: { ground: new Map(), air: new Map() } };
}

/** Индекс клетки, в которой лежит точка (точки за краем карты относятся к крайним клеткам). */
export function navCell(nav: Pick<Nav, 'w' | 'h'>, p: Vec2): number {
  const x = Math.min(nav.w - 1, Math.max(0, Math.round(p.x)));
  const y = Math.min(nav.h - 1, Math.max(0, Math.round(p.y)));
  return y * nav.w + x;
}

const center = (nav: Nav, cell: number): Vec2 => ({ x: cell % nav.w, y: Math.floor(cell / nav.w) });

/** Соседи клетки в фиксированном порядке (детерминизм при равных расстояниях): сначала по сторонам, потом по диагонали. */
const DIRS: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

function field(nav: Nav, cls: MoveClass, goal: number): Field {
  const cached = nav.fields[cls].get(goal);
  if (cached) return cached;
  const { w, h } = nav;
  const closed = nav.blocked[cls];
  const n = w * h;
  const dist = new Float64Array(n).fill(Infinity);
  const next = new Int16Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[goal] = 0;
  // Карты малы (сотни клеток): Дейкстра с линейным поиском минимума.
  for (;;) {
    let c = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i]! < Infinity && (c < 0 || dist[i]! < dist[c]!)) c = i;
    if (c < 0) break;
    done[c] = 1;
    const cx = c % w;
    const cy = (c - cx) / w;
    for (const [dx, dy] of DIRS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || closed[y * w + x]) continue;
      // По диагонали — только если обе смежные клетки свободны: углы преград не срезаются.
      if (dx && dy && (closed[cy * w + x] || closed[y * w + cx])) continue;
      const d = dist[c]! + (dx && dy ? Math.SQRT2 : 1);
      if (d < dist[y * w + x]! - 1e-9) {
        dist[y * w + x] = d;
        next[y * w + x] = c;
      }
    }
  }
  const f = { dist, next };
  nav.fields[cls].set(goal, f);
  return f;
}

/** Есть ли путь по клеткам из точки `from` к точке `to` для класса движения. */
export function navReachable(nav: Nav, cls: MoveClass, from: Vec2, to: Vec2): boolean {
  return field(nav, cls, navCell(nav, to)).dist[navCell(nav, from)]! < Infinity;
}

/** Прямой отрезок a–b не задевает закрытых клеток (с запасом TERRAIN_MARGIN). */
export function navClear(nav: Nav, cls: MoveClass, a: Vec2, b: Vec2): boolean {
  const half = 0.5 + TERRAIN_MARGIN;
  const minX = Math.min(a.x, b.x) - half;
  const maxX = Math.max(a.x, b.x) + half;
  const minY = Math.min(a.y, b.y) - half;
  const maxY = Math.max(a.y, b.y) + half;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const c of nav.boxes[cls]) {
    if (c.x <= minX || c.x >= maxX || c.y <= minY || c.y >= maxY) continue;
    // Отрезок против квадрата: пересечение интервалов параметра по осям.
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    for (const [p, d, lo, hi] of [[a.x, dx, c.x - half, c.x + half], [a.y, dy, c.y - half, c.y + half]] as const) {
      if (Math.abs(d) < 1e-12) {
        if (p <= lo || p >= hi) hit = false;
      } else {
        const u = (lo - p) / d;
        const v = (hi - p) / d;
        t0 = Math.max(t0, Math.min(u, v));
        t1 = Math.min(t1, Math.max(u, v));
      }
    }
    if (hit && t0 < t1 - 1e-9) return false;
  }
  return true;
}

/** Следующая клетка пути из клетки `c`; из закрытой или отрезанной клетки — ближайший к цели свободный сосед. */
function descend(nav: Nav, f: Field, c: number): number {
  if (f.next[c]! >= 0) return f.next[c]!;
  if (f.dist[c] === 0) return -1;
  const cx = c % nav.w;
  const cy = (c - cx) / nav.w;
  let best = -1;
  for (const [dx, dy] of DIRS) {
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || y < 0 || x >= nav.w || y >= nav.h) continue;
    const i = y * nav.w + x;
    if (f.dist[i]! < Infinity && (best < 0 || f.dist[i]! < f.dist[best]!)) best = i;
  }
  return best;
}

/**
 * Путевая точка для врага в `pos`, которому цель `goal` закрыта преградой: самая дальняя клетка кратчайшего пути,
 * до центра которой можно дойти по прямой. Следующая клетка пути принимается всегда — до соседней свободной клетки преград нет.
 */
export function navWaypoint(nav: Nav, cls: MoveClass, pos: Vec2, goal: Vec2): Vec2 {
  const goalCell = navCell(nav, goal);
  const f = field(nav, cls, goalCell);
  let cur = descend(nav, f, navCell(nav, pos));
  if (cur < 0) return { x: goal.x, y: goal.y };
  for (let k = 0; k < nav.w * nav.h; k++) {
    const n = f.next[cur]!;
    if (n < 0 || !navClear(nav, cls, pos, center(nav, n))) break;
    cur = n;
  }
  return cur === goalCell ? { x: goal.x, y: goal.y } : center(nav, cur);
}

/** Маршрут из центра клетки `from` к центру клетки `goal` (без первой точки); пусто — пути нет или клетки совпали. */
function cellRoute(nav: Nav, cls: MoveClass, from: number, goal: number): Vec2[] {
  const key = from * nav.w * nav.h + goal;
  const cached = nav.routes[cls].get(key);
  if (cached) return cached;
  const to = center(nav, goal);
  const out: Vec2[] = [];
  if (field(nav, cls, goal).dist[from]! < Infinity) {
    let p = center(nav, from);
    for (let k = 0; k < nav.w * nav.h && (p.x !== to.x || p.y !== to.y); k++) {
      p = navClear(nav, cls, p, to) ? to : navWaypoint(nav, cls, p, to);
      out.push(p);
    }
  }
  nav.routes[cls].set(key, out);
  return out;
}

/**
 * Маршрут врага из `from` к цели `goal`: ломаная в обход преград, первая точка — `from`, последняя — `goal`.
 * Без преград — прямая. За первой путевой точкой маршрут считается по центрам клеток и кэшируется.
 */
export function navRoute(nav: Nav | undefined, cls: MoveClass, from: Vec2, goal: Vec2, via?: Vec2): Vec2[] {
  if (!nav || navClear(nav, cls, from, goal)) return [from, goal];
  const first = via ?? navWaypoint(nav, cls, from, goal);
  const rest = cellRoute(nav, cls, navCell(nav, first), navCell(nav, goal));
  return [from, first, ...rest.slice(0, -1), goal];
}

/** Классы движения врагов, которых выпускает база с индексом `base` (по списку базы и расписанию волн). */
function baseClasses(mission: MissionConfig, content: Content, base: number): MoveClass[] {
  const types = [
    ...(mission.bases?.[base]?.roster ?? []).map((r) => r.enemy),
    ...mission.waves.flatMap((w) => w.groups.filter((g) => (g.base ?? 0) === base).map((g) => g.enemy)),
  ];
  return MOVE_CLASSES.filter((cls) => types.some((t) => content.enemies[t] && moveClass(content.enemies[t].tags) === cls));
}

/** Шаг проверки маршрута колонны, клеток. */
const ROUTE_STEP = 0.25;

/**
 * Ошибки рельефа миссии с целью: цель или маршрут колонны на преграде, база на преграде, база отрезана от цели.
 * Пустой список — рельеф в порядке. Движок такую миссию не запускает, тест контента — не пропускает.
 */
export function terrainProblems(mission: MissionConfig, content: Content): string[] {
  let nav: Nav | undefined;
  try {
    nav = terrainNav(mission);
  } catch (e) {
    return [(e as Error).message];
  }
  const o = mission.objective;
  if (!nav || !o) return [];
  const out: string[] = [];
  const kindAt = (p: Vec2) => nav.kinds[navCell(nav, p)];
  const at = (p: Vec2) => `${p.x},${p.y}`;
  // Цель стоит на земле: объект и вся дорога колонны — на клетках, открытых наземным.
  const targets: Vec2[] = o.type === 'defend' ? [o.pos] : o.route;
  if (o.type === 'escort')
    for (let i = 1; i < o.route.length; i++) {
      const a = o.route[i - 1]!;
      const b = o.route[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / ROUTE_STEP));
      for (let k = 0; k <= steps; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps };
        if (nav.blocked.ground[navCell(nav, p)]) {
          out.push(`route crosses ${kindAt(p)} at ${at({ x: Math.round(p.x), y: Math.round(p.y) })}`);
          break;
        }
      }
    }
  else if (nav.blocked.ground[navCell(nav, o.pos)]) out.push(`objective stands on ${kindAt(o.pos)} at ${at(o.pos)}`);
  if (kindAt(mission.airfield)) out.push(`airfield stands on ${kindAt(mission.airfield)} at ${at(mission.airfield)}`);
  (mission.bases ?? []).forEach((b, i) => {
    if (kindAt(b.pos)) return void out.push(`base ${b.id} stands on ${kindAt(b.pos)} at ${at(b.pos)}`);
    for (const cls of baseClasses(mission, content, i))
      if (targets.some((t) => !nav.blocked[cls][navCell(nav, t)] && !navReachable(nav, cls, b.pos, t))) out.push(`base ${b.id} is cut off from the objective for ${cls} enemies`);
  });
  return out.map((p) => `${p}: ${mission.id}`);
}
