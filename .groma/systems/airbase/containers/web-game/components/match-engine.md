---
type: C4 Component
title: Движок матча
status: stable
groma:
  id: match-engine
  parent: web-game
  code:
    - scanner: typescript
      file: src/sim/engine.ts
    - scanner: typescript
      file: src/sim/types.ts
    - scanner: typescript
      file: src/sim/rng.ts
      symbol: rngNext
    - scanner: typescript
      file: src/sim/stats.ts
      symbol: applyModifiers
    - scanner: typescript
      file: src/sim/index.ts
    - scanner: typescript
      file: src/sim/objective.ts
    - scanner: typescript
      file: src/sim/tally.ts
  group: Match simulation
  technology: TypeScript (без зависимостей)
description: 'Детерминированный тик матча: волны, враги, цель, модификаторы и типы'
---

Ядро src/sim: типы конфигов и состояния (types.ts), шаг матча с фиксированным тиком (engine.ts), спавн волн с вражеских баз, движение врагов к цели, урон и гибель, цель миссии defend/escort (objective.ts), расчёт статов из модификаторов (stats.ts: (база + Σadd) · Πmul), сидированный RNG mulberry32 в состоянии и счётчики групп за матч (tally.ts). Без Math.random, Date.now и импортов рендера/UI. Матч мутируется только командами sim.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/sim/engine.ts](../../../../../../src/sim/engine.ts) | [src/sim/sortie.ts](../../../../../../src/sim/sortie.ts) | Ведёт вылеты групп | вызов функций |
| [src/sim/engine.ts](../../../../../../src/sim/engine.ts) | [src/sim/terrain.ts](../../../../../../src/sim/terrain.ts) | Прокладывает маршруты врагов | вызов функций |
