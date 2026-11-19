import { pointAt, terrainCells } from '../sim';
import type { MissionConfig, PathData, TerrainCell, TerrainKind, Vec2 } from '../sim';
import { headingOf } from './motion';

/**
 * Раскладка окружения карты из MissionConfig: чистые детерминированные функции без three и DOM.
 * Всё в координатах клеток (клетка i занимает [i - 0.5, i + 0.5)); поворот — как у `headingOf` (нос по +X, вокруг вертикали).
 * Ветвление только по типу цели (defend/escort); id миссии не читается. Случайность — хеш от координат.
 */

export const ROAD_WIDTH = 0.9;
/** На сколько дорога выходит за первую и последнюю точки маршрута (колонна въезжает и выезжает за карту). */
export const ROAD_EXTENSION = 4;
const DASH_STEP = 0.9;
const DASH_LEN = 0.4;

export interface Dash {
  at: Vec2;
  heading: number;
}

export interface RoadLayout {
  /** Полилиния дороги: маршрут/путь миссии, продлённый по краям на ROAD_EXTENSION. */
  points: Vec2[];
  width: number;
  /** Осевая прерывистая разметка. */
  dashes: Dash[];
  /** Вершины внутри полилинии (круглые стыки на поворотах). */
  joints: Vec2[];
}

export interface Placed {
  at: Vec2;
  heading: number;
}

export interface Rect {
  min: Vec2;
  max: Vec2;
}

export interface AirfieldLayout {
  runway: Placed & { length: number };
  apron: Placed & { length: number; depth: number };
  hangar: Placed;
  tower: Placed;
  fuel: Placed;
  /** Прямоугольник, занятый аэродромом: декор сюда не ставится. */
  zone: Rect;
}

export type DecorKind = 'tree' | 'rock' | 'hill';

export interface DecorItem {
  kind: DecorKind;
  at: Vec2;
  /** Размер: дерево/камень — множитель, холм — радиус основания. */
  scale: number;
  rotation: number;
  /** Оттенок 0..1 (разброс цвета). */
  tone: number;
}

/** Вершина горы или хребта: конус с основанием `radius` и высотой `height`, клетки. */
export interface PeakItem {
  kind: Exclude<TerrainKind, 'water'>;
  at: Vec2;
  radius: number;
  height: number;
  rotation: number;
  /** Оттенок 0..1 (разброс цвета). */
  tone: number;
  /** Снежная шапка: только у высоких вершин хребта. */
  snow: boolean;
}

/** Рельеф-преграда: клетки из `MissionConfig.terrain` (те же, что читает sim) и вершины на них. */
export interface TerrainLayout {
  cells: TerrainCell[];
  peaks: PeakItem[];
}

export interface EnvironmentLayout {
  road?: RoadLayout;
  airfield: AirfieldLayout;
  /** Ворота входов врагов; нос ворот — внутрь карты. */
  gates: Placed[];
  /** Неподвижное здание: цель defend или база в конце пути. */
  building?: Vec2;
  /** Деревья и камни внутри карты. */
  decor: DecorItem[];
  /** Холмы за краем карты (проходимый фон): не заходят на поле боя. */
  hills: DecorItem[];
  /** Преграды на поле боя: вода, горы, хребты. */
  terrain: TerrainLayout;
}

// --- хеш и шум ---

/** Хеш трёх целых -> [0, 1). */
export function hash01(x: number, y: number, salt: number): number {
  let n = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Гладкий шум [0, 1) по решётке с шагом 1 (билинейно со сглаживанием). */
export function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash01(x0, y0, salt);
  const b = hash01(x0 + 1, y0, salt);
  const c = hash01(x0, y0 + 1, salt);
  const d = hash01(x0 + 1, y0 + 1, salt);
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}

