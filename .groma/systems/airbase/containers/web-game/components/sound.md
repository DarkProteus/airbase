---
type: C4 Component
title: Звук
status: stable
groma:
  id: sound
  parent: web-game
  code:
    - scanner: typescript
      file: src/audio/sounds.ts
    - scanner: typescript
      file: src/audio/attach.ts
      symbol: attachGameSound
    - scanner: typescript
      file: src/audio/index.ts
    - scanner: typescript
      file: src/audio/state.ts
      symbol: useAudioStore
    - scanner: typescript
      file: src/audio/storage.ts
    - scanner: typescript
      file: src/audio/synth.ts
    - scanner: react
      file: src/audio/SoundToggle.tsx
    - scanner: typescript
      file: src/audio/SoundToggle.tsx
      symbol: SoundToggle
  technology: Web Audio API, React
description: Синтезированные звуки боя по событиям снапшота и кнопка mute
---

attach.ts подписывается на снапшоты игры и первый жест пользователя; sounds.ts чисто переводит события в звуки с троттлингом; synth.ts — единственное место с AudioContext, синтез без ассетов. mute хранится в localStorage. Слой читает sim, content, view и store, но не ui и render.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/audio/attach.ts](../../../../../../src/audio/attach.ts) | [src/store/game.ts](../../../../../../src/store/game.ts) | Слушает снапшоты | подписка Zustand |
| [src/audio/attach.ts](../../../../../../src/audio/attach.ts) | [src/view/markup.ts](../../../../../../src/view/markup.ts) | Узнаёт о волне | вызов функций |
