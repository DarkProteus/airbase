---
id: TASK-16
title: 'Экран базы: покупка, улучшение, выбор 3 групп на вылет'
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T07:48:00Z'
updated_date: '2026-11-13T23:21:00Z'
labels:
  - size-M
  - ui
  - meta
  - mvp
dependencies:
  - TASK-15
documentation:
  - docs/design.md
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Экономика переезжает из боя на базу (design.md §1, §5): между миссиями игрок покупает и улучшает авиагруппы за заработанную валюту и выбирает три из них на вылет. Правила цен и уровней из TASK-9 переиспользуются, а не пишутся заново.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Профиль игрока (валюта, купленные группы, их уровни, выбранный состав) и операции над ним — чистый модуль без React/Zustand/Three, стартовый профиль задан данными
- [x] #2 Тест: покупка и улучшение списывают валюту; отказ при нехватке, повторной покупке и максимальном уровне
- [x] #3 Тест: в состав можно выбрать только купленные группы, ровно 3; вылет недоступен при неполном составе
- [x] #4 Тест: уровень улучшения меняет боевые параметры группы в бою (модификаторы уровней из конфига)
- [x] #5 Экран строится из реестра групп универсальной карточкой; недоступные действия отключены, причина отказа показана
- [x] #6 В браузере: купить группу, улучшить её, собрать состав из 3
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/sim/profile.ts (чистый): Profile {currency, levels: Record<id, level>, lineup: id[]}; проверки buyRejection/upgradeRejection/lineupRejection/sortieRejection (образец — zoneRejection) и операции buyGroup/upgradeGroup/toggleLineup поверх цен из economy.ts; profileLineup(profile, zones) -> LineupEntry[].
2. src/content/profile.ts: START_PROFILE данными (f16 и a10 куплены, 200 валюты, состав неполный) + DEFAULT_ZONES по слотам вместо DEFAULT_LINEUP.
3. Тесты рядом: покупка/улучшение/отказы, состав ровно 3 из купленных, уровень из профиля меняет боевые параметры в createSim.
4. src/store/profile.ts: только хранение профиля (типы), без логики.
5. src/ui/base: BaseScreen из реестра GROUPS на GroupCard (слот действий), кнопки отключены с показанной причиной; тексты причин — чистая модель с тестом.
6. App: по умолчанию база, «На вылет» запускает бой с составом профиля; ?mission= оставляет прямой вход в бой.
7. npm run check, проверка в браузере (купить, улучшить, собрать 3).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Профиль игрока и операции базы — чистый модуль src/sim/profile.ts (проверки *Rejection + buyGroup/upgradeGroup/toggleLineup/profileLineup поверх цен economy.ts); стартовый профиль и зоны по слотам — данными в src/content/profile.ts (F-16 и A-10 куплены, 200 валюты, состав 2/3). Экран src/ui/base/BaseScreen строится из реестра GROUPS на универсальной GroupCard (новый слот actions); недоступные кнопки disabled с причиной текстом. App открывается на базе, «На вылет» запускает бой evac с составом и уровнями профиля; ?mission= — прямой вход в бой.
Проверка: npm run check — 19 файлов, 161 тест, все прошли. Headless Chromium: 200 → купить C-130 (110) → улучшить (10) → в состав (3/3) → «На вылет» открывает бой.
Дальше: возврат на базу, выбор миссии, итог и награда — TASK-17; профиль живёт только в памяти до TASK-18.
<!-- SECTION:FINAL_SUMMARY:END -->
