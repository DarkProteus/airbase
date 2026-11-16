---
id: TASK-40
title: Вынести симулятор баланса из слоя content
status: To Do
assignee:
  - '@sonnet'
created_date: '2026-11-16T05:35:00Z'
labels:
  - model:cheap
  - size-S
  - architecture
dependencies: []
references:
  - src/content/sweep.ts
  - scripts/balance.mjs
type: chore
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ночной разбор архитектуры (2026-11-16): src/content/sweep.ts — не данные, а логика: перебор составов, расчёт экономики и вёрстка отчёта (balanceReport, ~200 строк). Правило проекта «контент = данные» (AGENTS.md) этого не допускает; sim импортировать content не может, поэтому нужен отдельный слой над обоими. Файл используют src/content/balance.test.ts и scripts/balance.mjs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Логика прогонов и отчёта живёт вне src/content (например, src/balance/); в src/content не остаётся ни одного файла с вызовами runMatch, createSim или step, кроме *.test.ts
- [ ] #2 npm run balance после переноса даёт docs/balance-0.2.md без изменений (git diff пуст)
- [ ] #3 Сторожевой тест отвергает в src/content не-тестовые файлы с вызовами runMatch/createSim/step
- [ ] #4 Слой описан в списке слоёв в AGENTS.md и CLAUDE.md; npm run check проходит
<!-- AC:END -->
