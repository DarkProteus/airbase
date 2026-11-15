// Отчёт о балансе: headless-прогоны всех миссий всеми составами -> docs/balance-0.2.md. Запуск: npm run balance.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const FILE = 'docs/balance-0.2.md';
/** Всё, что ниже этой строки, перезаписывается прогоном; выше — пояснения, написанные руками. */
const MARK = '<!-- Ниже — результат `npm run balance`; не править руками. -->';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { balanceReport } = await server.ssrLoadModule('/src/content/sweep.ts');
  const old = readFileSync(FILE, 'utf8');
  const at = old.indexOf(MARK);
  if (at < 0) throw new Error(`${FILE}: нет строки-метки`);
  writeFileSync(FILE, `${old.slice(0, at)}${MARK}\n\n${balanceReport()}`);
  console.log(`${FILE} обновлён`);
} finally {
  await server.close();
}
