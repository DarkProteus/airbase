# AIRBASE

Браузерная игра про авиабазу: вылеты авиагрупп на миссии, прокачка и синергии. Дизайн — в [`docs/design.md`](docs/design.md).

Стек: TypeScript, Vite, Three.js, React, Zustand, Vitest.

## Локальный запуск

```sh
npm install
npm run dev     # игра: http://localhost:5173/, галерея: http://localhost:5173/gallery
npm run check   # tsc --noEmit + vitest run
npm run build   # production-сборка в dist/ (с base /airbase/)
```

## Публикация (GitHub Pages)

Workflow `.github/workflows/pages.yml` при пуше в `main` (или вручную: Actions → Pages → Run workflow) прогоняет `npm run check`, собирает проект и публикует `dist`. Если `check` падает, публикации нет.

- Игра: https://darkproteus.github.io/airbase/
- Галерея контента: https://darkproteus.github.io/airbase/gallery/

Один раз нужно включить Pages: Settings → Pages → Build and deployment → Source: **GitHub Actions**. Для приватного репозитория GitHub Pages доступны только на платных планах (Pro, Team, Enterprise); на Free репозиторий должен быть публичным ([документация GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)).
