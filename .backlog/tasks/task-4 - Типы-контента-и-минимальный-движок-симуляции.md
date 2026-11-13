---
id: TASK-4
title: Типы контента и минимальный движок симуляции
status: Done
assignee:
  - '@fable'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:01:00Z'
labels:
  - size-M
  - sim
dependencies:
  - TASK-1
documentation:
  - docs/design.md
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Основа для всего контента и headless-баланса (design.md §4): контент описывается данными, симуляция детерминирована (фикс. шаг, сидированный RNG) и не зависит от рендера.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Экспортируются типы UnitConfig, Modifier, Wave, MissionConfig
- [x] #2 Тест: фиксированный тик — N шагов продвигают время ровно на N*dt
- [x] #3 Тест: волны спавнят врагов по расписанию из конфига
- [x] #4 Тест: враг идёт по пути-полилинии и при достижении конца отнимает жизни базы
- [x] #5 Тест: деньги — стартовый бюджет, награда за убийство, отказ в покупке при нехватке
- [x] #6 Тест: два прогона с одним сидом дают идентичный снапшот, с разными сидами — нет
- [x] #7 Есть один юнит-заглушка как конфиг в src/content
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sim/types.ts: UnitConfig, Modifier, EnemyConfig, Wave, MissionConfig
2. sim/rng.ts (mulberry32, состояние в SimState), sim/path.ts (полилиния), sim/stats.ts (применение модификаторов)
3. sim/engine.ts: createSim/step/snapshot, расписание спавна в тиках, команды buy, damageEnemy, статус won/lost
4. content: юнит-заглушка, враг, миссия + реестры
5. Тесты по каждому критерию
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Сверх критериев: статус won/lost, applyModifiers ((база+Σadd)*Πmul), damageEnemy как точка входа для будущей боёвки. Wave.at — абсолютные секунды от старта миссии; правило старта по зачистке — TASK-6.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/sim: types (UnitConfig, Modifier, EnemyConfig, Wave, MissionConfig), rng (mulberry32 в SimState), path, stats, engine (createSim/step/snapshot, команда buy, damageEnemy), 30 тиков/с. src/content: юнит-заглушка, враг drone, миссия proto + реестры. npm run check: 15 тестов зелёные, покрыт каждый критерий.
<!-- SECTION:FINAL_SUMMARY:END -->
