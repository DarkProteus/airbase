---
id: TASK-7
title: Dev-галерея /gallery
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:11:00Z'
labels:
  - size-M
  - ui
  - tooling
dependencies:
  - TASK-4
documentation:
  - docs/design.md
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Агенты должны собирать и проверять контент без запуска игры: одна страница показывает всё, что описано конфигами, и позволяет крутить параметры.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Страница /gallery открывается в dev-сборке отдельно от игры
- [x] #2 Рендерит все юниты и всех врагов из реестров src/content универсальным компонентом (новый конфиг появляется без правок галереи)
- [x] #3 Рендерит UI-карточки юнитов из тех же конфигов
- [x] #4 Есть переключение параметров (уровень улучшения, активные модификаторы/теги) с мгновенным обновлением превью и статов
- [x] #5 Тест: галерея перечисляет ровно то, что в реестрах контента
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Чистая логика src/ui/gallery/model.ts: listUnits/listEnemies из реестров, unitStatsAtLevel (applyModifiers по upgrades[0..level-1] + активные модификаторы), generic describe полей, visualOf(config) из тегов/роли. 2. Тесты model.test.ts. 3. Переиспользуемые компоненты src/ui/components: EntityPreview, UnitCard, EntityCard (обобщённый рендер полей). 4. Страница src/ui/gallery/GalleryPage.tsx + zustand store UI-состояния. 5. Маршрутизация в main.tsx по location.pathname (dynamic import галереи, только dev). 6. check, build, проверка в браузере.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Сделано: чистая логика src/ui/entity/model.ts (viewUnit: статы по уровню через applyModifiers + what-if модификаторы с фильтром по тегам, describeFields — обобщённый вывод любых полей конфига, visualOf — цвет/форма от роли/тегов, air = парит) и src/ui/gallery/catalog.ts (listUnits/listEnemies/collectTags/modifierPool из реестров). Переиспользуемые компоненты: src/ui/entity/{UnitCard,EntityCard,EntityPreview}.tsx (SVG-превью, не three). Страница src/ui/gallery/GalleryPage.tsx, UI-состояние src/store/gallery.ts (zustand). Маршрутизация: main.tsx, pathname==='/gallery' && import.meta.env.DEV, динамический импорт (в prod-сборку не попадает). Тесты: model.test.ts, catalog.test.ts. Проверено в headless chromium через CDP: слайдер уровня и тег-тоглы меняют статы/теги мгновенно, 1 юнит + 4 врага (включая новых из TASK-6). Открытый вопрос: визуальных полей в конфигах нет — превью выводится из роли/тегов; если нужен явный визуал (модель/цвет/размер), это отдельное поле в UnitConfig/EnemyConfig для TASK-10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dev-страница /gallery (только DEV, в prod-бандл не попадает). Переиспользуемые src/ui/entity (UnitCard, EntityCard, EntityPreview на SVG, чистая model.ts) и src/ui/gallery/catalog.ts поверх реестров; store/gallery.ts — только UI-состояние. Проверено техлидом в headless Chromium: 1 юнит + 4 врага из TASK-6 (drone, runner, tank, bomber), слайдер уровня и тег-тоглы меняют статы/превью; npm run check и build зелёные. Follow-up: поле визуала в конфигах — в TASK-10.
<!-- SECTION:FINAL_SUMMARY:END -->
