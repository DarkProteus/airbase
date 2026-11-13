---
id: TASK-10
title: Модели, анимации, базовые звуки (примитивы)
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:36:00Z'
labels:
  - size-M
  - render
  - mvp
dependencies:
  - TASK-5
  - TASK-8
documentation:
  - docs/design.md
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MVP §5 п.5. Игрок должен различать юниты и врагов и получать обратную связь о выстрелах, попаданиях и потерях. На этом этапе допустимы примитивы.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Визуал юнита/врага описан данными (примитив, цвет, масштаб) и строится универсальным рендерером, общим с /gallery
- [x] #2 Анимации: движение врагов, выстрел/попадание, гибель — управляются событиями снапшота
- [x] #3 Базовые звуки: выстрел, гибель, урон базе, старт волны; есть mute
- [x] #4 Симуляция не зависит от визуала: headless-тесты проходят без изменений
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Тип VisualConfig (shape/color #rrggbb/scale/altitude) в sim/types.ts, необязательное поле visual в UnitConfig/EnemyConfig; задать visual всем конфигам content.
2. visualOf(entity{visual?}) в ui/entity/model.ts — единый источник для сцены и превью; эвристика только фолбэк; цвет в hex.
3. render/effects.ts (чистое): события -> эффекты (трассер, вспышка, взрыв, удар по базе), прогресс; render/motion.ts: интерполяция позиции между тиками. scene.ts: rAF-цикл, плавное движение, эффекты, анимация гибели, dispose.
4. driver.ts: накапливать events всех шагов кадра в snapshot.events.
5. src/audio: sounds.ts (событие->звук, троттлинг, чистое), synth.ts (WebAudio, данные голосов), mute в localStorage, SoundToggle (кнопка + подписка на стор, одна строка в App).
6. Vitest на чистые функции; check, build, проверка в headless chromium со скриншотами.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Визуал: VisualConfig {shape,color #rrggbb,scale,altitude} (sim/types.ts, поле visual? в UnitConfig/EnemyConfig, задано всем конфигам content). Единый источник — visualOf() в ui/entity/model.ts (сцена и превью галереи); эвристика осталась фолбэком, цвет везде hex. Анимации: render/motion.ts (твин dist между тиками), render/effects.ts (planEffects: shot->трассер+вспышка+отдача, kill->взрыв+сжатие модели, leak->вспышка у базы; неизвестные события игнорируются), scene.ts с rAF-циклом и dispose эффектов. driver.ts: события всех шагов кадра копятся в snapshot.events (withEvents). Звук: src/audio (sounds.ts чистый маппинг/троттлинг/голоса-данные, synth.ts WebAudio, storage.ts mute в localStorage с try/catch, SoundToggle = кнопка + подписка на стор; AudioContext по первому pointerdown/keydown). Проверено в headless chromium: скриншоты в scratchpad/task10, звук и mute (персистентность) через CDP. check и build зелёные.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
VisualConfig (shape, color #rrggbb, scale, altitude) — необязательное поле в UnitConfig/EnemyConfig, задано всем конфигам; единый источник visualOf() для сцены Three.js и превью галереи. render/effects.ts + motion.ts: трассеры, гибель, вспышка у базы, интерполяция между тиками — по событиям снапшота; driver копит события всех шагов кадра. src/audio: WebAudio-синтез (выстрел, гибель, урон базе, старт волны), троттлинг, mute в localStorage; SoundToggle подключён в App техлидом. Проверено техлидом: npm run check (97 тестов) и build зелёные; визуалы в игре и галерее согласованы (скриншоты). Звук подтверждён тестами маппинга/mute и проверкой субагента по вызовам осцилляторов — на слух не проверялся.
<!-- SECTION:FINAL_SUMMARY:END -->
