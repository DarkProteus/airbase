---
type: C4 Component
title: Карточки сущностей
status: stable
groma:
  id: entity-cards
  parent: web-game
  code:
    - scanner: react
      file: src/ui/entity/EntityCard.tsx
    - scanner: typescript
      file: src/ui/entity/EntityCard.tsx
      symbol: EntityCard
    - scanner: react
      file: src/ui/entity/EntityPreview.tsx
    - scanner: typescript
      file: src/ui/entity/EntityPreview.tsx
      symbol: EntityPreview
    - scanner: react
      file: src/ui/entity/GroupCard.tsx
    - scanner: typescript
      file: src/ui/entity/GroupCard.tsx
      symbol: GroupCard
    - scanner: react
      file: src/ui/entity/RoleIcon.tsx
    - scanner: typescript
      file: src/ui/entity/RoleIcon.tsx
      symbol: RoleIcon
    - scanner: typescript
      file: src/ui/entity/roleIcons.ts
  group: Screens
  technology: React, SVG
description: Универсальные карточки групп и врагов с превью и значком роли
---

Строятся только из конфигов: обобщённая карточка выводит все поля, карточка группы — статы с улучшениями и действия базы. Превью — картинка составной модели из рендера или SVG-примитив без WebGL; значки ролей — таблица контуров.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/entity/GroupCard.tsx](../../../../../../src/ui/entity/GroupCard.tsx) | [src/view/entity.ts](../../../../../../src/view/entity.ts) | Считает статы | вызов функций |
| [src/ui/entity/EntityPreview.tsx](../../../../../../src/ui/entity/EntityPreview.tsx) | [src/render/preview.ts](../../../../../../src/render/preview.ts) | Рендерит превью | WebGL offscreen |
