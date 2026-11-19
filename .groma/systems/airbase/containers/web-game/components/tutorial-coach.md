---
type: C4 Component
title: Обучение
status: stable
groma:
  id: tutorial-coach
  parent: web-game
  code:
    - scanner: react
      file: src/ui/tutorial/Tutorial.tsx
    - scanner: typescript
      file: src/ui/tutorial/Tutorial.tsx
    - scanner: typescript
      file: src/ui/tutorial/machine.ts
  group: Screens
  technology: React
description: Подсказки первого вылета как чистый автомат шагов
---

machine.ts — автомат (состояние, вход) → состояние; шаги-данные завершаются действиями игрока в бою. Tutorial.tsx — универсальная плашка шага. Обучение не показывается после первого доигранного вылета.

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/tutorial/Tutorial.tsx](../../../../../../src/ui/tutorial/Tutorial.tsx) | [src/ui/App.tsx](../../../../../../src/ui/App.tsx) | Invokes supplied callback: onFinish | react |
