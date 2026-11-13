import type { MissionConfig } from '../sim';

/** Цель defend: удержать штаб до конца эвакуации; враги идут с трёх сторон, аэродром — в дальнем углу. */
const evac: MissionConfig = {
  id: 'evac',
  name: 'Эвакуация',
  size: { w: 13, h: 11 },
  airfield: { x: 12, y: 1 },
  objective: { type: 'defend', pos: { x: 5, y: 5 }, hp: 20, duration: 90 },
  spawns: [
    { x: 0, y: 1 },
    { x: 0, y: 9 },
    { x: 11, y: 10 },
  ],
  baseLives: 1,
  waves: [
    { prep: 6, groups: [{ enemy: 'drone', count: 5, interval: 1.2, spawn: 0 }] },
    { prep: 8, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 1 }, { enemy: 'drone', count: 5, interval: 1, spawn: 2, delay: 2 }] },
    { prep: 10, groups: [{ enemy: 'runner', count: 6, interval: 0.6, spawn: 0 }, { enemy: 'tank', count: 3, interval: 2.5, spawn: 2 }] },
    { prep: 12, groups: [{ enemy: 'drone', count: 8, interval: 0.7, spawn: 1 }, { enemy: 'runner', count: 6, interval: 0.5, spawn: 2, delay: 3 }, { enemy: 'tank', count: 3, interval: 2, spawn: 0, delay: 5 }] },
  ],
};

/** Цель escort: колонна идёт через карту к выходу, враги наводятся на неё; зоны приходится двигать вслед. */
const convoy: MissionConfig = {
  id: 'convoy',
  name: 'Колонна',
  size: { w: 13, h: 11 },
  airfield: { x: 12, y: 1 },
  objective: {
    type: 'escort',
    route: [
      { x: 0, y: 8 },
      { x: 4, y: 8 },
      { x: 4, y: 4 },
      { x: 9, y: 4 },
      { x: 9, y: 9 },
      { x: 12, y: 9 },
    ],
    hp: 24,
    speed: 0.25,
  },
  spawns: [
    { x: 0, y: 0 },
    { x: 6, y: 10 },
    { x: 12, y: 5 },
  ],
  baseLives: 1,
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 5, interval: 1.2, spawn: 0 }] },
    { prep: 10, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 1 }, { enemy: 'drone', count: 4, interval: 1, spawn: 0, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'runner', count: 6, interval: 0.6, spawn: 2 }, { enemy: 'tank', count: 2, interval: 3, spawn: 0 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 8, interval: 0.7, spawn: 2 }, { enemy: 'tank', count: 3, interval: 2.5, spawn: 1, delay: 2 }] },
  ],
};

export const MISSIONS: Record<string, MissionConfig> = {
  [evac.id]: evac,
  [convoy.id]: convoy,
};
