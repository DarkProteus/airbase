---
id: TASK-49
title: 'Архитектура: рендер зависит от слоя ui'
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-16T05:35:00Z'
updated_date: '2026-11-19T18:05:00Z'
labels:
  - model:cheap
  - size-M
  - architecture
dependencies: []
references:
  - src/render/scene.ts
  - src/ui/entity/model.ts
  - src/ui/game/markup.ts
type: chore
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ночной разбор архитектуры (2026-11-16): src/render/scene.ts импортирует из src/ui — visualOf и PreviewShape из ui/entity/model, attackLinks, enemyMarks, TARGET_KINDS, targetKind, EnemyMark, TargetKind из ui/game/markup; тесты рендера (model.test.ts, environment.test.ts) берут оттуда же visualOf и DEFAULT_ALTITUDE. Одновременно ui импортирует render (GameView, превью), то есть слои зависят друг от друга по кругу. По AGENTS.md рендер читает снапшот sim, а ui строится из конфигов; общие чистые модели представления (облик сущности, разметка боя) не принадлежат React-слою. Поведение и внешний вид менять нельзя — только место кода.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 В src/render нет импортов из src/ui и src/store (включая тесты); общие чистые функции лежат в слое, который не импортирует react, zustand и three
- [x] #2 Сторожевой тест отвергает импорт ui или store из src/render — и по пути к файлу (../ui/x), и по индексу (../ui)
- [x] #3 Публичные имена функций не меняются; diff не содержит правок логики — только перенос файлов и импортов
- [x] #4 Слой описан в списке слоёв AGENTS.md и CLAUDE.md; npm run check проходит, npm run build проходит
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC4: в AGENTS.md нет списка слоёв (только блок Backlog.md), список слоёв ведётся в CLAUDE.md — строка src/view добавлена туда. Отступление от «только перенос»: тест groupRows из markup.test.ts переехал в src/ui/game/selectors.test.ts, т.к. зависит от ui; в markup.test.ts локальный хелпер world.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Новый слой src/view (без react/zustand/three): git mv src/ui/entity/model.ts → src/view/entity.ts, src/ui/game/markup.ts → src/view/markup.ts вместе с тестами (entity, markup, specs). Импорты обновлены в render, ui, audio, store; логика и публичные имена не менялись. Сторожа: src/render/purity.test.ts (запрет ui/store по пути и по индексу, включая тесты) и src/view/purity.test.ts (запрет three/react/zustand и render/ui/store). CLAUDE.md: строка слоя src/view. npm run check: 639 прошли; npm run build проходит.
<!-- SECTION:FINAL_SUMMARY:END -->
