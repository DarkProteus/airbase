---
type: C4 Component
title: Запуск прогона
status: stable
groma:
  id: balance-runner
  parent: balance-cli
  code:
    - scanner: javascript
      file: scripts/balance.mjs
    - scanner: javascript
      file: scripts/balance-worker.mjs
  technology: Node.js worker_threads
description: Раздаёт задачи потокам и записывает отчёт в docs/balance-0.2.md
---

scripts/balance.mjs поднимает Vite в middleware-режиме, берёт список задач и генератор отчёта из сводок баланса, запускает воркеры (scripts/balance-worker.mjs) по числу ядер и склеивает их результаты в порядке задач, так что отчёт не зависит от числа потоков.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [scripts/balance.mjs](../../../../../../scripts/balance.mjs) | [src/balance/detail.ts](../../../../../../src/balance/detail.ts) | Строит отчёт | Vite SSR, worker_threads |
