import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  RGBAFormat,
  SphereGeometry,
  SRGBColorSpace,
  NearestFilter,
} from 'three';
import type { MissionConfig, Vec2 } from '../sim';
import { cellToWorld } from './coords';
import { groundTint, hillHeight, layoutEnvironment } from './environment';
import type { DecorItem, Placed } from './environment';
import { buildModel } from './model';
import { CONVOY_CARS, FUEL, HANGAR, HQ, runwayModel, SPAWN_GATE, TOWER } from './props';

/**
 * Статика карты как three-объекты: земля с пятнами и сеткой, дорога, аэродром, ворота входов, декор и холмы.
 * Раскладка берётся из environment.ts (чистые функции от MissionConfig); здесь только сборка мешей.
 * Тени включаются здесь: земля и декор принимают, объекты отбрасывают.
 */

const COLORS = {
  ground: 0x436149,
  groundSide: 0x232f26,
  outer: 0x2b3f31,
  grid: 0x7e9b82,
  road: 0x4a4f56,
  roadMark: 0xd8d2b0,
  apron: 0x626a74,
  gateLight: 0xff6a3d,
};

/** Уровень земли вне карты (карта стоит на невысокой плите над ним). */
const OUTER_Y = -0.28;

/** Включить тени на всех мешах поддерева. */
export function setShadows(root: Object3D, cast: boolean, receive: boolean): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

function groundTexture(size: { w: number; h: number }): DataTexture {
  const { w, h } = size;
  const data = new Uint8Array(w * h * 4);
  const base = new Color(COLORS.ground);
  const tmp = new Color();
  const rgb = { r: 0, g: 0, b: 0 };
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++) {
      const k = groundTint({ x: cx, y: cy });
      tmp.copy(base).multiplyScalar(k);
      // Верхняя грань BoxGeometry: строка текстуры 0 — максимальный Z (клетка h-1).
      const i = ((h - 1 - cy) * w + cx) * 4;
      tmp.getRGB(rgb, SRGBColorSpace);
      data[i] = Math.round(Math.min(1, rgb.r) * 255);
      data[i + 1] = Math.round(Math.min(1, rgb.g) * 255);
      data[i + 2] = Math.round(Math.min(1, rgb.b) * 255);
      data[i + 3] = 255;
    }
  const tex = new DataTexture(data, w, h, RGBAFormat);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function gridLines(w: number, h: number): LineSegments {
  const pos: number[] = [];
  const x0 = -w / 2;
  const z0 = -h / 2;
  for (let i = 0; i <= w; i++) pos.push(x0 + i, 0.012, z0, x0 + i, 0.012, z0 + h);
  for (let j = 0; j <= h; j++) pos.push(x0, 0.012, z0 + j, x0 + w, 0.012, z0 + j);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return new LineSegments(geo, new LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.32 }));
}

/** Поставить объект в клетку mission-сетки с курсом `heading`. */
function place(obj: Object3D, p: Placed | { at: Vec2; heading?: number }, size: { w: number; h: number }, y = 0): Object3D {
  const w = cellToWorld(p.at, size, y);
  obj.position.set(w.x, w.y, w.z);
  obj.rotation.y = p.heading ?? 0;
  return obj;
}

const dummy = new Object3D();

function instanced(geo: BufferGeometry, items: DecorItem[], colorOf: (it: DecorItem) => Color, pose: (it: DecorItem, o: Object3D) => void): InstancedMesh | undefined {
  if (!items.length) return undefined;
  const mat = new MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const mesh = new InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    pose(it, dummy);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, colorOf(it));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

const lerpColor = (a: number, b: number, t: number) => new Color(a).lerp(new Color(b), t);

export interface Environment {
  group: Group;
  dispose(): void;
}

