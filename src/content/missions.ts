import type { MissionConfig } from '../sim';

const proto: MissionConfig = {
  id: 'proto',
  name: 'Прототип',
  path: [
    { x: 0, y: 4 },
    { x: 6, y: 4 },
    { x: 6, y: 9 },
    { x: 12, y: 9 },
  ],
  slots: [
    { x: 3, y: 3 },
    { x: 5, y: 6 },
    { x: 8, y: 8 },
  ],
  size: { w: 13, h: 11 },
  airfield: { x: 12, y: 1 },
  startMoney: 250,
  baseLives: 10,
  waves: [
    { prep: 2, groups: [{ enemy: 'drone', count: 5, interval: 1 }] },
    { prep: 9, groups: [{ enemy: 'drone', count: 10, interval: 0.6 }] },
  ],
};

/** Миссия из 6 волн с нарастающим составом: новые типы врагов, смена правила старта, босс в конце. */
const sortie: MissionConfig = {
  id: 'sortie',
  name: 'Вылет',
  path: proto.path,
  slots: [
    { x: 2, y: 3 },
    { x: 4, y: 5 },
    { x: 5, y: 3 },
    { x: 7, y: 5 },
    { x: 5, y: 7 },
    { x: 7, y: 8 },
    { x: 8, y: 10 },
    { x: 10, y: 8 },
  ],
  size: { w: 13, h: 11 },
  airfield: proto.airfield,
  startMoney: 300,
  baseLives: 20,
  waves: [
    { prep: 10, groups: [{ enemy: 'drone', count: 6, interval: 1 }] },
    { prep: 8, groups: [{ enemy: 'drone', count: 8, interval: 0.8 }, { enemy: 'runner', count: 4, interval: 0.5, delay: 4 }] },
    { prep: 8, start: 'clear', groups: [{ enemy: 'tank', count: 3, interval: 2.5 }, { enemy: 'runner', count: 6, interval: 0.4, delay: 3 }] },
    { prep: 10, groups: [{ enemy: 'drone', count: 12, interval: 0.5 }, { enemy: 'tank', count: 4, interval: 2, delay: 2 }] },
    { prep: 10, start: 'clear', groups: [{ enemy: 'runner', count: 16, interval: 0.3 }, { enemy: 'tank', count: 6, interval: 1.5, delay: 3 }] },
    { prep: 12, start: 'clear', groups: [{ enemy: 'bomber', count: 1, interval: 0 }, { enemy: 'tank', count: 6, interval: 1.2, delay: 4 }, { enemy: 'drone', count: 15, interval: 0.4, delay: 6 }] },
  ],
};

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
  slots: [],
  startMoney: 0,
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
    hp: 20,
    speed: 0.25,
  },
  spawns: [
    { x: 0, y: 0 },
    { x: 6, y: 10 },
    { x: 12, y: 5 },
  ],
  slots: [],
  startMoney: 0,
  baseLives: 1,
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 5, interval: 1.2, spawn: 0 }] },
    { prep: 10, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 1 }, { enemy: 'drone', count: 4, interval: 1, spawn: 0, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'runner', count: 6, interval: 0.6, spawn: 2 }, { enemy: 'tank', count: 2, interval: 3, spawn: 0 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 8, interval: 0.7, spawn: 2 }, { enemy: 'tank', count: 3, interval: 2.5, spawn: 1, delay: 2 }] },
  ],
};

export const MISSIONS: Record<string, MissionConfig> = {
  [proto.id]: proto,
  [sortie.id]: sortie,
  [evac.id]: evac,
  [convoy.id]: convoy,
};
