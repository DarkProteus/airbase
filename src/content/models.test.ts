import { expect, test } from 'vitest';
import { ENEMIES, GROUPS, MODELS } from '.';

const entities = [...Object.values(GROUPS), ...Object.values(ENEMIES)];

test('id модели равен ключу реестра, деталей в разумном числе', () => {
  for (const [key, m] of Object.entries(MODELS)) {
    expect(m.id).toBe(key);
    expect(m.parts.length).toBeGreaterThanOrEqual(6);
    expect(m.parts.length).toBeLessThanOrEqual(16);
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
