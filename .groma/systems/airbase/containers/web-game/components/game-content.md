---
type: C4 Component
title: Контент игры
status: stable
groma:
  id: game-content
  parent: web-game
  code:
    - scanner: typescript
      file: src/content/groups.ts
    - scanner: typescript
      file: src/content/enemies.ts
      symbol: ENEMIES
    - scanner: typescript
      file: src/content/missions.ts
    - scanner: typescript
      file: src/content/index.ts
      symbol: CONTENT
    - scanner: typescript
      file: src/content/profile.ts
  group: Game content
  technology: TypeScript-конфиги
description: Авиагруппы, враги, миссии и стартовый профиль как данные
---

Реестры GROUPS, ENEMIES, MISSIONS и CAMPAIGN (src/content): статы, оружие с целевыми тегами, ауры-модификаторы, улучшения со специализациями, враги с механиками (броня, малозаметность, носитель), карты, рельеф, вражеские базы и волны. В движке нет ветвлений по id — новое поведение задаётся данными. Стартовый профиль — F-16, A-10, C-130.
