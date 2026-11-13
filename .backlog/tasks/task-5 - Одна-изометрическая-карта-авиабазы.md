---
id: TASK-5
title: Одна изометрическая карта авиабазы
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:22:00Z'
labels:
  - size-M
  - render
  - mvp
dependencies:
  - TASK-4
documentation:
  - docs/design.md
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MVP §5 п.1. Игроку нужна сцена, на которой видны база, путь врагов и слоты размещения. Three.js, изометрия, фиксированная камера; рендер только читает снапшот симуляции.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Карта (сетка, путь, слоты размещения) задана данными в MissionConfig, рендер строит сцену из конфига
- [x] #2 Ортографическая изометрическая камера зафиксирована (нет пользовательского вращения/панорамы)
- [x] #3 Тест: преобразование координат sim → мир и пикинг клетки по экранной точке взаимно обратны
- [x] #4 Сущности снапшота (враги, юниты) отображаются на карте и двигаются при работе симуляции (проверено в браузере)
- [x] #5 src/sim по-прежнему не импортирует three/react/zustand
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/render/coords.ts: чистая математика (клетка->мир, мир<->экран изометрии, пикинг клетки, подгонка вида под вьюпорт) без DOM/WebGL; coords.test.ts: взаимная обратность + согласие с three-камерой.
2. src/render/scene.ts: Three.js сцена из MissionConfig (земля, сетка, путь, слоты, база/вход), фикс. ортокамера без controls; update(snapshot) читает врагов/юнитов (цвет/форма через visualOf), пикинг слота по клику/hover.
3. src/store/game.ts: Zustand только snapshot + UI-состояние; src/ui/game/driver.ts: тонкий цикл с аккумулятором фикс. шага (step -> snapshot -> store), команды buy.
4. src/ui/App.tsx + GameCanvas: автозапуск MISSIONS.sortie, клик по слоту -> buy первого юнита реестра, текстовый HUD.
5. check, build, проверка в headless chromium (2 скриншота).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Реализовано: src/render/coords.ts (чистая математика: клетка->мир, мир<->экран изометрии, fitView, pickCell, slotIndexAt), coords.test.ts (обратимость, пикинг всех клеток на 3 вьюпортах, согласие с three OrthographicCamera); src/render/scene.ts (сцена из MissionConfig: земля, сетка, путь, слоты, вход/база; фикс. ортокамера, без controls; update(snapshot) только читает; облик сущностей через visualOf, hsl с пробелами конвертируется в render/scene.ts т.к. Color.setStyle его не понимает); src/store/game.ts (только снапшот); src/ui/game/driver.ts (аккумулятор фикс. шага, rAF), GameView.tsx, game.css; App.tsx автозапускает sortie с текстовым HUD, клик по слоту = buy первого по реестру доступного юнита. Проверено в headless chromium через CDP (скриншоты в scratchpad/task5: shot_units/move_*): враги двигаются, юниты ставятся кликом. check и build зелёные.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/render: coords.ts (чистая математика клетка↔мир↔экран, пикинг) + scene.ts (сцена из MissionConfig, ортокамера без controls). src/ui/game: driver.ts (фикс. шаг на rAF → step → snapshot), GameView; store/game.ts — только снапшот. App автозапускает sortie, клик по слоту покупает юнит командой buy. Проверено техлидом: npm run check (54 теста) и build зелёные; карта отрисована в headless Chromium (свой скриншот); движение врагов — по скриншотам субагента с интервалом 3 с (в моём прогоне с виртуальным временем rAF не тикал). Follow-up: нет интерполяции между тиками; отказ покупки в UI не показан (TASK-9).
<!-- SECTION:FINAL_SUMMARY:END -->
