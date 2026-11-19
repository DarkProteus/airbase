import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/** Sim — нижний слой: без three/react/zustand и без слоёв render/ui/store/view/balance (по пути к файлу и по индексу). */
const FORBIDDEN =
  /(?:from|import)\s*\(?\s*['"](?:(?:three|react|react-dom|zustand)(?:\/[^'"]*)?|(?:\.\.\/)+(?:render|ui|store|view|balance)(?:\/[^'"]*)?)['"]/;

test.each([
  "import * as THREE from 'three';",
  "import { useState } from 'react';",
  "import { create } from 'zustand/vanilla';",
  "import { x } from '../render';",
  "import { x } from '../render/x';",
  "export { x } from '../../ui';",
  "import { x } from '../ui/game/markup';",
  "import { useStore } from '../store';",
  "import { s } from '../store/game';",
  "import { x } from '../view';",
  "import { x } from '../view/markup';",
  "import { x } from '../balance';",
  "import { x } from '../balance/report';",
  "const m = await import('../render/scene');",
])('регулярное выражение ловит запрещённый импорт: %s', (line) => {
  expect(FORBIDDEN.test(line)).toBe(true);
});

test.each([
  "import { rng } from './rng';",
  "import type { SimState } from './types';",
  "import { x } from '../content';",
  "import { x } from './render';",
  "const renderer = 1; // render",
])('регулярное выражение пропускает допустимое: %s', (line) => {
  expect(FORBIDDEN.test(line)).toBe(false);
});

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

test('src/sim не импортирует three/react/zustand и слои render/ui/store/view/balance', () => {
  const sim = files('src/sim').filter((f) => !f.endsWith('.test.ts'));
  expect(sim.length).toBeGreaterThan(0);
  const bad = sim.filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});

test('sim не читает облик: visual и модели встречаются только в типах', () => {
  const sim = files('src/sim').filter((f) => !f.endsWith('.test.ts') && !f.endsWith('types.ts'));
  const bad = sim.filter((f) => /\bvisual\b|\bModel(Config|Part)\b/.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