/** Множитель яркости земли для клетки: пятна травы крупно + лёгкий разброс по клеткам. */
export function groundTint(cell: Vec2): number {
  return 0.88 + 0.2 * valueNoise(cell.x / 3.2, cell.y / 3.2, 11) + 0.08 * (hash01(cell.x, cell.y, 5) - 0.5);
}

// --- геометрия ---

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const unit = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
};

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const len2 = ab.x * ab.x + ab.y * ab.y;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2));
  return Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t));
}

export function distToPolyline(p: Vec2, pts: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1]!, pts[i]!));
  return pts.length === 1 ? Math.hypot(p.x - pts[0]!.x, p.y - pts[0]!.y) : best;
}

function distToRect(p: Vec2, r: Rect): number {
  const dx = Math.max(r.min.x - p.x, 0, p.x - r.max.x);
  const dy = Math.max(r.min.y - p.y, 0, p.y - r.max.y);
  return Math.hypot(dx, dy);
}

/** Область, которую декор обходит: круг, отрезок или прямоугольник (radius — запас вокруг). */
type Feature = { kind: 'circle'; c: Vec2; r: number } | { kind: 'line'; pts: Vec2[]; r: number } | { kind: 'rect'; rect: Rect; r: number };

const featureGap = (f: Feature, p: Vec2): number => {
  switch (f.kind) {
    case 'circle':
      return Math.hypot(p.x - f.c.x, p.y - f.c.y) - f.r;
    case 'line':
      return distToPolyline(p, f.pts) - f.r;
    case 'rect':
      return distToRect(p, f.rect) - f.r;
  }
};

/** Зазор от точки до ближайшего занятого места (аэродром, входы, цель, дорога); меньше 0 — внутри. */
export function clearance(mission: MissionConfig, p: Vec2): number {
  return Math.min(Infinity, ...occupied(layoutCore(mission)).map((f) => featureGap(f, p)));
}

// --- ядро раскладки (без декора) ---

interface Core {
  mission: MissionConfig;
  road?: RoadLayout;
  airfield: AirfieldLayout;
  gates: Placed[];
  building?: Vec2;
  spawns: Vec2[];
}

/** Полилиния дороги миссии: маршрут колонны или путь врагов. */
export function roadPolyline(mission: MissionConfig): Vec2[] | undefined {
  const pts = mission.objective?.type === 'escort' ? mission.objective.route : mission.path;
  return pts && pts.length >= 2 ? pts : undefined;
}

/** Дорога с продлением концов и разметкой. */
export function layoutRoad(route: readonly Vec2[]): RoadLayout {
  const first = unit(sub(route[0]!, route[1]!));
  const last = unit(sub(route[route.length - 1]!, route[route.length - 2]!));
  const points = [add(route[0]!, mul(first, ROAD_EXTENSION)), ...route, add(route[route.length - 1]!, mul(last, ROAD_EXTENSION))];
  const dashes: Dash[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    const heading = headingOf(d.x, d.y) ?? 0;
    const dir = unit(d);
    // Штрихи не заходят на стыки: отступ от вершин, чтобы на поворотах разметка не налезала.
    for (let s = 0.5 + DASH_LEN / 2; s <= len - 0.5 - DASH_LEN / 2 + 1e-9; s += DASH_STEP) dashes.push({ at: add(a, mul(dir, s)), heading });
  }
  return { points, width: ROAD_WIDTH, dashes, joints: points.slice(1, -1) };
}

