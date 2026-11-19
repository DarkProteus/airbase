---
id: TASK-50
title: 'Архитектура: дыры в сторожах слоёв и два источника цветов рельефа'
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-16T05:35:00Z'
updated_date: '2026-11-19T18:16:00Z'
labels:
  - model:cheap
  - size-S
  - architecture
dependencies:
  - TASK-49
references:
  - src/sim/purity.test.ts
  - src/render/environmentScene.ts
type: chore
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ночной разбор архитектуры (2026-11-16), мелкие находки. 1) Регулярное выражение в src/sim/purity.test.ts ловит импорт слоя только с косой чертой после имени (../render/x) и пропускает импорт индекса (from '../render'). 2) Слой src/audio импортирует sim, content, store, ui и render, но в списке слоёв AGENTS.md и CLAUDE.md его нет и правил для него нет. 3) Цвета рельефа заданы дважды в src/render/environmentScene.ts: числами в COLORS (water 0x2f78b8, ridge 0x969ca6) и строками в TERRAIN_COLORS для легенды в ui; при правке одного второй разойдётся. Нарушений детерминизма (Math.random, Date.now, performance.now) и ветвлений по id группы или врага в sim, render, ui и store не найдено.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Тест чистоты sim отвергает и from '../render', и from '../render/x' (то же для ui и store); проверено временным файлом-нарушителем в самом тесте или параметризованным примером строки
- [x] #2 Цвет каждого вида преграды задан в одном месте: легенда ui и меши рендера берут его из одной константы; тест сверяет, что цвет легенды равен цвету верхнего слоя меша
- [x] #3 AGENTS.md и CLAUDE.md описывают слой audio и что ему разрешено импортировать; правило закреплено сторожевым тестом
- [x] #4 npm run check проходит
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC3: в AGENTS.md нет списка слоёв (только блок Backlog.md); слой audio описан в CLAUDE.md. Тест «легенда = верхний слой меша» сверяет через общие функции окраски (topLayerColor/slabTone/peakTone), InstancedMesh не строится. Сторож sim по-прежнему пропускает *.test.ts в src/sim, как и раньше.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Сторож sim: регулярка ловит импорт слоёв render/ui/store/view/balance и по пути, и по индексу (from, export from, import()), плюс three/react/zustand; параметризованные примеры. Цвета преград: единая палитра src/view/terrain.ts (TERRAIN_PALETTE, terrainTopColor, terrainCss); environmentScene красит меши из неё, легенда в GameView берёт terrainCss; TERRAIN_COLORS убран; тест сверяет легенду с цветом верхнего слоя меша, цвета прежние. Audio импортировал render/effects — shotKindOf/shotWeapon перенесены дословно в src/view/shots.ts; правило «audio читает sim, content, view, store, но не ui/render» закреплено src/audio/purity.test.ts и строкой в CLAUDE.md. npm run check: 665 прошли; npm run build проходит.
<!-- SECTION:FINAL_SUMMARY:END -->
