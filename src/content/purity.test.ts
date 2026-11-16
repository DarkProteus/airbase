import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/** Контент — данные: прогоны матча (runMatch/createSim/step) живут в src/balance, не здесь. */
const SIM_CALL = /\b(runMatch|createSim|step)\s*\(/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

test('регулярное выражение ловит вызовы прогона матча', () => {
  expect(SIM_CALL.test('const r = runMatch(content, mission);')).toBe(true);
  expect(SIM_CALL.test('const s = createSim (content, mission);')).toBe(true);
  expect(SIM_CALL.test('step(sim, []);')).toBe(true);
  expect(SIM_CALL.test('const next = stepper + 1; // data')).toBe(false);
});

test('src/content не вызывает runMatch/createSim/step вне тестов', () => {
  const src = files('src/content').filter((f) => !f.endsWith('.test.ts'));
  expect(src.length).toBeGreaterThan(0);
  const bad = src.filter((f) => SIM_CALL.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
