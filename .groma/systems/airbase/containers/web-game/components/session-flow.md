---
type: C4 Component
title: Поток экранов
status: stable
groma:
  id: session-flow
  parent: web-game
  code:
    - scanner: typescript
      file: src/sim/flow.ts
  group: Match simulation
description: Чистый автомат сессии база → бой → итог → база и кампания
---

flowStep принимает событие сессии (начать бой, матч окончен, вернуться на базу) и возвращает новое состояние потока вместе с профилем, начисляя награду и звёзды через расчёты итога. React и store только хранят результат.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/sim/flow.ts](../../../../../../src/sim/flow.ts) | [src/sim/reward.ts](../../../../../../src/sim/reward.ts) | Начисляет награду | вызов функций |
| [src/sim/flow.ts](../../../../../../src/sim/flow.ts) | [src/sim/profile.ts](../../../../../../src/sim/profile.ts) | Проверяет вылет | вызов функций |
