---
type: C4 Component
title: Итог и награда
status: stable
groma:
  id: match-reward
  parent: web-game
  code:
    - scanner: typescript
      file: src/sim/reward.ts
  group: Match simulation
description: Считает исход матча, звёзды и валюту за вылет
---

Из завершённого матча собирает итог: исход по цели, остаток прочности, убийства, завершённые вылеты и бонусы групп (income), звёзды кампании и открытие миссий. Им пользуются поток экранов, экран итога и сводки баланса.
