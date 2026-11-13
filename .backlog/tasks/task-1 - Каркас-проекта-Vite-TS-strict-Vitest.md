---
id: TASK-1
title: 'Каркас проекта: Vite + TS strict + Vitest'
status: Done
assignee:
  - '@fable'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:00:00Z'
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
- [x] #1 `npm run build` (tsc + vite build) проходит без ошибок
- [x] #2 tsconfig: strict=true, `npx tsc --noEmit` чист
- [x] #3 `npx vitest run` запускается и проходит минимум один тест
- [x] #4 Есть папки src/sim, src/content, src/render, src/ui, src/store; в src/sim нет импортов three/react/zustand (проверяется тестом)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json + зависимости (vite, ts, vitest, three, react, zustand)
2. tsconfig strict, vite.config с vitest
3. Папки src/{sim,content,render,ui,store}, минимальный main.tsx
4. Тест архитектуры: src/sim без импортов three/react/zustand
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Vite 8 + TS strict + Vitest 5, React/Three/Zustand установлены. Папки src/{sim,content,render,ui,store}. src/sim/purity.test.ts сторожит границу sim. Проверено: npm run build, tsc --noEmit, vitest run — зелёные.
<!-- SECTION:FINAL_SUMMARY:END -->
