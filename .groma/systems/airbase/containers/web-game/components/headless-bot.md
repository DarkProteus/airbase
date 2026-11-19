---
type: C4 Component
title: Headless-бот
status: stable
groma:
  id: headless-bot
  parent: web-game
  code:
    - scanner: typescript
      file: src/sim/bot.ts
  group: Match simulation
description: Играет матч без UI для тестов и баланса
---

runMatch и стратегия бота двигают зоны групп по ходу матча и возвращают сводку (награда, остаток цели, вылеты). Используется тестами миссий и прогоном баланса; в браузерной игре не вызывается, но экспортируется из src/sim.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/sim/bot.ts](../../../../../../src/sim/bot.ts) | [src/sim/engine.ts](../../../../../../src/sim/engine.ts) | Шагает матч | вызов функций |
