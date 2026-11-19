---
type: C4 Component
title: Экран итога
status: stable
groma:
  id: result-screen
  parent: web-game
  code:
    - scanner: react
      file: src/ui/result/ResultScreen.tsx
    - scanner: typescript
      file: src/ui/result/ResultScreen.tsx
      symbol: ResultScreen
    - scanner: typescript
      file: src/ui/result/model.ts
  group: Screens
  technology: React
description: Исход миссии, статистика групп и волн, награда и звёзды
---

Показывает итог матча из расчётов sim, находит слабое место боя (прорвавшаяся волна или простаивавшая группа) и возвращает игрока на базу через поток экранов.
