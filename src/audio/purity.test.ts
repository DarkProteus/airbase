import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/** Звук читает sim, content, view и store; слои ui и render ему недоступны — по пути к файлу и по индексу. */
const FORBIDDEN = /(?:from|import)\s*\(?\s*['"](?:\.{1,2}\/)+(ui|render)(?:\/[^'"]*)?['"]/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

test('регулярное выражение ловит импорт ui/render по пути и по индексу', () => {
  expect(FORBIDDEN.test("import { shotKindOf } from '../render/effects';")).toBe(true);
  expect(FORBIDDEN.test("import { createScene } from '../render';")).toBe(true);
  expect(FORBIDDEN.test("export { x } from '../../render';")).toBe(true);
  expect(FORBIDDEN.test("import { GameView } from '../ui';")).toBe(true);
  expect(FORBIDDEN.test("import { x } from '../ui/game/Hud';")).toBe(true);
  expect(FORBIDDEN.test("const m = await import('../render/scene');")).toBe(true);
  expect(FORBIDDEN.test("import { shotKindOf } from '../view/shots';")).toBe(false);
  expect(FORBIDDEN.test("import { useGameStore } from '../store/game';")).toBe(false);
  expect(FORBIDDEN.test("import { CONTENT } from '../content';")).toBe(false);
  expect(FORBIDDEN.test("import { unlockAudio } from './synth';")).toBe(false);
});

test('src/audio (включая тесты) не импортирует слои ui и render', () => {
  const src = files('src/audio');
  expect(src.length).toBeGreaterThan(0);
  const bad = src.filter((f) => f !== join('src/audio', 'purity.test.ts') && FORBIDDEN.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
