---
id: TASK-25
title: Составные низкополи-модели как данные
status: Done
assignee:
  - '@fable'
created_date: '2026-11-15T09:12:00Z'
updated_date: '2026-11-15T10:06:00Z'
labels:
  - size-L
  - render
  - content
  - stage-0.2
dependencies: []
documentation:
  - docs/design.md
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Юниты и враги рисуются одним примитивом (`VisualShape`: cube, cylinder, pyramid, sphere), поэтому самолёты неотличимы от ящиков и не видно, куда они летят. Владелец выбрал низкополи-модели, собранные из кода, без внешних файлов моделей. Нужна основа, на которой модели задаются данными. Блок B этапа 0.2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Облик сущности может ссылаться на составную модель из реестра контента: набор деталей простых форм со смещением, поворотом, размером и цветом
- [x] #2 Игровая сцена и превью карточек (база, галерея) строят одну и ту же модель из одного описания
- [x] #3 Сущности без составной модели рисуются прежними примитивами
- [x] #4 Группы и враги в бою развёрнуты по курсу движения; на аэродроме группа стоит на земле
- [x] #5 Тест: построение модели из описания — чистая функция; sim облик не читает
- [x] #6 Проверено в браузере: тестовая составная модель в бою и на карточке
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Типы ModelPart/ModelConfig и VisualConfig.model; реестр src/content/models.ts. 2. src/render/model.ts: чистая modelParts и buildModel (three). 3. Сцена: модель вместо примитива, курс по движению (headingOf/turnToward). 4. Превью карточек: src/render/preview.ts рисует ту же buildModel в картинку. 5. Тесты, npm run check, браузер.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Составные модели как данные: ModelConfig — список деталей (box, cylinder, cone, sphere) со смещением, поворотом, размером и цветом; VisualConfig.model ссылается на модель из реестра MODELS. Сцена и превью карточек строят модель одной функцией buildModel (превью — картинка из общего фонового WebGL-рендерера, без WebGL остаётся примитив). Сущности без модели рисуются прежними примитивами. Группы и враги доворачиваются на курс движения (headingOf, turnToward); на аэродроме группа стоит на земле (низ модели на y=0). Sim облик не читает — сторожит новый тест в purity.test.ts. Тестовая модель jet назначена F-16. Проверка: npm run check зелёный; в Chromium модель видна на карточке базы и в бою, консоль чистая. Остальные модели — TASK-26.
<!-- SECTION:FINAL_SUMMARY:END -->
