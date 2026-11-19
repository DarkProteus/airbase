---
type: C4 System
title: AIRBASE
status: stable
groma:
  id: airbase
  technology: TypeScript
description: Браузерная тактическая игра про авиабазу и её headless-баланс
---

Одна кодовая база: детерминированная симуляция матча (src/sim), контент как данные (src/content), а поверх них — браузерная игра (React + Three.js) и Node-прогон баланса. Слои сторожатся тестами purity.test.ts: sim не знает о рендере и UI, render не импортирует ui/store, audio не импортирует ui/render.
