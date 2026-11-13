---
id: TASK-9
title: Деньги, покупка, улучшения
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:36:00Z'
labels:
  - size-M
  - sim
  - ui
  - mvp
dependencies:
  - TASK-4
  - TASK-8
documentation:
  - docs/design.md
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MVP §5 п.4. Выбор перед волной (design.md §3): купить юнит, улучшить имеющийся, сохранить деньги — у каждого варианта понятная цена.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Команды sim: купить/разместить, улучшить, продать; тесты на списание, отказ при нехватке и занятом слоте
- [x] #2 Улучшения — данные в UnitConfig (уровни как модификаторы); тест: уровень меняет статы
- [x] #3 UI-магазин строится из конфигов универсальной карточкой, недоступные покупки отключены
- [x] #4 Zustand хранит только UI-состояние и снапшот; покупка идёт командой в sim (проверяется тестом/ast-grep: в store нет игровой логики)
- [x] #5 В браузере: покупка, размещение и улучшение работают в фазе подготовки и во время волны
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sim: новый src/sim/economy.ts — константа SELL_REFUND=0.5, чистые проверки buyRejection/upgradeRejection/sellRefund/invested (используются и движком, и UI-селекторами — проверки живут только в sim); engine.ts: команды upgrade/sell, события upgraded/sold, расширенный reason (maxLevel).
2. Тесты src/sim/economy.test.ts: списание, отказы (деньги/слот/неизвестный/макс. уровень), уровень меняет статы, возврат 50% с округлением вниз, слот освобождается, детерминизм.
3. store: UI-состояние (выбранная карточка магазина, выбранный юнит, сообщение); тест purity для src/store.
4. UI: чистые селекторы (selectors.ts + тест), Shop/UnitPanel/Hud на UnitCard, переработка GameView (клик по слоту: поставить/выбрать), Escape — сброс.
5. npm run check, build, проверка в браузере через CDP (prep + волна), скриншоты.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Сделано: sim/economy.ts (SELL_REFUND=0.5, RejectReason, чистые buyRejection/upgradeRejection/nextUpgradeCost/invested/sellRefund над World={mission,content,state} — их используют и движок, и UI-селекторы, правила только в sim); команды upgrade{unit:id}/sell{unit:id}, события upgraded/sold, reason maxLevel. UI: ui/game/selectors.ts (чистые: shopItems, unitPanel, slotClick, rejectionNotice, hudLine), Shop/UnitPanel/Hud на UnitCard без правок entity, GameView (клик по слоту: занятый — выбор юнита, свободный — buy выбранной карточки), Escape сбрасывает выбор; store: shopSelection/selectedUnit/notice. Тесты: sim/economy.test.ts, ui/game/selectors.test.ts, store/purity.test.ts. В браузере (CDP) проверены покупка/улучшение/продажа в prep и во время волны. Ограничение драйвера: события sim живут один тик, а снапшот отдаётся после N шагов кадра — rejected может не дойти до UI, поэтому подсказка отказа дополнительно считается теми же функциями sim до dispatch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Команды sim upgrade/sell (+ события upgraded/sold, причина отказа maxLevel); правила в src/sim/economy.ts, ими же пользуются UI-селекторы. Продажа возвращает 50% вложенного (SELL_REFUND, решение техлида — в design.md не задано). UI: магазин из UNITS на универсальной UnitCard, панель юнита с «Улучшить/Продать», сообщения об отказе; store — снапшот + выбор, без логики (store/purity.test.ts). Проверено техлидом: npm run check (97 тестов), build; CDP-сценарий на интегрированном дереве — покупка, улучшение, продажа в prep и во время волны. Follow-up: нет подсветки выбранного слота на карте; сообщение об отказе не гаснет само.
<!-- SECTION:FINAL_SUMMARY:END -->
