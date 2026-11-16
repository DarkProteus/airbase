// Поток-исполнитель `npm run balance`: берёт задачу «миссия × состав», возвращает результат прогонов. Сам по себе не запускается.
import { parentPort, workerData } from 'node:worker_threads';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { runJob } = await server.ssrLoadModule('/src/balance/detail.ts');
parentPort.on('message', (msg) => {
  if (msg === 'stop') {
    server.close().then(() => process.exit(0));
    return;
  }
  parentPort.postMessage({ index: msg.index, result: runJob(msg.job, workerData.seeds) });
});
parentPort.postMessage('ready');
