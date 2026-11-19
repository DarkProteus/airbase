---
id: TASK-51
title: 'Рельеф: хребты заслоняют карту, вертолёт летит сквозь горы'
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-16T05:35:00Z'
updated_date: '2026-11-19T18:11:00Z'
labels:
  - model:cheap
  - size-S
  - map
  - render
dependencies: []
references:
  - src/render/environment.ts
  - src/render/environmentScene.ts
type: bug
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Просмотр карт после TASK-39 (скриншоты headless Chromium, 2026-11-16). 1) Вершины хребта высотой 1,8–2,4 клетки при изометрической камере закрывают клетки позади себя: в «Эвакуации» южный хребет частично закрывает подступ к «Полевому лагерю», северный — площадку БПЛА и кольцо предупреждения о волне. Врагов, зоны и маршруты за хребтом не видно. 2) Вертолёт летит на высоте 0,55 (visual.altitude в src/content/enemies.ts), вершины гор — до 0,62 (PEAK_HEIGHT в src/render/environment.ts): по правилам sim он пролетает над горами, а на экране — сквозь них. Правила проходимости в sim не менять.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ни один враг с тегом air не летит ниже самой высокой вершины гор: тест сверяет высоты из конфигов врагов с PEAK_HEIGHT.mountain
- [x] #2 Хребет по-прежнему выше любого полёта (существующий тест в src/render/environment.test.ts проходит)
- [x] #3 Враги, базы, кольца предупреждения и точки маршрутов, оказавшиеся за хребтом, остаются видны (например, вершины полупрозрачны там, где что-то заслоняют, или ниже ростом); проверено скриншотами «Эвакуации» и «Укрепрайона», приложенными в заметках задачи
- [x] #4 npm run check проходит
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Скриншоты (headless Chromium, playwright-core поверх /usr/bin/chromium): до — /tmp/claude-1000/-home-proteus-projects-airbase/94bc72b6-42aa-40b8-a8fb-c2431a16d878/scratchpad/task51/before-evac-20s.png, /tmp/claude-1000/-home-proteus-projects-airbase/94bc72b6-42aa-40b8-a8fb-c2431a16d878/scratchpad/task51/before-bastion-25s.png; после — /tmp/claude-1000/-home-proteus-projects-airbase/94bc72b6-42aa-40b8-a8fb-c2431a16d878/scratchpad/task51/after-evac-20s.png, /tmp/claude-1000/-home-proteus-projects-airbase/94bc72b6-42aa-40b8-a8fb-c2431a16d878/scratchpad/task51/after-bastion-25s.png (+ 2s-кадры и after-heli-bastion-*). Эвакуация после: через северный хребет видны дроны у площадки БПЛА, через южный — точки маршрута и кольцо «Полевого лагеря». Укрепрайон: сквозь хребет у вертолётной площадки видны точки маршрута и кольцо. Вертолёта в полёте на кадрах нет (волна не стартовала в медленном swiftshader) — высоту подтверждает тест. Критерии 1 и 2 не противоречат: существующий тест требует горы ниже полёта, а хребет выше.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Вертолёт: visual.altitude 0.55 → 0.8 (выше вершин гор 0.62). Хребет: PEAK_HEIGHT.ridge [1.8, 2.4] → [1.4, 1.8] (всё ещё выше бомбардировщика 1.2), вершины и снежные шапки полупрозрачные (RIDGE_OPACITY 0.42, depthWrite: false); горы и основание хребта непрозрачны. Новый src/render/terrainView.test.ts: воздушные враги выше гор, хребет выше любого полёта и не выше 1.8, прозрачность в (0, 0.7). Sim не тронут. npm run check: 642 прошли. Риск: хребет выглядит «стеклянным» — при желании поднять RIDGE_OPACITY до 0.5–0.55.
<!-- SECTION:FINAL_SUMMARY:END -->
