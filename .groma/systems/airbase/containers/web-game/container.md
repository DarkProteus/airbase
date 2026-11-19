---
type: C4 Container
title: Браузерная игра
status: stable
groma:
  id: web-game
  parent: airbase
  technology: TypeScript, React, Three.js, Zustand, Vite; статика на GitHub Pages
description: 'SPA игры: экраны базы, боя и итога, изометрическая сцена, звук, dev-галерея'
---

Одностраничное приложение, собранное Vite. Вход — src/main.tsx: обычный путь открывает поток экранов база → бой → итог, путь /gallery — отдельный чанк dev-галереи. Бой крутит драйвер фиксированных шагов поверх чистой симуляции; сцена Three.js и React-панели только читают снапшот. Профиль игрока и настройка звука хранятся в localStorage браузера (префикс airbase:). Код sim и content в этом контейнере общий с прогоном баланса.
