import { Box3, Mesh } from 'three';
import { expect, test } from 'vitest';
import { ENEMIES, MISSIONS } from '../content';
import { buildPath, terrainCells } from '../sim';
import type { MissionConfig, Vec2 } from '../sim';
import { DEFAULT_ALTITUDE } from '../view/entity';
import { buildModel } from './model';
import {
  clearance,
  distToPolyline,
  groundTint,
  hash01,
  hillHeight,
  layoutAirfield,
  layoutEnvironment,
  layoutRoad,
  layoutTerrain,
  PEAK_HEIGHT,
  roadPolyline,
  ROAD_EXTENSION,
  routeDots,
  routePose,
  valueNoise,
} from './environment';
import { CONVOY_CARS, PROP_MODELS, runwayModel } from './props';

const missions = Object.values(MISSIONS);

/** Миссия без цели: путь врагов и база в его конце (старый формат). */
const pathMission: MissionConfig = {
  id: 'p',
  name: 'p',
  size: { w: 10, h: 8 },
  path: [
    { x: 0, y: 2 },
    { x: 5, y: 2 },
    { x: 5, y: 6 },
    { x: 9, y: 6 },
  ],
  airfield: { x: 0, y: 7 },
  baseLives: 3,
  waves: [],
};

const all = [...missions, pathMission];

const inMap = (m: MissionConfig, p: Vec2, margin = 0) =>
  p.x >= -0.5 + margin && p.x <= m.size.w - 0.5 - margin && p.y >= -0.5 + margin && p.y <= m.size.h - 0.5 - margin;

