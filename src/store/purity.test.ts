import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const sources = () =>
  readdirSync('src/store')
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => ({ file: join('src/store', f), text: readFileSync(join('src/store', f), 'utf8') }));

const importLines = (text: string) => text.split('\n').filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));

test('store импортирует из sim/content только типы: ни движка, ни команд', () => {
  const bad = sources().flatMap(({ file, text }) =>
    importLines(text)
      .filter((l) => /from\s+['"][^'"]*\/(sim|content|render|ui)(\/[^'"]*)?['"]/.test(l) && !/^\s*(import|export)\s+type\b/.test(l))
      .map((l) => `${file}: ${l.trim()}`),
  );
  expect(sources().length).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

test('в store нет вызовов мутаций матча и драйвера', () => {
  const MUTATION = /\b(createSim|step|applyCommand|damageEnemy|startGame|dispatch|buyRejection|upgradeRejection|sellRefund)\s*\(|type:\s*['"](buy|upgrade|sell)['"]/;
  const bad = sources().filter(({ text }) => MUTATION.test(text)).map((s) => s.file);
  expect(bad).toEqual([]);
});
