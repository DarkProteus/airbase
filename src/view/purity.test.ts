import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/** Слой view — чистые модели представления: без three/react/zustand и без слоёв render/ui/store (по пути и по индексу). */
const FORBIDDEN =
  /(?:from|import)\s*\(?\s*['"](?:(?:three|react|react-dom|zustand)(?:\/[^'"]*)?|(?:\.{1,2}\/)+(?:render|ui|store)(?:\/[^'"]*)?)['"]/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

test('регулярное выражение ловит запрещённые импорты view', () => {
  expect(FORBIDDEN.test("import * as THREE from 'three';")).toBe(true);
  expect(FORBIDDEN.test("import { useState } from 'react';")).toBe(true);
  expect(FORBIDDEN.test("import { create } from 'zustand/vanilla';")).toBe(true);
  expect(FORBIDDEN.test("import { scene } from '../render';")).toBe(true);
  expect(FORBIDDEN.test("import { x } from '../render/scene';")).toBe(true);
  expect(FORBIDDEN.test("import { x } from '../ui';")).toBe(true);
  expect(FORBIDDEN.test("import { x } from '../store/gallery';")).toBe(true);
  expect(FORBIDDEN.test("import { createSim } from '../sim';")).toBe(false);
  expect(FORBIDDEN.test("import { CONTENT } from '../content';")).toBe(false);
});

test('src/view (включая тесты) не импортирует three/react/zustand и слои render/ui/store', () => {
  const src = files('src/view');
  expect(src.length).toBeGreaterThan(0);
  const bad = src.filter((f) => f !== join('src/view', 'purity.test.ts') && FORBIDDEN.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
