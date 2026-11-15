import type { MissionConfig } from '../sim';

/** Цель defend: удержать штаб до конца эвакуации; враги идут с трёх сторон, аэродром — в дальнем углу. */
const evac: MissionConfig = {
  id: 'evac',
  name: 'Эвакуация',
  size: { w: 13, h: 11 },
  airfield: { x: 12, y: 1 },
  objective: { type: 'defend', pos: { x: 5, y: 5 }, hp: 20, duration: 90 },
  reward: { win: 120, loss: 30 },
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
  reward: { win: 140, loss: 30 },
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

/** Малая карта, враги почти все малозаметные: без группы обнаружения (ДРЛО) в зоне их никто не атакует. */
const radar: MissionConfig = {
  id: 'radar',
  name: 'Радарный пост',
  size: { w: 11, h: 9 },
  airfield: { x: 5, y: 8 },
  objective: { type: 'defend', pos: { x: 5, y: 3 }, hp: 28, duration: 110 },
  reward: { win: 170, loss: 40 },
  spawns: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  baseLives: 1,
  /** Кольцом вокруг радара: зоны близко друг к другу, чтобы ауры Growler и ДРЛО накрывали соседей, а малозаметные цели попадали под обнаружение. */
  zones: [
    { x: 4, y: 2 },
    { x: 6, y: 2 },
    { x: 5, y: 4 },
  ],
  waves: [
    { prep: 6, groups: [{ enemy: 'drone', count: 4, interval: 1.4, spawn: 0 }] },
    { prep: 10, groups: [{ enemy: 'ghost', count: 2, interval: 2.5, spawn: 1 }, { enemy: 'drone', count: 4, interval: 1.2, spawn: 0, delay: 2 }] },
    { prep: 12, groups: [{ enemy: 'ghost', count: 3, interval: 2, spawn: 0 }, { enemy: 'runner', count: 4, interval: 0.8, spawn: 1, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'ghost', count: 3, interval: 1.8, spawn: 1 }, { enemy: 'drone', count: 6, interval: 1, spawn: 0, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'ghost', count: 3, interval: 1.8, spawn: 0 }, { enemy: 'ghost', count: 2, interval: 2, spawn: 1, delay: 3 }, { enemy: 'runner', count: 4, interval: 0.8, spawn: 0, delay: 5 }] },
    { prep: 14, groups: [{ enemy: 'ghost', count: 3, interval: 1.8, spawn: 0 }, { enemy: 'ghost', count: 3, interval: 1.8, spawn: 1, delay: 1 }, { enemy: 'drone', count: 6, interval: 1, spawn: 0, delay: 4 }] },
  ],
};

/** Большая карта, четыре входа: ударные вертолёты в броне и колонны техники — без штурмовика не отбиться. */
const bastion: MissionConfig = {
  id: 'bastion',
  name: 'Укрепрайон',
  size: { w: 17, h: 13 },
  airfield: { x: 0, y: 10 },
  objective: { type: 'defend', pos: { x: 9, y: 6 }, hp: 36, duration: 150 },
  reward: { win: 200, loss: 45 },
  spawns: [
    { x: 16, y: 0 },
    { x: 16, y: 12 },
    { x: 8, y: 0 },
    { x: 0, y: 2 },
  ],
  baseLives: 1,
  /** Вплотную вокруг объекта: на большой карте четыре входа, и разнесённые зоны не успевают прикрыть цель; ауры накрывают соседей. */
  zones: [
    { x: 9, y: 5 },
    { x: 9, y: 7 },
    { x: 8, y: 6 },
  ],
  waves: [
    { prep: 6, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 0 }] },
    { prep: 12, groups: [{ enemy: 'gunship', count: 1, interval: 3, spawn: 1 }, { enemy: 'drone', count: 5, interval: 1, spawn: 2, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 3 }, { enemy: 'gunship', count: 1, interval: 3, spawn: 0, delay: 4 }] },
    { prep: 16, groups: [{ enemy: 'gunship', count: 2, interval: 4, spawn: 1 }, { enemy: 'tank', count: 1, interval: 2.5, spawn: 2 }, { enemy: 'runner', count: 5, interval: 0.6, spawn: 3, delay: 4 }] },
    { prep: 16, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 0 }, { enemy: 'gunship', count: 1, interval: 3, spawn: 3, delay: 3 }] },
    { prep: 16, groups: [{ enemy: 'gunship', count: 2, interval: 4, spawn: 1 }, { enemy: 'drone', count: 8, interval: 0.8, spawn: 2, delay: 1 }, { enemy: 'tank', count: 1, interval: 2, spawn: 3, delay: 3 }] },
    { prep: 18, groups: [{ enemy: 'gunship', count: 2, interval: 4, spawn: 0 }, { enemy: 'tank', count: 2, interval: 3, spawn: 1, delay: 3 }, { enemy: 'gunship', count: 1, interval: 3, spawn: 3, delay: 8 }] },
  ],
};