/** Аэродром у ближайшего края карты: полоса вдоль края через клетку аэродрома, рядом площадка и строения. */
export function layoutAirfield(mission: MissionConfig): AirfieldLayout {
  const { w, h } = mission.size;
  const a = mission.airfield;
  // Ближайший край: при равенстве — вертикальные (левый/правый).
  const toLeft = a.x + 0.5;
  const toRight = w - 0.5 - a.x;
  const toTop = a.y + 0.5;
  const toBottom = h - 0.5 - a.y;
  const vertical = Math.min(toLeft, toRight) <= Math.min(toTop, toBottom); // край идёт по оси y
  const inward: Vec2 = vertical ? { x: toLeft <= toRight ? 1 : -1, y: 0 } : { x: 0, y: toTop <= toBottom ? 1 : -1 };
  const alongSize = vertical ? h : w;
  const aAlong = vertical ? a.y : a.x;
  const towardCenter = aAlong <= (alongSize - 1) / 2 ? 1 : -1;
  const along: Vec2 = vertical ? { x: 0, y: towardCenter } : { x: towardCenter, y: 0 };
  // Полоса начинается у края карты со стороны аэродрома и тянется к центру.
  const startAlong = towardCenter > 0 ? -0.5 : alongSize - 0.5;
  const length = Math.min(alongSize - 1, Math.max(4.2, Math.abs(aAlong - startAlong) + 1.5));
  const centerAlong = startAlong + (towardCenter * length) / 2;
  const edgeCoord = vertical ? a.x : a.y;
  const runwayCenter: Vec2 = vertical ? { x: edgeCoord, y: centerAlong } : { x: centerAlong, y: edgeCoord };
  const at = (s: number, d: number): Vec2 => {
    // s — вдоль края от аэродрома к центру, d — вглубь карты от линии полосы.
    const p = add(add(a, mul(along, s)), mul(inward, d));
    return { x: Math.min(w - 1, Math.max(0, p.x)), y: Math.min(h - 1, Math.max(0, p.y)) };
  };
  const faceRunway = headingOf(-inward.x, -inward.y) ?? 0;
  const alongHeading = headingOf(along.x, along.y) ?? 0;

  const zoneAlong = [startAlong, startAlong + towardCenter * (length + 0.8)].sort((p, q) => p - q) as [number, number];
  const depth = vertical ? inward.x : inward.y;
  const across = [edgeCoord - depth * 0.6, edgeCoord + depth * 2.4].sort((p, q) => p - q) as [number, number];
  const zone: Rect = vertical
    ? { min: { x: across[0], y: zoneAlong[0] }, max: { x: across[1], y: zoneAlong[1] } }
    : { min: { x: zoneAlong[0], y: across[0] }, max: { x: zoneAlong[1], y: across[1] } };

  return {
    runway: { at: runwayCenter, heading: alongHeading, length },
    apron: { at: at(0.55, 1.05), heading: alongHeading, length: 1.8, depth: 0.9 },
    hangar: { at: at(1.9, 1.9), heading: faceRunway },
    tower: { at: at(-0.05, 1.7), heading: faceRunway },
    fuel: { at: at(2.9, 1.4), heading: faceRunway },
    zone,
  };
}

function layoutCore(mission: MissionConfig): Core {
  const road = roadPolyline(mission);
  const center: Vec2 = { x: (mission.size.w - 1) / 2, y: (mission.size.h - 1) / 2 };
  // Точки входа: вражеские базы миссии с целью или начало пути.
  const spawns = mission.objective ? (mission.bases ?? []).map((b) => b.pos) : (mission.path ?? []).slice(0, 1);
  const gates = spawns.map((s): Placed => ({ at: s, heading: headingOf(center.x - s.x, center.y - s.y) ?? 0 }));
  const path = mission.path ?? [];
  const building = mission.objective ? (mission.objective.type === 'defend' ? mission.objective.pos : undefined) : path[path.length - 1];
  return { mission, road: road && layoutRoad(road), airfield: layoutAirfield(mission), gates, building, spawns };
}

function occupied(core: Core): Feature[] {
  const out: Feature[] = [
    { kind: 'rect', rect: core.airfield.zone, r: 0 },
    { kind: 'circle', c: core.mission.airfield, r: 0.9 },
    ...core.spawns.map((c): Feature => ({ kind: 'circle', c, r: 0.9 })),
  ];
  if (core.building) out.push({ kind: 'circle', c: core.building, r: 1.1 });
  if (core.road) out.push({ kind: 'line', pts: core.road.points, r: core.road.width / 2 });
  return out;
}

