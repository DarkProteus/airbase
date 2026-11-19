---
type: C4 Component
title: Библиотека моделей
status: stable
groma:
  id: model-library
  parent: web-game
  code:
    - scanner: typescript
      file: src/content/models.ts
      symbol: MODELS
  group: Game content
description: Составные низкополи-модели авиагрупп и врагов как данные
---

По одной модели ModelConfig на сущность (ключ — id группы или врага): примитивы, размеры и цвета в клетках. Из этих данных строятся и игровая сцена, и превью карточек.
