import { Box3, Mesh } from 'three';
import { expect, test } from 'vitest';
import { GROUPS, MODELS } from '../content';
import type { ModelConfig } from '../sim';
import { visualOf } from '../ui/entity/model';
import { buildModel, DEFAULT_SEGMENTS, modelParts, wingGeometry } from './model';

const model: ModelConfig = {
  id: 't',
  parts: [
    { shape: 'box', size: [1, 0.2, 0.4] },
    { shape: 'cone', size: [0.2, 0.5, 0.2], offset: [0.75, 0.1, 0], rotation: [0, 0, -90], color: '#FF0000', segments: 4 },
  ],
};

test('modelParts: умолчания, радианы, цвет сущности; вход не меняется', () => {
  const before = JSON.stringify(model);
  const parts = modelParts(model, '#00ff00');
  expect(parts).toEqual([
    { shape: 'box', size: [1, 0.2, 0.4], offset: [0, 0, 0], rotation: [0, 0, 0], color: '#00ff00', segments: DEFAULT_SEGMENTS, taper: 1, sweep: 0 },
    { shape: 'cone', size: [0.2, 0.5, 0.2], offset: [0.75, 0.1, 0], rotation: [0, 0, -Math.PI / 2], color: '#ff0000', segments: 4, taper: 1, sweep: 0 },
  ]);
  expect(JSON.stringify(model)).toBe(before);
  expect(modelParts(model, '#00ff00')).toEqual(parts);
  parts[0]!.size[0] = 99;
  expect(model.parts[0]!.size[0]).toBe(1);
});

const shapeOf = (m: ModelConfig, color: string) => {
  const root = buildModel(m, color);
  root.updateMatrixWorld(true);
  const out: unknown[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push({ m: o.matrixWorld.toArray().map((x) => +x.toFixed(6)), c: o.material.color.getHexString(), g: o.geometry.type });
  });
  return { out, root };
};

test('buildModel: по мешу на деталь, тот же вход — та же структура, низ модели на земле', () => {
  const a = shapeOf(model, '#00ff00');
  const b = shapeOf(model, '#00ff00');
  expect(a.out).toHaveLength(model.parts.length);
  expect(a.out).toEqual(b.out);
  expect(a.out.map((p) => (p as { c: string }).c)).toEqual(['00ff00', 'ff0000']);
  const box = new Box3().setFromObject(a.root);
  expect(box.min.y).toBeCloseTo(0, 6);
  // Конус повёрнут носом по +X: модель длиннее вперёд, чем назад.
  expect(box.max.x).toBeCloseTo(1, 6);
  expect(box.min.x).toBeCloseTo(-0.5, 6);
});

test('облик ссылается на модель из реестра; без модели остаётся примитив', () => {
  const withModel = Object.values(GROUPS).filter((g) => g.visual?.model);
  expect(withModel.length).toBeGreaterThan(0);
  for (const g of withModel) {
    expect(Object.values(MODELS)).toContain(g.visual!.model);
    expect(visualOf(g).model).toBe(g.visual!.model);
  }
  const plain = visualOf({ tags: ['ground'], visual: { shape: 'cube', color: '#123456' } });
  expect(plain.model).toBeUndefined();
  expect(plain.shape).toBe('cube');
});

test('все модели реестра собираются и имеют ненулевой размер', () => {
  for (const [key, m] of Object.entries(MODELS)) {
    expect(m.id).toBe(key);
    const box = new Box3().setFromObject(buildModel(m, '#ffffff'));
    expect(box.max.x - box.min.x).toBeGreaterThan(0.1);
    expect(box.max.y - box.min.y).toBeGreaterThan(0.05);
  }
});

test('wingGeometry: трапеция от корня к законцовке, нормали наружу', () => {
  const geo = wingGeometry(0.5, 0.4);
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  // Корень: хорда 1 на z = 0; законцовка: хорда 0,5 на z = 1, сдвинута назад на 0,4.
  expect([box.min.z, box.max.z]).toEqual([0, 1]);
  expect(box.max.x).toBeCloseTo(0.5, 6);
  expect(box.min.x).toBeCloseTo(-0.65, 6);
  expect([box.min.y, box.max.y]).toEqual([-0.5, 0.5]);
  // Каждая грань смотрит от центра консоли: иначе её отсечёт рендер.
  const pos = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  expect(pos.count).toBe(36);
  for (let i = 0; i < pos.count; i += 3) {
    const centre = [0, 1, 2].map((k) => (pos.getComponent(i, k) + pos.getComponent(i + 1, k) + pos.getComponent(i + 2, k)) / 3);
    const out = centre[0]! * normal.getX(i) + centre[1]! * normal.getY(i) + (centre[2]! - 0.5) * normal.getZ(i);
    expect(out, `грань ${i / 3}`).toBeGreaterThan(0);
  }
});

test('buildModel: отрицательный размах зеркалит консоль, сужение цилиндра даёт усечённый конус', () => {
  const wing = (span: number): ModelConfig => ({ id: 'w', parts: [{ shape: 'wing', size: [0.4, 0.02, span], taper: 0.5, sweep: 0.5 }] });
  const right = new Box3().setFromObject(buildModel(wing(0.6), '#ffffff'));
  const left = new Box3().setFromObject(buildModel(wing(-0.6), '#ffffff'));
  expect(right.min.z).toBeCloseTo(0, 6);
  expect(right.max.z).toBeCloseTo(0.6, 6);
  expect(left.min.z).toBeCloseTo(-0.6, 6);
  expect(left.max.z).toBeCloseTo(0, 6);
  expect(left.min.x).toBeCloseTo(right.min.x, 6);
  expect(modelParts({ id: 'c', parts: [{ shape: 'cylinder', size: [1, 1, 1], taper: 3 }] }, '#fff')[0]!.taper).toBe(1);
  const cone = buildModel({ id: 'c', parts: [{ shape: 'cylinder', size: [1, 1, 1], taper: 0.25 }] }, '#ffffff');
  let radii: number[] = [];
  cone.traverse((o) => {
    if (o instanceof Mesh) radii = [o.geometry.parameters.radiusTop, o.geometry.parameters.radiusBottom];
  });
  expect(radii).toEqual([0.125, 0.5]);
});
