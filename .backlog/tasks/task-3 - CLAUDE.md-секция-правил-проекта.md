---
id: TASK-3
title: 'CLAUDE.md: секция правил проекта'
status: Done
assignee:
  - '@fable'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:01:00Z'
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
- [x] #1 Секция Backlog.md в CLAUDE.md не изменена (diff только добавляет строки в конец)
- [x] #2 Новая секция ≤30 строк
- [x] #3 Покрыто: структура папок, sim отдельно от рендера, контент = данные, детерминизм, запуск тестов, поиск через ast-grep, коммит после каждой задачи
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Дописать секцию в конец CLAUDE.md, не трогая блок Backlog.md. 2. Проверить diff (только добавления) и число строк.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
В конец CLAUDE.md дописана секция «AIRBASE: правила проекта» (28 строк, diff: +29/−0, блок Backlog.md не тронут). По уточнению пользователя правило поиска: codebase-memory MCP + ast-grep.
<!-- SECTION:FINAL_SUMMARY:END -->
