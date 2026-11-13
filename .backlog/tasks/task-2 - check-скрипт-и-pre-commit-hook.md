---
id: TASK-2
title: check-скрипт и pre-commit hook
status: To Do
assignee: []
created_date: '2026-11-13T06:59:00Z'
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
- [ ] #1 `npm run check` = `tsc --noEmit` + `vitest run`, ненулевой код выхода при ошибке любого из них
- [ ] #2 git pre-commit hook запускает `npm run check` и блокирует коммит при падении
- [ ] #3 Хук версионируется в репозитории и подключается автоматически после `npm install`
<!-- AC:END -->
