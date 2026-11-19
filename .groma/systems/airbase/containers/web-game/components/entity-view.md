---
type: C4 Component
title: Облик сущностей
status: stable
groma:
  id: entity-view
  parent: web-game
  code:
    - scanner: typescript
      file: src/view/entity.ts
  group: Presentation models
description: 'Чистые расчёты карточек и облика: статы с улучшениями, поля конфига, форма превью'
---

Без React и three. Из конфигов считает, что показать в карточке группы или врага (уровень, специализация, ауры-источники), облик для сцены и превью (форма, цвет, высота полёта). Используется сценой, карточками и галереей.
