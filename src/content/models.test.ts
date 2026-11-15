import { expect, test } from 'vitest';
import { ENEMIES, GROUPS, MODELS } from '.';

const entities = [...Object.values(GROUPS), ...Object.values(ENEMIES)];

test('id модели равен ключу реестра, деталей в разумном числе', () => {
  for (const [key, m] of Object.entries(MODELS)) {
    expect(m.id).toBe(key);
    expect(m.parts.length).toBeGreaterThanOrEqual(6);
    expect(m.parts.length).toBeLessThanOrEqual(24);
  }
});

test.each(entities)('сущность $id ссылается на модель из реестра', (e) => {
  expect(e.visual?.model).toBeDefined();
  expect(Object.values(MODELS)).toContain(e.visual!.model);
  expect(MODELS[e.id as keyof typeof MODELS]).toBe(e.visual!.model);
});

test('нет моделей-сирот и одну модель не делят две сущности', () => {
  const used = entities.map((e) => e.visual?.model);
  for (const m of Object.values(MODELS)) expect(used.filter((u) => u === m)).toHaveLength(1);
});

test('консоли wing: ненулевые хорда и размах, сужение в пределах 0..1; сужение и стреловидность заданы только там, где работают', () => {
  for (const m of Object.values(MODELS)) {
    for (const p of m.parts) {
      if (p.taper !== undefined) {
        expect(['wing', 'cylinder'], m.id).toContain(p.shape);
        expect(p.taper, m.id).toBeGreaterThanOrEqual(0);
        expect(p.taper, m.id).toBeLessThanOrEqual(1);
      }
      if (p.sweep !== undefined) expect(p.shape, m.id).toBe('wing');
      if (p.shape === 'wing') {
        expect(p.size[0], m.id).toBeGreaterThan(0);
        expect(Math.abs(p.size[2]), m.id).toBeGreaterThan(0);
      }
    }
  }
});

test('у каждой авиагруппы крылья — парные консоли wing: правая и зеркальная левая', () => {
  for (const g of Object.values(GROUPS)) {
    const wings = g.visual!.model!.parts.filter((p) => p.shape === 'wing' && !p.rotation?.[0]);
    expect(wings.filter((p) => p.size[2] > 0).length, g.id).toBeGreaterThanOrEqual(1);
    expect(wings.filter((p) => p.size[2] > 0).length, g.id).toBe(wings.filter((p) => p.size[2] < 0).length);
  }
});
