import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/** Рендер читает снапшот sim и чистые модели из src/view; слои ui и store ему недоступны — по пути к файлу и по индексу. */
const FORBIDDEN = /(?:from|import)\s*\(?\s*['"](?:\.{1,2}\/)+(ui|store)(?:\/[^'"]*)?['"]/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

test('регулярное выражение ловит импорт ui/store по пути и по индексу', () => {
  expect(FORBIDDEN.test("import { visualOf } from '../ui/entity/model';")).toBe(true);
  expect(FORBIDDEN.test("import { GameView } from '../ui';")).toBe(true);
  expect(FORBIDDEN.test("export { x } from '../../ui';")).toBe(true);
  expect(FORBIDDEN.test("import { useStore } from '../store';")).toBe(true);
  expect(FORBIDDEN.test("import { s } from '../store/gallery';")).toBe(true);
  expect(FORBIDDEN.test("const m = await import('../ui/game/markup');")).toBe(true);
  expect(FORBIDDEN.test("import { visualOf } from '../view/entity';")).toBe(false);
  expect(FORBIDDEN.test("import { buildModel } from './model';")).toBe(false);
});

test('src/render (включая тесты) не импортирует слои ui и store', () => {
  const src = files('src/render');
  expect(src.length).toBeGreaterThan(0);
  const bad = src.filter((f) => f !== join('src/render', 'purity.test.ts') && FORBIDDEN.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
