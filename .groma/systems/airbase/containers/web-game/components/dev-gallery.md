---
type: C4 Component
title: Dev-галерея
status: stable
groma:
  id: dev-gallery
  parent: web-game
  code:
    - scanner: react
      file: src/ui/gallery/GalleryPage.tsx
    - scanner: typescript
      file: src/ui/gallery/GalleryPage.tsx
      symbol: GalleryPage
    - scanner: typescript
      file: src/ui/gallery/catalog.ts
    - scanner: typescript
      file: src/store/gallery.ts
      symbol: useGalleryStore
  group: Screens
  technology: React, Zustand
description: 'Страница /gallery: всё содержимое реестров контента с песочницей улучшений и аур'
---

Отдельный чанк для разработчика: карточки и превью каждой группы и врага, ползунки уровней и специализаций, переключатели тегов и источников аур «что-если». Состояние — только UI в store/gallery.ts.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/gallery/GalleryPage.tsx](../../../../../../src/ui/gallery/GalleryPage.tsx) | [src/ui/entity/GroupCard.tsx](../../../../../../src/ui/entity/GroupCard.tsx) | Показывает карточки | React |