test('хеш и шум: детерминированы и лежат в [0, 1)', () => {
  for (let i = -20; i < 20; i++)
    for (let j = -20; j < 20; j++) {
      const a = hash01(i, j, 7);
      expect(a).toBe(hash01(i, j, 7));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
      const n = valueNoise(i / 3.3, j / 3.3, 2);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  expect(hash01(1, 2, 3)).not.toBe(hash01(2, 1, 3));
});

test('groundTint: детерминирован, умеренный разброс яркости', () => {
  for (let x = 0; x < 13; x++)
    for (let y = 0; y < 11; y++) {
      const t = groundTint({ x, y });
      expect(t).toBe(groundTint({ x, y }));
      expect(t).toBeGreaterThan(0.8);
      expect(t).toBeLessThan(1.25);
    }
});

test('раскладка детерминирована и не меняет миссию', () => {
  for (const m of all) {
    const before = JSON.stringify(m);
    const a = layoutEnvironment(m);
    expect(JSON.stringify(layoutEnvironment(m))).toBe(JSON.stringify(a));
    expect(JSON.stringify(m)).toBe(before);
  }
});

test('аэродром: полоса, площадка и строения внутри карты, полоса проходит через клетку аэродрома', () => {
  for (const m of all) {
    const af = layoutAirfield(m);
    expect(af.runway.length).toBeGreaterThan(2);
    for (const p of [af.runway.at, af.apron.at, af.hangar.at, af.tower.at, af.fuel.at]) expect(inMap(m, p)).toBe(true);
    // Концы полосы: вдоль края; клетка аэродрома лежит на её оси.
    const half = af.runway.length / 2;
    const along = Math.abs(af.runway.heading) % Math.PI < 1e-6 ? 'x' : 'y';
    const d = along === 'x' ? Math.abs(m.airfield.x - af.runway.at.x) : Math.abs(m.airfield.y - af.runway.at.y);
    const off = along === 'x' ? Math.abs(m.airfield.y - af.runway.at.y) : Math.abs(m.airfield.x - af.runway.at.x);
    expect(d).toBeLessThanOrEqual(half);
    expect(off).toBeLessThan(0.5);
    expect(af.zone.min.x).toBeLessThan(af.zone.max.x);
    expect(af.zone.min.y).toBeLessThan(af.zone.max.y);
  }
});

test('дорога: покрывает маршрут/путь и продлена по краям; штрихи на дороге', () => {
  for (const m of all) {
    const pts = roadPolyline(m);
    const layout = layoutEnvironment(m);
    if (!pts) {
      expect(layout.road).toBeUndefined();
      continue;
    }
    const road = layout.road!;
    for (const p of pts) expect(distToPolyline(p, road.points)).toBeLessThan(1e-6);
    // Продление: крайние точки дороги в ROAD_EXTENSION от первой/последней точки маршрута.
    expect(Math.hypot(road.points[0]!.x - pts[0]!.x, road.points[0]!.y - pts[0]!.y)).toBeCloseTo(ROAD_EXTENSION);
    expect(road.dashes.length).toBeGreaterThan(0);
    for (const d of road.dashes) expect(distToPolyline(d.at, road.points)).toBeLessThan(1e-6);
  }
  expect(roadPolyline(MISSIONS['convoy']!)).toEqual(MISSIONS['convoy']!.objective && 'route' in MISSIONS['convoy']!.objective ? MISSIONS['convoy']!.objective.route : undefined);
  // Миссия с defend дороги не имеет.
  expect(layoutEnvironment(MISSIONS['evac']!).road).toBeUndefined();
});

test('ворота: по одному на точку входа, нос внутрь карты', () => {
  for (const m of all) {
    const spawns = m.objective ? (m.bases ?? []).map((b) => b.pos) : (m.path ?? []).slice(0, 1);
    const gates = layoutEnvironment(m).gates;
    expect(gates.map((g) => g.at)).toEqual(spawns);
    const center = { x: (m.size.w - 1) / 2, y: (m.size.h - 1) / 2 };
    for (const g of gates) {
      // Нос по +X модели поворачивается на heading: в клетках направление (cos, -sin).
      const dir = { x: Math.cos(g.heading), y: -Math.sin(g.heading) };
      const toCenter = { x: center.x - g.at.x, y: center.y - g.at.y };
      expect(dir.x * toCenter.x + dir.y * toCenter.y).toBeGreaterThan(0);
    }
  }
});

test('декор: в пределах карты, не на аэродроме, входах, цели и дороге; холмы целиком за краем', () => {
  for (const m of all) {
    const layout = layoutEnvironment(m);
    expect(layout.decor.length).toBeGreaterThan(0);
    expect(layout.hills.length).toBeGreaterThan(0);
    for (const d of layout.decor) {
      expect(inMap(m, d.at)).toBe(true);
      // Запас вокруг занятых мест, не только сами клетки.
      expect(clearance(m, d.at)).toBeGreaterThanOrEqual(0.7 - 1e-9);
    }
    const spawns = layout.gates.map((g) => g.at);
    const objectives: Vec2[] = m.objective ? (m.objective.type === 'defend' ? [m.objective.pos] : m.objective.route) : (m.path ?? []);
    for (const key of [m.airfield, ...spawns, ...objectives]) for (const d of layout.decor) expect(Math.hypot(d.at.x - key.x, d.at.y - key.y)).toBeGreaterThan(0.9);
    for (const hl of layout.hills) {
      const dx = Math.max(-0.5 - hl.at.x, 0, hl.at.x - (m.size.w - 0.5));
      const dy = Math.max(-0.5 - hl.at.y, 0, hl.at.y - (m.size.h - 0.5));
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(hl.scale);
      expect(hillHeight(hl.scale)).toBeLessThanOrEqual(0.6);
      if (layout.road) expect(distToPolyline(hl.at, layout.road.points)).toBeGreaterThan(hl.scale);
    }
  }
});

test('ядро проверки зазора: объекты миссии занимают место', () => {
  const m = MISSIONS['evac']!;
  expect(clearance(m, m.objective!.type === 'defend' ? m.objective!.pos : { x: 0, y: 0 })).toBeLessThan(0);
  expect(clearance(m, m.airfield)).toBeLessThan(0);
  expect(clearance(m, m.bases![0]!.pos)).toBeLessThan(0);
});

test('колонна: поза на маршруте, голова смотрит по ходу, концы продлены', () => {
  const route = buildPath([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
  ]);
  const start = routePose(route, 0);
  expect(start.at).toEqual({ x: 0, y: 0 });
  expect(start.heading).toBeCloseTo(0);
  // Позади начала — по продолжению первого участка (за картой).
  expect(routePose(route, -1.5).at).toEqual({ x: -1.5, y: 0 });
  const mid = routePose(route, 6);
  expect(mid.at.x).toBeCloseTo(4);
  expect(mid.at.y).toBeCloseTo(2);
  // Движение к +y клеток = −π/2 вокруг вертикали (см. headingOf).
  expect(mid.heading).toBeCloseTo(-Math.PI / 2);
  expect(routePose(route, route.length + 2).at).toEqual({ x: 4, y: 6 });
  // Дорога строится из тех же точек.
  expect(layoutRoad(route.points).points.length).toBe(route.points.length + 2);
});

test('модели окружения: все собираются, низ на земле, размеры конечные', () => {
  for (const model of [...PROP_MODELS, runwayModel(5.5), ...CONVOY_CARS.map((c) => c.model)]) {
    expect(model.parts.length).toBeGreaterThan(0);
    const root = buildModel(model, '#808080');
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    expect(box.min.y).toBeCloseTo(0);
    expect(Number.isFinite(box.max.y) && box.max.y > 0.02).toBe(true);
    let meshes = 0;
    root.traverse((o) => {
      if (o instanceof Mesh) meshes++;
    });
    expect(meshes).toBe(model.parts.length);
  }
});

test('рельеф-преграда: клетки — те же данные, что читает sim; вершины стоят на своих клетках, вода плоская', () => {
  for (const m of missions) {
    const { cells, peaks } = layoutEnvironment(m).terrain;
    expect(cells, m.id).toEqual(terrainCells(m));
    const kindAt = new Map(cells.map((c) => [`${c.x},${c.y}`, c.kind]));
    for (const p of peaks) {
      // Основание вершины не выходит за клетку: преграда на карте занимает ровно закрытые клетки.
      const cx = Math.round(p.at.x);
      const cy = Math.round(p.at.y);
      expect(kindAt.get(`${cx},${cy}`), m.id).toBe(p.kind);
      expect(Math.abs(p.at.x - cx) + p.radius).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(p.at.y - cy) + p.radius).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    const solid = cells.filter((c) => c.kind !== 'water');
    expect(peaks).toHaveLength(solid.length * 2);
    expect(layoutEnvironment(m).terrain).toEqual(layoutTerrain(m));
  }
});

test('преграды отличимы по высоте: горы ниже обычной высоты полёта, главные вершины хребта выше любого полёта', () => {
  const flight = Object.values(ENEMIES).filter((e) => e.tags.includes('air')).map((e) => e.visual?.altitude ?? DEFAULT_ALTITUDE);
  expect(PEAK_HEIGHT.mountain[1]).toBeLessThan(DEFAULT_ALTITUDE);
  expect(PEAK_HEIGHT.ridge[0]).toBeGreaterThan(Math.max(...flight));
  const peaks = missions.flatMap((m) => layoutTerrain(m).peaks);
  for (const p of peaks.filter((x) => x.kind === 'mountain')) expect(p.height).toBeLessThanOrEqual(PEAK_HEIGHT.mountain[1]);
  for (const p of peaks.filter((x) => x.snow)) expect(p.height).toBeGreaterThanOrEqual(PEAK_HEIGHT.ridge[0]);
  expect(peaks.filter((p) => p.snow).every((p) => p.kind === 'ridge')).toBe(true);
});

test('деревья и камни не стоят на клетках преград', () => {
  for (const m of missions) {
    const barred = new Set(terrainCells(m).map((c) => `${c.x},${c.y}`));
    for (const d of layoutEnvironment(m).decor.filter((x) => inMap(m, x.at)))
      if (d.kind !== 'hill') expect(barred.has(`${Math.round(d.at.x)},${Math.round(d.at.y)}`), `${m.id} ${d.kind}`).toBe(false);
  }
});

test('точки маршрута: равный шаг вдоль ломаной, отступ от базы и от цели', () => {
  const line: Vec2[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }];
  const dots = routeDots(line, 0.5, 1);
  expect(dots[0]).toEqual({ x: 1, y: 0 });
  expect(dots.at(-1)).toEqual({ x: 4, y: 2 });
  expect(dots).toHaveLength(11);
  for (const d of dots) expect(distToPolyline(d, line)).toBeCloseTo(0);
  expect(routeDots([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0.5, 0.8)).toEqual([]);
  expect(routeDots([])).toEqual([]);
});
