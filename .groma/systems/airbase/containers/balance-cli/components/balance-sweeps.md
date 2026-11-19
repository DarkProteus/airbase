---
type: C4 Component
title: Сводки баланса
status: stable
groma:
  id: balance-sweeps
  parent: balance-cli
  code:
    - scanner: typescript
      file: src/balance/sweep.ts
    - scanner: typescript
      file: src/balance/detail.ts
description: Прогоняет миссии ботом и строит таблицы отчёта и условия теста баланса
---

sweep.ts — базовый перебор всех миссий кампании всеми составами на сидах SWEEP_SEEDS; из него берут данные тест баланса и отчёт. detail.ts — расширенные задачи «миссия × состав» со статистикой матча: вклад групп, врагов и улучшений, доход экономических групп, максимальный уровень, и сборка Markdown-таблиц.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/balance/sweep.ts](../../../../../../src/balance/sweep.ts) | [src/sim/bot.ts](../../../../../../src/sim/bot.ts) | Играет миссии ботом | вызов функций |
| [src/balance/detail.ts](../../../../../../src/balance/detail.ts) | [src/sim/engine.ts](../../../../../../src/sim/engine.ts) | Шагает матчи | вызов функций |
| [src/balance/sweep.ts](../../../../../../src/balance/sweep.ts) | [src/content/index.ts](../../../../../../src/content/index.ts) | Читает кампанию | импорт |