/** Статичная часть карты миссии. */
export function buildEnvironment(mission: MissionConfig): Environment {
  const { size } = mission;
  const layout = layoutEnvironment(mission);
  const group = new Group();
  const owned: { dispose(): void }[] = [];

  // Земля: плита с покраской по клеткам (пятна травы), вокруг — тёмная равнина.
  const tex = groundTexture(size);
  owned.push(tex);
  const side = new MeshLambertMaterial({ color: COLORS.groundSide });
  const ground = new Mesh(new BoxGeometry(size.w, 0.4, size.h), [side, side, new MeshLambertMaterial({ map: tex }), side, side, side]);
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  const outer = new Mesh(new PlaneGeometry(size.w + 80, size.h + 80).rotateX(-Math.PI / 2), new MeshLambertMaterial({ color: COLORS.outer }));
  outer.position.y = OUTER_Y;
  outer.receiveShadow = true;
  group.add(outer, ground, gridLines(size.w, size.h));

  // Дорога: сегменты, круглые стыки на поворотах, осевая разметка.
  if (layout.road) {
    const roadMat = new MeshLambertMaterial({ color: COLORS.road });
    const markMat = new MeshLambertMaterial({ color: COLORS.roadMark });
    const road = new Group();
    const pts = layout.road.points;
    for (let i = 1; i < pts.length; i++) {
      const a = cellToWorld(pts[i - 1]!, size);
      const b = cellToWorld(pts[i]!, size);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const seg = new Mesh(new BoxGeometry(len, 0.04, layout.road.width), roadMat);
      seg.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
      seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      road.add(seg);
    }
    const jointGeo = new CylinderGeometry(layout.road.width / 2, layout.road.width / 2, 0.04, 14);
    for (const j of layout.road.joints) road.add(place(new Mesh(jointGeo, roadMat), { at: j }, size, 0.02));
    const dashGeo = new BoxGeometry(0.4, 0.012, 0.07);
    for (const d of layout.road.dashes) road.add(place(new Mesh(dashGeo, markMat), d, size, 0.046));
    setShadows(road, false, true);
    group.add(road);
  }

  // Аэродром: полоса, площадка, ангар, вышка, цистерны.
  {
    const af = layout.airfield;
    const field = new Group();
    field.add(place(buildModel(runwayModel(af.runway.length), '#3b4048'), af.runway, size, 0.01));
    const apron = new Mesh(new BoxGeometry(af.apron.length, 0.05, af.apron.depth), new MeshLambertMaterial({ color: COLORS.apron }));
    field.add(place(apron, af.apron, size, 0.025));
    field.add(place(buildModel(HANGAR, '#7d8794'), af.hangar, size, 0.01));
    field.add(place(buildModel(TOWER, '#8a929c'), af.tower, size, 0.01));
    field.add(place(buildModel(FUEL, '#c9ccd1'), af.fuel, size, 0.01));
    setShadows(field, true, true);
    group.add(field);
  }

  // Ворота входов врагов.
  for (const g of layout.gates) {
    const gate = place(buildModel(SPAWN_GATE, '#ff5a3c'), g, size, 0.01);
    setShadows(gate, true, true);
    group.add(gate);
  }

  // Неподвижное здание: база в конце пути (миссии без цели) или штаб defend (рисуется отдельно из снапшота цели).
  if (layout.building && !mission.objective) {
    const hq = place(buildModel(HQ, '#aab2a6'), { at: layout.building }, size, 0.01);
    setShadows(hq, true, true);
    group.add(hq);
  }

  // Декор: деревья, камни (внутри карты) и холмы (за краем).
  const trees = layout.decor.filter((d) => d.kind === 'tree');
  const rocks = layout.decor.filter((d) => d.kind === 'rock');
  const crownGeo = new ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0);
  const trunkGeo = new CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0);
  const rockGeo = new SphereGeometry(0.5, 5, 4);
  const hillGeo = new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const parts = [
    instanced(crownGeo, trees, (t) => lerpColor(0x2f4d38, 0x41643f, t.tone), (t, o) => {
      o.position.set(...ground3(t.at, size, 0.2 * t.scale));
      o.rotation.y = t.rotation;
      o.scale.set(0.42 * t.scale, 0.62 * t.scale, 0.42 * t.scale);
    }),
    instanced(trunkGeo, trees, () => new Color(0x4a3a2a), (t, o) => {
      o.position.set(...ground3(t.at, size, 0));
      o.scale.set(0.09 * t.scale, 0.26 * t.scale, 0.09 * t.scale);
    }),
    instanced(rockGeo, rocks, (r) => lerpColor(0x5b6058, 0x7a7d72, r.tone), (r, o) => {
      o.position.set(...ground3(r.at, size, 0.04 * r.scale));
      o.rotation.y = r.rotation;
      o.scale.set(0.42 * r.scale, 0.24 * r.scale, 0.32 * r.scale);
    }),
    instanced(hillGeo, layout.hills, (hl) => lerpColor(0x31493a, 0x436349, hl.tone), (hl, o) => {
      o.position.set(...ground3(hl.at, size, OUTER_Y - 0.02));
      o.rotation.y = hl.rotation;
      o.scale.set(hl.scale, hillHeight(hl.scale), hl.scale * 0.85);
    }),
  ];
  for (const p of parts) if (p) group.add(p);

  return {
    group,
    dispose: () => {
      for (const o of owned) o.dispose();
      for (const p of parts) p?.dispose();
      for (const g of [crownGeo, trunkGeo, rockGeo, hillGeo]) g.dispose();
    },
  };
}

function ground3(at: Vec2, size: { w: number; h: number }, y: number): [number, number, number] {
  const w = cellToWorld(at, size, y);
  return [w.x, w.y, w.z];
}

/** Штаб цели defend: здание на месте цели. */
export function buildHeadquarters(): Group {
  const hq = buildModel(HQ, '#aab2a6');
  setShadows(hq, true, true);
  return hq;
}

/** Машины колонны (по одной группе на машину), порядок от головы. */
export function buildConvoyCars(): Group[] {
  return CONVOY_CARS.map((c) => {
    const car = buildModel(c.model, c.color);
    setShadows(car, true, false);
    return car;
  });
}
