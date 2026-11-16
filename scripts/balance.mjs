// Отчёт о балансе: headless-прогоны всех миссий всеми составами -> docs/balance-0.2.md. Запуск: npm run balance.
// Задачи «миссия × состав» раздаются потокам (scripts/balance-worker.mjs); порядок строк и числа от числа потоков не зависят.
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { createServer } from 'vite';

const FILE = 'docs/balance-0.2.md';
/** Всё, что ниже этой строки, перезаписывается прогоном; выше — пояснения, написанные руками. */
const MARK = '<!-- Ниже — результат `npm run balance`; не править руками. -->';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { allJobs, fullReport } = await server.ssrLoadModule('/src/balance/detail.ts');
  const { SWEEP_SEEDS } = await server.ssrLoadModule('/src/balance/sweep.ts');
  const old = readFileSync(FILE, 'utf8');
  const at = old.indexOf(MARK);
  if (at < 0) throw new Error(`${FILE}: нет строки-метки`);

  const jobs = allJobs();
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  const size = Math.max(1, Math.min(availableParallelism(), jobs.length));
  await Promise.all(
    Array.from({ length: size }, () => new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./balance-worker.mjs', import.meta.url), { workerData: { seeds: SWEEP_SEEDS } });
      const feed = () => {
        if (next >= jobs.length) return worker.postMessage('stop');
        const index = next++;
        worker.postMessage({ index, job: jobs[index] });
      };
      worker.on('message', (msg) => {
        if (msg !== 'ready') {
          results[msg.index] = msg.result;
          process.stderr.write(`\r${++done}/${jobs.length}`);
        }
        feed();
      });
      worker.on('error', reject);
      worker.on('exit', (code) => (code ? reject(new Error(`поток завершился с кодом ${code}`)) : resolve()));
    })),
  );
  process.stderr.write('\n');
  writeFileSync(FILE, `${old.slice(0, at)}${MARK}\n\n${fullReport(results, SWEEP_SEEDS)}`);
  console.log(`${FILE} обновлён`);
} finally {
  await server.close();
}
