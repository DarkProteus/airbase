---
id: TASK-2
title: check-скрипт и pre-commit hook
status: Done
assignee:
  - '@fable'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:00:00Z'
labels:
  - size-S
  - infra
dependencies:
  - TASK-1
documentation:
  - docs/design.md
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Агенты коммитят после каждой задачи; без единой команды проверки и хука сломанные типы и тесты попадают в историю.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `npm run check` = `tsc --noEmit` + `vitest run`, ненулевой код выхода при ошибке любого из них
- [x] #2 git pre-commit hook запускает `npm run check` и блокирует коммит при падении
- [x] #3 Хук версионируется в репозитории и подключается автоматически после `npm install`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. npm script check = tsc --noEmit && vitest run
2. .githooks/pre-commit → npm run check
3. prepare-скрипт: git config core.hooksPath .githooks
4. Проверить блокировку коммита на сломанном типе
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
npm run check = tsc --noEmit && vitest run. Хук .githooks/pre-commit версионируется, подключается через npm prepare (core.hooksPath). Проверено: коммит с ошибкой типа отклонён (exit 1), чистый check проходит.
<!-- SECTION:FINAL_SUMMARY:END -->
