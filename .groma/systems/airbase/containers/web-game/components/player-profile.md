---
type: C4 Component
title: Профиль и сохранение
status: stable
groma:
  id: player-profile
  parent: web-game
  code:
    - scanner: typescript
      file: src/sim/profile.ts
    - scanner: typescript
      file: src/sim/economy.ts
    - scanner: typescript
      file: src/sim/save.ts
  group: Match simulation
description: Валюта, покупки, улучшения, состав и формат сохранения между миссиями
---

Чистые операции экрана базы: цены и уровни групп (economy.ts), покупка, улучшение с выбором специализации, выбор состава (profile.ts), с причинами отказа. save.ts сериализует профиль и прогресс кампании в версионированную строку и мигрирует старые версии; само хранилище — снаружи sim.
