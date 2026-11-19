---
type: C4 Component
title: Оболочка приложения
status: stable
groma:
  id: app-shell
  parent: web-game
  code:
    - scanner: react
      file: src/ui/App.tsx
    - scanner: typescript
      file: src/ui/App.tsx
      symbol: App
    - scanner: react
      file: src/main.tsx
    - scanner: typescript
      file: src/main.tsx
    - scanner: typescript
      file: src/ui/route.ts
      symbol: isGalleryPath
    - scanner: react
      file: src/ui/flow.ts
    - scanner: typescript
      file: src/ui/flow.ts
    - scanner: typescript
      file: src/ui/save.ts
    - scanner: typescript
      file: src/store/flow.ts
      symbol: useFlowStore
  group: Screens
  technology: React, Zustand
description: Вход SPA, маршрут галереи, поток экранов и запись сохранения
---

main.tsx монтирует React и выбирает игру или ленивый чанк галереи по пути. App.tsx показывает экран по текущему потоку; ui/flow.ts применяет события через flowStep из sim и сохраняет профиль в localStorage (ui/save.ts, единственная точка записи); store/flow.ts только хранит поток.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/main.tsx](../../../../../../src/main.tsx) | [src/ui/gallery/GalleryPage.tsx](../../../../../../src/ui/gallery/GalleryPage.tsx) | Открывает галерею | динамический import |
| [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | [src/ui/game/GameView.tsx](../../../../../../src/ui/game/GameView.tsx) | Показывает бой | React |
| [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | [src/ui/base/BaseScreen.tsx](../../../../../../src/ui/base/BaseScreen.tsx) | Показывает базу | React |
| [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | [src/ui/result/ResultScreen.tsx](../../../../../../src/ui/result/ResultScreen.tsx) | Показывает итог | React |
| [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | [src/ui/tutorial/Tutorial.tsx](../../../../../../src/ui/tutorial/Tutorial.tsx) | Показывает обучение | React |
| [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | [src/audio/SoundToggle.tsx](../../../../../../src/audio/SoundToggle.tsx) | Включает звук | React |
| [src/ui/flow.ts](../../../../../../src/ui/flow.ts) | [src/sim/flow.ts](../../../../../../src/sim/flow.ts) | Переключает экраны | вызов функций |
