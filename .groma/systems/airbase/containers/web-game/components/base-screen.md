---
type: C4 Component
title: Экран базы
status: stable
groma:
  id: base-screen
  parent: web-game
  code:
    - scanner: react
      file: src/ui/base/BaseScreen.tsx
    - scanner: typescript
      file: src/ui/base/BaseScreen.tsx
      symbol: BaseScreen
    - scanner: typescript
      file: src/ui/base/model.ts
  group: Screens
  technology: React
description: Покупка и улучшение групп, выбор состава и миссии кампании
---

Вызывает чистые операции профиля из sim и показывает причины отказа текстом; сброс прогресса с подтверждением. Карточки групп берёт из общих карточек сущностей.

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/base/BaseScreen.tsx](../../../../../../src/ui/base/BaseScreen.tsx) | [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | Invokes supplied callback: onProfile | react |
| [src/ui/base/BaseScreen.tsx](../../../../../../src/ui/base/BaseScreen.tsx) | [src/ui/flow.ts](../../../../../../src/ui/flow.ts) | Invokes supplied callback: onSortie | react |

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/base/BaseScreen.tsx](../../../../../../src/ui/base/BaseScreen.tsx) | [src/sim/profile.ts](../../../../../../src/sim/profile.ts) | Покупает и улучшает | вызов функций |
| [src/ui/base/BaseScreen.tsx](../../../../../../src/ui/base/BaseScreen.tsx) | [src/ui/entity/GroupCard.tsx](../../../../../../src/ui/entity/GroupCard.tsx) | Показывает карточки | React |