// --- рельеф-преграда ---

/**
 * Высота вершин, клетки: горы ниже полёта любого воздушного врага (самый низкий — вертолёт, 0,8) — над ними летают;
 * хребет выше любого полёта (самый высокий — бомбардировщик, 1,2) — его облетают все.
 * Хребет не выше 1,8: выше он закрывает половину карты за собой (вершины к тому же полупрозрачны, см. RIDGE_OPACITY).
 */
export const PEAK_HEIGHT: Record<PeakItem['kind'], readonly [number, number]> = { mountain: [0.4, 0.62], ridge: [1.4, 1.8] };

/** Вершины на клетках гор и хребтов: по две на клетку, основания не выходят за клетку. Вода — плоская, вершин нет. */
export function layoutTerrain(mission: MissionConfig): TerrainLayout {
  const cells = terrainCells(mission);
  const peaks: PeakItem[] = [];
  for (const c of cells) {
    if (c.kind === 'water') continue;
    const [lo, hi] = PEAK_HEIGHT[c.kind];
    const ridge = c.kind === 'ridge';
    for (let i = 0; i < 2; i++) {
      const salt = 40 + i * 10;
      // Главная вершина крупная и у центра клетки, вторая — меньше и сбоку: гряда выглядит неровной.
      const radius = i === 0 ? (ridge ? 0.47 : 0.4) : 0.26;
      const reach = 0.5 - radius;
      const k = i === 0 ? 1 : 0.55;
      peaks.push({
        kind: c.kind,
        at: { x: c.x + (hash01(c.x, c.y, salt) * 2 - 1) * reach, y: c.y + (hash01(c.x, c.y, salt + 1) * 2 - 1) * reach },
        radius,
        height: (lo + (hi - lo) * hash01(c.x, c.y, salt + 2)) * k,
        rotation: hash01(c.x, c.y, salt + 3) * Math.PI * 2,
        tone: hash01(c.x, c.y, salt + 4),
        snow: ridge && i === 0,
      });
    }
  }
  return { cells, peaks };
}

