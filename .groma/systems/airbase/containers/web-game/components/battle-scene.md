---
type: C4 Component
title: Сцена боя
status: stable
groma:
  id: battle-scene
  parent: web-game
  code:
    - scanner: typescript
      file: src/render/scene.ts
    - scanner: typescript
      file: src/render/index.ts
    - scanner: typescript
      file: src/render/auras.ts
    - scanner: typescript
      file: src/render/effects.ts
    - scanner: typescript
      file: src/render/motion.ts
    - scanner: typescript
      file: src/render/flight.ts
    - scanner: typescript
      file: src/render/coords.ts
  group: Battle rendering
  technology: Three.js
description: 'Three.js-сцена карты: читает снапшот sim и рисует юнитов, зоны, разметку и эффекты'
---

Строится из MissionConfig и облика сущностей, затем на каждом кадре читает снапшот: update(state). Фиксированная изометрическая камера (coords.ts), интерполяция между тиками (motion.ts), траектории взлёта и посадки (flight.ts), зоны аур (auras.ts), эффекты выстрелов и взрывов как данные (effects.ts), боевая разметка из моделей представления.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/render/scene.ts](../../../../../../src/render/scene.ts) | [src/view/markup.ts](../../../../../../src/view/markup.ts) | Берёт разметку | вызов функций |
| [src/render/scene.ts](../../../../../../src/render/scene.ts) | [src/render/environmentScene.ts](../../../../../../src/render/environmentScene.ts) | Строит статику | Three.js |
| [src/render/scene.ts](../../../../../../src/render/scene.ts) | [src/render/model.ts](../../../../../../src/render/model.ts) | Собирает модели | Three.js |
| [src/render/scene.ts](../../../../../../src/render/scene.ts) | [src/view/entity.ts](../../../../../../src/view/entity.ts) | Берёт облик | вызов функций |
| [src/render/scene.ts](../../../../../../src/render/scene.ts) | [src/sim/engine.ts](../../../../../../src/sim/engine.ts) | Читает снапшот | снапшот SimState |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/render/scene.ts](../../../../../../src/render/scene.ts) | [src/ui/game/GameView.tsx](../../../../../../src/ui/game/GameView.tsx) | Invokes supplied callback: onMapClick | typescript |
