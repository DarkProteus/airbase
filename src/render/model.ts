import { BoxGeometry, Box3, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import type { ModelConfig, ModelPart, ModelPartShape, Triple } from '../sim';

/**
 * Составная модель из данных. Одно описание (`ModelConfig`) строят и игровая сцена, и превью карточек.
 * Оси модели: X — нос, Y — вверх, Z — вправо.
 */

const DEG = Math.PI / 180;
export const DEFAULT_SEGMENTS = 8;

/** Деталь с подставленными значениями по умолчанию; поворот уже в радианах. */
export interface ResolvedPart {
  shape: ModelPartShape;
  size: Triple;
  offset: Triple;
  rotation: Triple;
  color: string;
  segments: number;
  taper: number;
  sweep: number;
}

/** Чистая развёртка описания: умолчания, градусы -> радианы, цвет сущности для деталей без своего. Вход не меняет. */
export function modelParts(model: ModelConfig, baseColor: string): ResolvedPart[] {
  return model.parts.map((p: ModelPart) => ({
    shape: p.shape,
    size: [...p.size],
    offset: p.offset ? [...p.offset] : [0, 0, 0],
    rotation: p.rotation ? [p.rotation[0] * DEG, p.rotation[1] * DEG, p.rotation[2] * DEG] : [0, 0, 0],
    color: (p.color ?? baseColor).toLowerCase(),
    segments: Math.max(3, Math.round(p.segments ?? DEFAULT_SEGMENTS)),
    taper: Math.min(1, Math.max(0, p.taper ?? 1)),
    sweep: p.sweep ?? 0,
  }));
}

// Единичные геометрии и материалы общие для всех моделей; после dispose three создаёт буферы заново при следующей отрисовке.
const geometries = new Map<string, BufferGeometry>();
const materials = new Map<string, MeshLambertMaterial>();

/**
 * Единичная консоль: корень — хорда 1 на z = 0, законцовка — хорда `taper` на z = 1, сдвинутая назад на `sweep`; толщина 1 по Y.
 * Грани не делят вершины, поэтому нормали плоские, как у остальных деталей.
 */
export function wingGeometry(taper: number, sweep: number): BufferGeometry {
  const tip = Math.max(taper, 1e-3) / 2;
  // Контур сверху, по часовой стрелке, если смотреть с +Y: передняя кромка корня, передняя законцовки, задняя законцовки, задняя корня.
  const outline: [number, number][] = [[0.5, 0], [-sweep + tip, 1], [-sweep - tip, 1], [-0.5, 0]];
  const top = outline.map(([x, z]) => [x, 0.5, z] as const);
  const bottom = outline.map(([x, z]) => [x, -0.5, z] as const);
  const quads = [
    [top[0]!, top[3]!, top[2]!, top[1]!],
    [bottom[0]!, bottom[1]!, bottom[2]!, bottom[3]!],
    ...outline.map((_, i) => {
      const j = (i + 1) % outline.length;
      return [top[i]!, top[j]!, bottom[j]!, bottom[i]!];
    }),
  ];
  const positions: number[] = [];
  for (const [a, b, c, d] of quads) positions.push(...a!, ...b!, ...c!, ...a!, ...c!, ...d!);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function unitGeometry(shape: ModelPartShape, segments: number, taper: number, sweep: number): BufferGeometry {
  const key = shape === 'box' ? shape : shape === 'wing' ? `${shape}:${taper}:${sweep}` : shape === 'cylinder' ? `${shape}:${segments}:${taper}` : `${shape}:${segments}`;
  let geo = geometries.get(key);
  if (!geo) {
    geo =
      shape === 'box'
        ? new BoxGeometry(1, 1, 1)
        : shape === 'wing'
          ? wingGeometry(taper, sweep)
          : shape === 'cylinder'
          ? new CylinderGeometry(0.5 * taper, 0.5, 1, segments)
          : shape === 'cone'
            ? new ConeGeometry(0.5, 1, segments)
            : new SphereGeometry(0.5, segments, Math.max(2, Math.round(segments / 2)));
    geometries.set(key, geo);
  }
  return geo;
}

function partMaterial(color: string): MeshLambertMaterial {
  let mat = materials.get(color);
  if (!mat) materials.set(color, (mat = new MeshLambertMaterial({ color: new Color(color), flatShading: true })));
  return mat;
}

/**
 * Модель из описания: группа мешей-деталей. Детали подняты так, что низ модели лежит на y = 0
 * (как у примитивов), начало по X и Z — начало модели. Один вход всегда даёт одинаковую структуру.
 */
export function buildModel(model: ModelConfig, baseColor: string): Group {
  const body = new Group();
  for (const p of modelParts(model, baseColor)) {
    const mesh = new Mesh(unitGeometry(p.shape, p.segments, p.taper, p.sweep), partMaterial(p.color));
    mesh.scale.set(...p.size);
    mesh.position.set(...p.offset);
    mesh.rotation.set(...p.rotation);
    body.add(mesh);
  }
  const root = new Group();
  root.add(body);
  if (body.children.length) body.position.y = -new Box3().setFromObject(body).min.y;
  return root;
}
