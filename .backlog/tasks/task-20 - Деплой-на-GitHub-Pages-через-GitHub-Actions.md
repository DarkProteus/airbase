---
id: TASK-20
title: Деплой на GitHub Pages через GitHub Actions
status: To Do
assignee:
  - '@sonnet'
created_date: '2026-11-13T07:51:00Z'
updated_date: '2026-11-13T07:53:00Z'
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
- [ ] #1 `base` в `vite.config.ts` задан так, что production-сборка работает под подпутём репозитория на Pages, а `npm run dev` по-прежнему открывается с корня
- [ ] #2 Workflow GitHub Actions при пуше в `main` собирает проект и публикует его на GitHub Pages; есть ручной запуск (`workflow_dispatch`)
- [ ] #3 Деплой не публикуется, если `npm run check` падает
- [ ] #4 Игра открывается по URL Pages: ассеты грузятся без 404, в консоли нет ошибок
- [ ] #5 Галерея открывается на Pages по прямой ссылке и после перезагрузки страницы (без 404), локальный адрес галереи в dev продолжает работать
- [ ] #6 URL опубликованной игры и галереи записан в README или `docs/`
<!-- AC:END -->
