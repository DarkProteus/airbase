---
type: C4 Container
title: Прогон баланса
status: stable
groma:
  id: balance-cli
  parent: airbase
  technology: Node.js, worker_threads, Vite SSR
description: 'Node-CLI npm run balance: бот играет все миссии всеми составами и переписывает отчёт'
---

Запускается разработчиком командой npm run balance (и теми же функциями — тестом src/balance/balance.test.ts). Загружает TS-модули через Vite SSR, раздаёт задачи «миссия × состав» потокам и перезаписывает часть docs/balance-0.2.md ниже строки-метки. Играет через headless-бота и движок симуляции из контейнера игры; результаты детерминированы при фиксированных сидах.
