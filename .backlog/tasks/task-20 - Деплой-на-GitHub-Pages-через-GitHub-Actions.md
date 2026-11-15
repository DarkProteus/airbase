---
id: TASK-20
title: Деплой на GitHub Pages через GitHub Actions
status: Done
assignee:
  - '@sonnet'
created_date: '2026-11-13T07:51:00Z'
updated_date: '2026-11-15T08:36:00Z'
labels:
  - size-S
  - tooling
dependencies: []
type: chore
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Игру и галерею сейчас можно открыть только локально через dev-сервер; нужна публичная ссылка, которая обновляется сама, чтобы смотреть текущее состояние main без клонирования и сборки.

Контекст, который не очевиден из задачи:
- Репозиторий `DarkProteus/airbase`, проектный сайт Pages живёт под подпутём `/airbase/`, а `vite.config.ts` сейчас без `base` — ассеты сборки по абсолютным путям от корня там не загрузятся.
- Галерея в `src/main.tsx` включается только при `import.meta.env.DEV` и точном `location.pathname === '/gallery'`. В production-сборке она вырезана, под подпутём сравнение не сработает, а на Pages нет SPA-fallback: прямой заход на вложенный путь отдаёт 404.
- Источник Pages в настройках репозитория должен быть «GitHub Actions» — это ручной шаг владельца, если не включено.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `base` в `vite.config.ts` задан так, что production-сборка работает под подпутём репозитория на Pages, а `npm run dev` по-прежнему открывается с корня
- [x] #2 Workflow GitHub Actions при пуше в `main` собирает проект и публикует его на GitHub Pages; есть ручной запуск (`workflow_dispatch`)
- [x] #3 Деплой не публикуется, если `npm run check` падает
- [x] #4 Игра открывается по URL Pages: ассеты грузятся без 404, в консоли нет ошибок
- [x] #5 Галерея открывается на Pages по прямой ссылке и после перезагрузки страницы (без 404), локальный адрес галереи в dev продолжает работать
- [x] #6 URL опубликованной игры и галереи записан в README или `docs/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Локальная часть готова: base=/airbase/ только при vite build; галерея — вторая HTML-точка входа gallery/index.html + чистая isGalleryPath (src/ui/route.ts), попадает в prod отдельным чанком; workflow .github/workflows/pages.yml (push main + workflow_dispatch, npm ci → check → build → upload, deploy needs build); README с URL. Проверено на локальном эквиваленте Pages (статика под /airbase/ без SPA-fallback, headless Chromium): игра и галерея открываются по прямой ссылке и после перезагрузки, 404 только favicon.ico. НЕ проверено: запуск workflow и реальный URL — нужен пуш и включение Pages (Source: GitHub Actions); репозиторий приватный, на Free Pages для приватных недоступны. Критерии 2–5 открыты до первого деплоя, задача остаётся In Progress.

2026-11-15: main запушен, Pages уже был включён (build_type: workflow). Workflow Pages по пушу прошёл дважды зелёным (build: npm ci → check → build → upload; deploy). Живой сайт проверен headless Chromium: https://darkproteus.github.io/airbase/ и /airbase/gallery/ (прямая ссылка, без слеша, перезагрузка) — отрисованы, 0 запросов с 404, 0 ошибок консоли (добавлен пустой favicon data:,). Критерий 3 подтверждён структурой и логом запуска (check — шаг job build до upload, deploy needs build); падение check намеренно не воспроизводилось. Ручной запуск workflow_dispatch объявлен, не запускался.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Игра и галерея публикуются на GitHub Pages workflow'ом при пуше в main: https://darkproteus.github.io/airbase/ и https://darkproteus.github.io/airbase/gallery/. base=/airbase/ только в сборке, галерея — вторая HTML-точка входа. check: 224 теста; деплой зелёный, живой сайт проверен в браузере без 404 и ошибок консоли.
<!-- SECTION:FINAL_SUMMARY:END -->
