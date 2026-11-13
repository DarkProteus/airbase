---
id: TASK-6
title: Путь противников и система волн
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T06:59:00Z'
updated_date: '2026-11-13T07:11:00Z'
labels:
  - size-M
  - sim
  - mvp
dependencies:
  - TASK-4
documentation:
  - docs/design.md
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MVP §5 п.2. Минимальный движок даёт один тип врага и линейное расписание; для сессии нужны разные враги как данные, состав волн и условия победы/поражения.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 EnemyConfig — данные (hp, скорость, награда, урон базе, теги); минимум 3 типа врагов в src/content
- [x] #2 Миссия из ≥5 волн с нарастающим составом задаётся только конфигом
- [x] #3 Тест: следующая волна стартует по правилу конфига (таймер/зачистка), между волнами фаза подготовки
- [x] #4 Тест: статус матча won после последней волны и зачистки, lost при жизнях базы ≤ 0
- [x] #5 Тест: headless-прогон полной миссии детерминирован по сиду
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Расширить типы: Wave.start (rule: timer|clear), baseLives, EnemyConfig.damage. 2. Ввести фазу подготовки между волнами и правило старта из конфига. 3. Новые враги и миссия >=5 волн. 4. Тесты на критерии 1-5.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Wave.at заменён на prep (сек подготовки) + start?: 'timer'|'clear'. timer: отсчёт prep после конца спавна предыдущей волны; clear: после зачистки. Состояние sim: wave, phase (prep|wave), phaseTick; Sim.schedule -> Sim.waveSpawns (по волнам, тики от старта волны); событие waveStart. Враги: drone, runner, tank, bomber (ENEMIES). Миссия sortie (6 волн, нарастающий состав); proto сохранена. Тесты: src/sim/waves.test.ts, engine.test.ts обновлён под prep. npm run check зелёный (32 теста).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wave: prep + start (timer|clear) вместо абсолютного at; фазы prep/wave и событие waveStart в SimState. Враги drone/runner/tank/bomber в реестре ENEMIES, миссия sortie (6 волн). Проверено техлидом: npm run check — 32 теста зелёные, каждый критерий покрыт в src/sim/waves.test.ts. Известное ограничение: миссия с пустым waves не получает статус won.
<!-- SECTION:FINAL_SUMMARY:END -->
