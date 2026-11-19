---
type: C4 Component
title: Боевая разметка
status: stable
groma:
  id: battle-markup
  parent: web-game
  code:
    - scanner: typescript
      file: src/view/markup.ts
    - scanner: typescript
      file: src/view/shots.ts
    - scanner: typescript
      file: src/view/terrain.ts
  group: Presentation models
description: 'Чистые функции разметки боя: метки врагов, линии атак, предупреждение о волне, вид выстрела, цвета рельефа'
---

Из снапшота sim и конфигов считает, что пометить на карте и в панелях: тип цели по тегам, кто кого атакует, ближайшая волна. shots.ts определяет вид выстрела по данным оружия (общий для сцены и звука), terrain.ts — единственная палитра цветов преград для мешей и легенды.
