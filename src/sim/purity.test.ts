import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const FORBIDDEN = /from\s+['"](three|react|react-dom|zustand)(\/[^'"]*)?['"]|from\s+['"][^'"]*\/(render|ui|store)\//;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

test('src/sim не импортирует three/react/zustand и слои render/ui/store', () => {
  const sim = files('src/sim').filter((f) => !f.endsWith('.test.ts'));
  expect(sim.length).toBeGreaterThan(0);
  const bad = sim.filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
