---
id: TASK-13
title: 'Зоны патрулирования: команда в sim и управление в бою'
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T07:48:00Z'
updated_date: '2026-11-13T11:22:00Z'
labels:
  - size-M
  - sim
  - ui
  - render
  - mvp
dependencies:
  - TASK-12
documentation:
  - docs/design.md
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Главное действие игрока в бою (design.md §5): назначить группе зону патрулирования (круг) и двигать её в любой момент. Без этого бой нового дизайна не играбелен.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Команда sim задаёт центр зоны группы; радиус зоны берётся из конфига группы
- [x] #2 Тест: перенос зоны во время перелёта или патруля перенаправляет группу сразу; во время возврата и перезарядки — применяется к следующему вылету
- [x] #3 Тест: зона вне карты или для неизвестной группы отклоняется событием с причиной
- [x] #4 В бою: выбор группы и клик по карте ставят или переносят её зону; круг зоны и группа в полёте видны на карте
- [x] #5 HUD показывает по каждой группе фазу вылета, остаток топлива и боекомплекта, время до конца перезарядки — из снапшота, чистыми селекторами под тестами
- [x] #6 Zustand хранит только UI-состояние и снапшот; перенос зоны идёт командой в sim (проверено в браузере: зона переносится во время волны)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sim: команда setZone {group, zone} в engine.applyCommand; причины отказа unknownGroup / zoneOutOfMap через событие rejected; зона меняется сразу (transit/patrol перенаправляются существующей логикой stepGroups, return/rearm — со следующего вылета). Тесты в sortie.test.ts.
2. content: минимальный src/content/groups.ts (временная группа для боя до TASK-15) + CONTENT.groups; стартовый состав (lineup) по умолчанию передаётся в startGame → createSim.
3. store: selectedGroup (UI-состояние), взаимоисключающе с выбором магазина/юнита.
4. render: круг зоны каждой группы, маркер группы в полёте по снапшоту, клик по клетке карты → onMapClick(cell).
5. ui: чистые селекторы groupHud (фаза, топливо, боекомплект, время до конца перезарядки) под тестами; панель групп в HUD с выбором; клик по карте при выбранной группе → dispatch setZone.
6. npm run check + проверка в браузере (зона переносится во время волны).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Реализовано субагентом Sonnet, диф проверен главным. Логика цикла вылета не менялась: takeoff/transit/patrol уже следуют g.zone, return/rearm её игнорируют. Проверка в браузере — headless Chromium через CDP (разовый прогон субагента, не автотест): группы взлетают, круги зон видны, клик во время патруля отправил F-16 в перелёт к новой зоне. В контенте временные F-16/A-10 и DEFAULT_LINEUP (src/content/groups.ts) — заглушка до TASK-15/16.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Команда sim setZone {group, zone} с отказами unknownGroup/outOfMap (zoneRejection в sortie.ts) и событием zoneSet; 9 тестов в sortie.test.ts на перенос во всех фазах и отказы. UI: selectedGroup в store, GroupPanel (фаза, топливо, боекомплект, время перезарядки) на чистых селекторах groupRows/zoneClick под тестами; рендер рисует круг зоны и маркер группы, onMapClick забирает клик при выбранной группе. startGame принимает lineup. npm run check: 135 тестов зелёные. Известное: в rearm HUD показывает остаток топлива прошлого вылета (заправка в sim — в конце перезарядки); временные группы и состав по умолчанию заменить в TASK-15/16.
<!-- SECTION:FINAL_SUMMARY:END -->
