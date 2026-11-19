---
type: C4 Component
title: Сборка моделей
status: stable
groma:
  id: model-builder
  parent: web-game
  code:
    - scanner: typescript
      file: src/render/model.ts
    - scanner: typescript
      file: src/render/preview.ts
  group: Battle rendering
  technology: Three.js
description: Строит Three.js-объекты из ModelConfig и рендерит превью карточек
---

buildModel превращает описание составной модели в группу мешей для сцены; preview.ts рендерит ту же модель тем же ракурсом в картинку для карточек через общий закадровый рендерер с кешем, без WebGL возвращает null.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/render/preview.ts](../../../../../../src/render/preview.ts) | [src/render/model.ts](../../../../../../src/render/model.ts) | Собирает модель | Three.js |
| [src/render/model.ts](../../../../../../src/render/model.ts) | [src/content/models.ts](../../../../../../src/content/models.ts) | Строит модели библиотеки | данные ModelConfig из visual конфигов, без прямого импорта |