/** Точки вдоль ломаной с шагом `step` (маршрут врагов на карте); `skip` — отступ от начала и конца. */
export function routeDots(points: readonly Vec2[], step = 0.5, skip = 0.8): Vec2[] {
  const out: Vec2[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  let walked = 0;
  let next = skip;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (; next <= walked + len && next <= total - skip; next += step) {
      const t = len === 0 ? 0 : (next - walked) / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    walked += len;
  }
  return out;
}

// --- декор ---

const DECOR_MARGIN = 0.7;
const MAP_MARGIN = 0.2;

export function hillHeight(radius: number): number {
  return Math.min(0.6, 0.12 + radius * 0.17);
}

/** Раскладка деревьев и камней внутри карты: пятнами, только на свободных местах; плюс холмы за краем. */
function layoutDecor(core: Core): { decor: DecorItem[]; hills: DecorItem[] } {
  const { w, h } = core.mission.size;
  const feats = occupied(core);
  // Деревья и камни не растут на преградах: вода, горы и хребты читаются чисто.
  const barred = new Set(terrainCells(core.mission).map((c) => c.y * w + c.x));
  const salt = w * 131 + h * 17;
  const decor: DecorItem[] = [];
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++) {
      const forest = valueNoise(cx / 2.6, cy / 2.6, salt + 3);
      const dTree = 0.04 + 0.5 * Math.max(0, forest - 0.58);
      const r = hash01(cx, cy, salt + 1);
      const kind: DecorKind | undefined = r < dTree ? 'tree' : r > 0.965 ? 'rock' : undefined;
      if (!kind) continue;
      const at: Vec2 = {
        x: Math.min(w - 0.5 - MAP_MARGIN, Math.max(-0.5 + MAP_MARGIN, cx + (hash01(cx, cy, salt + 2) - 0.5) * 0.7)),
        y: Math.min(h - 0.5 - MAP_MARGIN, Math.max(-0.5 + MAP_MARGIN, cy + (hash01(cx, cy, salt + 4) - 0.5) * 0.7)),
      };
      if (feats.some((f) => featureGap(f, at) < DECOR_MARGIN)) continue;
      if (barred.has(Math.round(at.y) * w + Math.round(at.x))) continue;
      decor.push({
        kind,
        at,
        scale: kind === 'tree' ? 0.75 + 0.5 * hash01(cx, cy, salt + 6) : 0.6 + 0.6 * hash01(cx, cy, salt + 6),
        rotation: hash01(cx, cy, salt + 7) * Math.PI * 2,
        tone: hash01(cx, cy, salt + 8),
      });
    }

  // Холмы кольцом за краем карты: основание целиком снаружи поля боя.
  const hills: DecorItem[] = [];
  const x0 = -0.5;
  const x1 = w - 0.5;
  const y0 = -0.5;
  const y1 = h - 0.5;
  const STEP = 2.6;
  const place = (px: number, py: number, nx: number, ny: number, i: number, ring: number) => {
    if (hash01(i, ring, salt + 20) > 0.7) return;
    const scale = 0.8 + 0.9 * hash01(i, ring, salt + 21);
    const dist = scale + 0.5 + ring * 1.9 + hash01(i, ring, salt + 22) * 1.2;
    const along = (hash01(i, ring, salt + 23) - 0.5) * 1.2;
    const at: Vec2 = { x: px + nx * dist + ny * along, y: py + ny * dist + nx * along };
    // Дорога уходит за карту: холмы её не перекрывают.
    if (core.road && distToPolyline(at, core.road.points) < scale + core.road.width / 2 + 0.3) return;
    hills.push({
      kind: 'hill',
      at,
      scale,
      rotation: hash01(i, ring, salt + 24) * Math.PI * 2,
      tone: hash01(i, ring, salt + 25),
    });
  };
  for (let ring = 0; ring < 2; ring++) {
    let i = 0;
    // Длинные края с шагом STEP; углы покрывают соседние стороны за счёт диапазона, выходящего за карту.
    for (let x = x0 - 2; x <= x1 + 2; x += STEP, i++) {
      place(x, y0, 0, -1, i, ring);
      place(x, y1, 0, 1, i + 100, ring);
    }
    for (let y = y0 + STEP / 2; y <= y1 - STEP / 2; y += STEP, i++) {
      place(x0, y, -1, 0, i + 200, ring);
      place(x1, y, 1, 0, i + 300, ring);
    }
  }
  return { decor, hills };
}

/** Полная раскладка окружения карты. */
export function layoutEnvironment(mission: MissionConfig): EnvironmentLayout {
  const core = layoutCore(mission);
  return { road: core.road, airfield: core.airfield, gates: core.gates, building: core.building, ...layoutDecor(core), terrain: layoutTerrain(mission) };
}

// --- колонна ---

/** Точка маршрута на расстоянии dist от начала; за концами маршрут продлевается по касательной. */
export function routePoint(route: PathData, dist: number): Vec2 {
  if (dist < 0) {
    const dir = unit(sub(route.points[1]!, route.points[0]!));
    return add(route.points[0]!, mul(dir, dist));
  }
  if (dist > route.length) {
    const n = route.points.length;
    const dir = unit(sub(route.points[n - 1]!, route.points[n - 2]!));
    return add(route.points[n - 1]!, mul(dir, dist - route.length));
  }
  return pointAt(route, dist);
}

/** Положение и курс машины колонны на расстоянии dist по маршруту (курс сглажен на поворотах). */
export function routePose(route: PathData, dist: number): Placed {
  const at = routePoint(route, dist);
  const ahead = routePoint(route, dist + 0.3);
  const behind = routePoint(route, dist - 0.3);
  return { at, heading: headingOf(ahead.x - behind.x, ahead.y - behind.y) ?? 0 };
}