/** Длинный змеевидный маршрут: колонна идёт долго, топлива и зон одной группы на весь путь не хватает. */
const river: MissionConfig = {
  id: 'river',
  name: 'Речной караван',
  size: { w: 15, h: 9 },
  airfield: { x: 14, y: 8 },
  objective: {
    type: 'escort',
    route: [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 7 },
      { x: 5, y: 7 },
      { x: 5, y: 1 },
      { x: 8, y: 1 },
      { x: 8, y: 7 },
      { x: 10, y: 7 },
      { x: 10, y: 2 },
      { x: 14, y: 2 },
    ],
    hp: 28,
    speed: 0.25,
  },
  reward: { win: 190, loss: 40 },
  spawns: [
    { x: 0, y: 4 },
    { x: 4, y: 0 },
    { x: 14, y: 0 },
  ],
  baseLives: 1,
  /** У головы колонны на первом отрезке маршрута; дальше зоны ведут вслед за ней. */
  zones: [
    { x: 2, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 4 },
  ],
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 4, interval: 1.2, spawn: 0 }] },
    { prep: 10, groups: [{ enemy: 'tank', count: 2, interval: 3, spawn: 1 }, { enemy: 'drone', count: 3, interval: 1, spawn: 2, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'runner', count: 5, interval: 0.6, spawn: 2 }, { enemy: 'tank', count: 2, interval: 3, spawn: 0 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 6, interval: 0.8, spawn: 1 }, { enemy: 'tank', count: 2, interval: 2.5, spawn: 0, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'gunship', count: 2, interval: 3, spawn: 2 }, { enemy: 'runner', count: 5, interval: 0.6, spawn: 0, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 8, interval: 0.7, spawn: 1 }, { enemy: 'tank', count: 3, interval: 2.5, spawn: 2, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'gunship', count: 3, interval: 3, spawn: 0 }, { enemy: 'drone', count: 8, interval: 0.7, spawn: 2, delay: 2 }, { enemy: 'tank', count: 2, interval: 3, spawn: 1, delay: 4 }] },
  ],
};

/** Самая большая карта, пять входов, восемь волн: носители с роем, малозаметные и в конце тяжёлый бомбардировщик. */
const pass: MissionConfig = {
  id: 'pass',
  name: 'Горный перевал',
  size: { w: 19, h: 15 },
  airfield: { x: 18, y: 12 },
  objective: {
    type: 'escort',
    route: [
      { x: 0, y: 12 },
      { x: 6, y: 12 },
      { x: 6, y: 8 },
      { x: 2, y: 8 },
      { x: 2, y: 3 },
      { x: 9, y: 3 },
      { x: 9, y: 8 },
      { x: 14, y: 8 },
      { x: 14, y: 2 },
      { x: 18, y: 2 },
    ],
    hp: 50,
    speed: 0.3,
  },
  reward: { win: 240, loss: 50 },
  spawns: [
    { x: 0, y: 0 },
    { x: 9, y: 0 },
    { x: 18, y: 7 },
    { x: 9, y: 14 },
    { x: 0, y: 6 },
  ],
  baseLives: 1,
  /** У головы колонны на первом отрезке маршрута; дальше зоны ведут вслед за ней. */
  zones: [
    { x: 3, y: 11 },
    { x: 5, y: 10 },
    { x: 2, y: 10 },
  ],
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 5, interval: 1.2, spawn: 0 }] },
    { prep: 10, groups: [{ enemy: 'carrier', count: 1, interval: 1, spawn: 1 }, { enemy: 'runner', count: 4, interval: 0.7, spawn: 4, delay: 2 }] },
    { prep: 12, groups: [{ enemy: 'ghost', count: 2, interval: 2, spawn: 2 }, { enemy: 'drone', count: 5, interval: 1, spawn: 3, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'carrier', count: 1, interval: 1, spawn: 0 }, { enemy: 'drone', count: 6, interval: 0.8, spawn: 3, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'ghost', count: 2, interval: 2, spawn: 1 }, { enemy: 'runner', count: 6, interval: 0.6, spawn: 4, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'carrier', count: 1, interval: 1, spawn: 2 }, { enemy: 'drone', count: 6, interval: 0.8, spawn: 3, delay: 3 }, { enemy: 'runner', count: 4, interval: 0.6, spawn: 4, delay: 4 }] },
    { prep: 16, groups: [{ enemy: 'ghost', count: 3, interval: 1.6, spawn: 0 }, { enemy: 'drone', count: 8, interval: 0.7, spawn: 4, delay: 3 }, { enemy: 'runner', count: 5, interval: 0.6, spawn: 2, delay: 5 }] },
    { prep: 18, groups: [{ enemy: 'bomber', count: 1, interval: 1, spawn: 1 }, { enemy: 'carrier', count: 1, interval: 1, spawn: 3, delay: 4 }, { enemy: 'drone', count: 6, interval: 0.8, spawn: 0, delay: 5 }] },
  ],
};

export const MISSIONS: Record<string, MissionConfig> = {
  [evac.id]: evac,
  [convoy.id]: convoy,
  [radar.id]: radar,
  [bastion.id]: bastion,
  [river.id]: river,
  [pass.id]: pass,
};
