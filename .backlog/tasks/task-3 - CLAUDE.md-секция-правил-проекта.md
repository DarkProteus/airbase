---
id: TASK-3
title: 'CLAUDE.md: секция правил проекта'
status: To Do
assignee: []
created_date: '2026-11-13T06:59:00Z'
labels:
  - size-S
  - docs
dependencies:
  - TASK-1
documentation:
  - docs/design.md
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Агентам без контекста сессии нужны архитектурные правила в одном месте. CLAUDE.md создан Backlog.md — существующее содержимое не трогать, только дописать в конец.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Секция Backlog.md в CLAUDE.md не изменена (diff только добавляет строки в конец)
- [ ] #2 Новая секция ≤30 строк
- [ ] #3 Покрыто: структура папок, sim отдельно от рендера, контент = данные, детерминизм, запуск тестов, поиск через ast-grep, коммит после каждой задачи
<!-- AC:END -->
