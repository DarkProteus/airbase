import { Box3, Mesh } from 'three';
import { expect, test } from 'vitest';
import { GROUPS, MODELS } from '../content';
import type { ModelConfig } from '../sim';
import { visualOf } from '../ui/entity/model';
import { buildModel, DEFAULT_SEGMENTS, modelParts } from './model';

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
    { shape: 'box', size: [1, 0.2, 0.4], offset: [0, 0, 0], rotation: [0, 0, 0], color: '#00ff00', segments: DEFAULT_SEGMENTS },
    { shape: 'cone', size: [0.2, 0.5, 0.2], offset: [0.75, 0.1, 0], rotation: [0, 0, -Math.PI / 2], color: '#ff0000', segments: 4 },
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
