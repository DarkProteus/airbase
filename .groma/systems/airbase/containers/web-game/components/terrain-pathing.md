---
type: C4 Component
title: Рельеф и маршруты
status: stable
groma:
  id: terrain-pathing
  parent: web-game
  code:
    - scanner: typescript
      file: src/sim/terrain.ts
    - scanner: typescript
      file: src/sim/path.ts
  group: Match simulation
description: Проходимость рельефа и обход преград врагами
---

Читает карту рельефа MissionConfig.terrain: наземные враги обходят воду, горы и хребты, воздушные — только хребты, свои группы летают выше. Строит маршруты врагов и полилинии с накопленной длиной (path.ts), по которым движок двигает врагов.
