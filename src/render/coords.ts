import type { Vec2 } from '../sim';

/**
 * Чистая математика координат карты: без DOM, без WebGL, без three.
 *
 * Клетка (x, y) из MissionConfig имеет центр в целых координатах: клетка i занимает [i - 0.5, i + 0.5).
 * Мир: X = x - (w-1)/2, Z = y - (h-1)/2, Y — высота. Карта центрирована в начале координат.
 * Камера ортографическая, изометрическая, зафиксирована: смотрит вдоль (-1,-1,-1) на начало координат.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GridSize {
  w: number;
  h: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Направление взгляда камеры (единичное) и экранный базис: right — вправо, up — вверх на экране. */
export const ISO_FORWARD: Vec3 = norm({ x: -1, y: -1, z: -1 });
export const ISO_RIGHT: Vec3 = norm(cross(ISO_FORWARD, { x: 0, y: 1, z: 0 }));
export const ISO_UP: Vec3 = cross(ISO_RIGHT, ISO_FORWARD);

/** Клетка (возможно дробная — позиция врага) -> мир, на высоте y. */
export function cellToWorld(cell: Vec2, size: GridSize, y = 0): Vec3 {
  return { x: cell.x - (size.w - 1) / 2, y, z: cell.y - (size.h - 1) / 2 };
}

/** Мир -> дробные координаты клетки (обратно к cellToWorld, высота отбрасывается). */
export function worldToCell(p: Vec3, size: GridSize): Vec2 {
  return { x: p.x + (size.w - 1) / 2, y: p.z + (size.h - 1) / 2 };
}

/** Целая клетка под дробной точкой или null, если вне сетки. */
export function cellAt(cell: Vec2, size: GridSize): Vec2 | null {
  const x = Math.round(cell.x) + 0; // + 0: -0 -> 0
  const y = Math.round(cell.y) + 0;
  return x >= 0 && x < size.w && y >= 0 && y < size.h ? { x, y } : null;
}

/** Вид: размер вьюпорта в пикселях, масштаб (пикселей на единицу мира) и центр в плоскости камеры. */
export interface IsoView {
  width: number;
  height: number;
  /** Пикселей на единицу мира. */
  zoom: number;
  /** Точка плоскости камеры (вдоль right/up), которая приходится на центр экрана. */
  centerU: number;
  centerV: number;
}

/** Вид, вписывающий всю карту (с полями и запасом по высоте объектов) во вьюпорт. */
export function fitView(size: GridSize, width: number, height: number, margin = 1, headroom = 1.5): IsoView {
  const x0 = -(size.w - 1) / 2 - 0.5 - margin;
  const x1 = (size.w - 1) / 2 + 0.5 + margin;
  const z0 = -(size.h - 1) / 2 - 0.5 - margin;
  const z1 = (size.h - 1) / 2 + 0.5 + margin;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const x of [x0, x1])
    for (const z of [z0, z1])
      for (const y of [0, headroom]) {
        const p = { x, y, z };
        const u = dot(p, ISO_RIGHT);
        const v = dot(p, ISO_UP);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }
  const zoom = Math.min(width / (maxU - minU), height / (maxV - minV));
  return { width, height, zoom, centerU: (minU + maxU) / 2, centerV: (minV + maxV) / 2 };
}

/** Мир -> пиксель экрана (начало слева сверху, y вниз). */
export function worldToScreen(p: Vec3, view: IsoView): Vec2 {
  return {
    x: view.width / 2 + (dot(p, ISO_RIGHT) - view.centerU) * view.zoom,
    y: view.height / 2 - (dot(p, ISO_UP) - view.centerV) * view.zoom,
  };
}

/** Пиксель экрана -> точка пересечения луча камеры с плоскостью земли (y = 0). */
export function screenToWorld(s: Vec2, view: IsoView): Vec3 {
  const u = view.centerU + (s.x - view.width / 2) / view.zoom;
  const v = view.centerV - (s.y - view.height / 2) / view.zoom;
  const origin: Vec3 = {
    x: ISO_RIGHT.x * u + ISO_UP.x * v,
    y: ISO_RIGHT.y * u + ISO_UP.y * v,
    z: ISO_RIGHT.z * u + ISO_UP.z * v,
  };
  const t = -origin.y / ISO_FORWARD.y;
  return sub(origin, { x: -ISO_FORWARD.x * t, y: -ISO_FORWARD.y * t, z: -ISO_FORWARD.z * t });
}

/** Пикинг: пиксель экрана -> клетка сетки (или null вне карты). */
export function pickCell(s: Vec2, view: IsoView, size: GridSize): Vec2 | null {
  return cellAt(worldToCell(screenToWorld(s, view), size), size);
}

/** Индекс слота размещения, лежащего в клетке, или -1. */
export function slotIndexAt(slots: readonly Vec2[], cell: Vec2): number {
  return slots.findIndex((s) => Math.round(s.x) === cell.x && Math.round(s.y) === cell.y);
}
