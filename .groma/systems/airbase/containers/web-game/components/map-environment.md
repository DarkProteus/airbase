---
type: C4 Component
title: Окружение карты
status: stable
groma:
  id: map-environment
  parent: web-game
  code:
    - scanner: typescript
      file: src/render/environment.ts
    - scanner: typescript
      file: src/render/environmentScene.ts
    - scanner: typescript
      file: src/render/props.ts
  group: Battle rendering
  technology: Three.js
description: 'Раскладка и меши статики карты: земля, аэродром, ворота, рельеф, декор'
---

environment.ts — чистые детерминированные функции раскладки окружения из MissionConfig; environmentScene.ts собирает из неё меши (полупрозрачные хребты, цвета преград из общей палитры); props.ts — модели окружения в формате buildModel.
