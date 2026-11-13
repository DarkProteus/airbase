---
id: TASK-15
title: Четыре группы на AirGroupConfig, таргетинг по тегам, ребаланс
status: Done
assignee:
  - '@fable'
created_date: '2026-11-13T07:48:00Z'
updated_date: '2026-11-13T23:04:00Z'
labels:
  - size-L
  - sim
  - content
  - mvp
dependencies:
  - TASK-12
  - TASK-14
documentation:
  - docs/design.md
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Контент переводится на новую модель (design.md §5): F-16 (истребитель, air), новый A-10 (штурмовик, ground), Growler (РЭБ: аура в зоне — враги медленнее, strike сильнее), C-130 (бонус к награде за каждый завершённый вылет). Выбор 3 групп из 4 должен быть настоящим решением под цель миссии. Здесь же убирается турельное наследие (UnitConfig, слоты, покупка/улучшение/продажа в бою, магазин в бою); расчёт цен и уровней сохраняется для экрана базы.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 F-16, A-10, Growler и C-130 описаны как AirGroupConfig в src/content; в движке нет ветвлений по id группы (тест)
- [x] #2 Тест: оружие поражает только врагов с целевыми тегами — F-16 не атакует ground, A-10 не атакует air
- [x] #3 Тест: аура Growler действует в его зоне патруля — враги медленнее, группы с тегом strike сильнее; вне зоны и вне фазы патруля эффекта нет
- [x] #4 Тест: C-130 увеличивает награду миссии за каждый свой завершённый вылет
- [x] #5 Тест: условные ДРЛО (+радиус зоны союзников) и заправщик (+время патруля союзников) добавляются одними данными — конфигами в тесте, без правок движка
- [x] #6 Headless-бот прогоняет все составы 3 из 4 на обеих миссиях; тест: каждая миссия проходима хотя бы одним составом, лучшие составы двух миссий различаются, каждая группа входит в лучший состав хотя бы одной миссии
- [x] #7 Турельная модель удалена: нет слотов, UnitConfig и команд покупки/улучшения/продажи в бою; npm run check и build зелёные, игра и /gallery открываются
- [x] #8 Секция правил в CLAUDE.md упоминает AirGroupConfig вместо UnitConfig
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sim: убрать UnitConfig/units/slots/startMoney и команды buy/upgrade/sell; economy.ts — чистые расчёты цен/уровней по AirGroupConfig.
2. sim/sortie: ауры групп (scope aura/global, side ally/enemy) действуют из зоны владельца только в фазе patrol; радиус по умолчанию = радиус зоны владельца; fuel-аура замедляет расход топлива; income начисляется на sortieDone.
3. content: F-16, A-10, Growler, C-130 как AirGroupConfig; миссии — только evac и convoy (турельные proto/sortie удаляются; поддержка path в движке остаётся для тестов волн).
4. bot: runMatch(mission, content, seed, lineup) — зоны держит на цели миссии; balance.test — все составы 3 из 4 на обеих миссиях, ребаланс под AC#6 (оценка: победы, затем награда).
5. UI/render/audio: убрать магазин, панель юнита, слоты; эффекты и звук — от groupShot; галерея и карточка — на AirGroupConfig (минимально, расширение — TASK-19).
6. Тесты AC#1–5, CLAUDE.md, npm run check + build, проверка в браузере.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ауры: источник — группа в фазе patrol, центр — её зона, радиус по умолчанию = собственный радиус зоны; fuel-аура замедляет расход топлива (own.fuel/st.fuel). income начисляется на sortieDone. Турельные миссии proto/sortie удалены из контента; поддержка path+жизней базы в движке оставлена (на ней тесты волн). Баланс (сиды 1–3, оценка: победы, затем награда): evac проходит только F-16+A-10+Growler; convoy — лучший F-16+A-10+C-130. Галерея и карточка переведены на AirGroupConfig минимально (расширение — TASK-19).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Контент переведён на AirGroupConfig: F-16 (air), A-10 (ground), Growler (аура: враги ×0.7 скорости, strike ×1.3 урона), C-130 (бонус к награде за вылет). В sim добавлена система аур групп и income, удалена турельная модель (UnitConfig, слоты, startMoney, buy/upgrade/sell, магазин и панель юнита); economy.ts — чистые расчёты цен и уровней для экрана базы. Бот runMatch гоняет составы с зонами на цели миссии; balance.test проверяет все составы 3 из 4 на evac и convoy. Проверка: npm run check (148 тестов) и npm run build зелёные; игра (evac, convoy) и /gallery открыты в headless Chromium без ошибок консоли. Риск: запас прочности в evac у лучшего состава мал (hp 2/20) — баланс чувствителен к правкам чисел.
<!-- SECTION:FINAL_SUMMARY:END -->
