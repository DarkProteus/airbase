---
type: C4 Component
title: Экран боя
status: stable
groma:
  id: battle-screen
  parent: web-game
  code:
    - scanner: react
      file: src/ui/game/GameView.tsx
    - scanner: typescript
      file: src/ui/game/GameView.tsx
      symbol: GameView
    - scanner: react
      file: src/ui/game/GroupPanel.tsx
    - scanner: typescript
      file: src/ui/game/GroupPanel.tsx
    - scanner: react
      file: src/ui/game/Hud.tsx
    - scanner: typescript
      file: src/ui/game/Hud.tsx
      symbol: Hud
    - scanner: react
      file: src/ui/game/WaveWarning.tsx
    - scanner: typescript
      file: src/ui/game/WaveWarning.tsx
      symbol: WaveWarning
    - scanner: typescript
      file: src/ui/game/driver.ts
    - scanner: typescript
      file: src/ui/game/selectors.ts
    - scanner: typescript
      file: src/store/game.ts
  group: Screens
  technology: React, Zustand, requestAnimationFrame
description: Холст карты, панель групп, HUD и предупреждение о волне; драйвер игрового цикла
---

driver.ts переводит реальное время кадра в целое число фиксированных шагов sim и публикует снапшот в store/game.ts. GameView держит сцену боя и превращает клики по карте в команды sim (зона, отзыв). Hud, GroupPanel и WaveWarning рисуют строки из чистых селекторов (selectors.ts) и боевой разметки.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/game/driver.ts](../../../../../../src/ui/game/driver.ts) | [src/sim/engine.ts](../../../../../../src/sim/engine.ts) | Шагает симуляцию | фиксированный тик, rAF |
| [src/ui/game/GameView.tsx](../../../../../../src/ui/game/GameView.tsx) | [src/render/scene.ts](../../../../../../src/render/scene.ts) | Рисует бой | Three.js canvas |
| [src/ui/game/GameView.tsx](../../../../../../src/ui/game/GameView.tsx) | [src/view/markup.ts](../../../../../../src/view/markup.ts) | Берёт разметку | вызов функций |
| [src/ui/game/GameView.tsx](../../../../../../src/ui/game/GameView.tsx) | [src/content/index.ts](../../../../../../src/content/index.ts) | Берёт контент | импорт |
