---
id: TASK-1
title: 'Каркас проекта: Vite + TS strict + Vitest'
status: To Do
assignee: []
created_date: '2026-11-13T06:59:00Z'
labels:
  - size-S
  - infra
dependencies: []
documentation:
  - docs/design.md
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Репозиторий пуст: нет сборки и тестового раннера, остальные задачи не на чем выполнять. Стек из design.md §6; src/sim должен оставаться без импортов Three/React/Zustand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `npm run build` (tsc + vite build) проходит без ошибок
- [ ] #2 tsconfig: strict=true, `npx tsc --noEmit` чист
- [ ] #3 `npx vitest run` запускается и проходит минимум один тест
- [ ] #4 Есть папки src/sim, src/content, src/render, src/ui, src/store; в src/sim нет импортов three/react/zustand (проверяется тестом)
<!-- AC:END -->
