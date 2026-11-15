import type { MissionConfig } from '../sim';

/** Цель defend: удержать штаб до конца эвакуации; враги идут с трёх сторон, аэродром — в дальнем углу. */
const evac: MissionConfig = {
  id: 'evac',
  name: 'Эвакуация',
  size: { w: 13, h: 11 },
  airfield: { x: 12, y: 1 },
  /** Хребет на северо-западе и юго-востоке уводит дроны с прямой, озеро заставляет танки обходить его. */
  terrain: [
    '.............',
    '.............',
    '.............',
    '..##.........',
    '.............',
    '.............',
    '..~~.........',
    '.~~~....##...',
    '..~~....##...',
    '.............',
    '.............',
  ],
  objective: { type: 'defend', pos: { x: 5, y: 5 }, hp: 20, duration: 90 },
  reward: { win: 120, loss: 30 },
  bases: [
    { id: 'uav-north', name: 'Площадка БПЛА', pos: { x: 0, y: 1 }, roster: [{ enemy: 'drone' }, { enemy: 'runner', fromWave: 3 }] },
    { id: 'armor', name: 'Танковая база', pos: { x: 0, y: 9 }, roster: [{ enemy: 'tank', fromWave: 2 }] },
    { id: 'uav-south', name: 'Полевой лагерь', pos: { x: 11, y: 10 }, roster: [{ enemy: 'drone', fromWave: 2 }, { enemy: 'runner', fromWave: 4 }] },
  ],
  baseLives: 1,
  waves: [
    { prep: 6, groups: [{ enemy: 'drone', count: 4, interval: 1.4, base: 0 }] },
    { prep: 10, groups: [{ enemy: 'tank', count: 2, interval: 4, base: 1 }, { enemy: 'drone', count: 4, interval: 1.2, base: 2, delay: 2 }] },
    { prep: 12, groups: [{ enemy: 'runner', count: 4, interval: 0.8, base: 0 }, { enemy: 'tank', count: 2, interval: 4, base: 1 }] },
    { prep: 12, groups: [{ enemy: 'drone', count: 6, interval: 0.9, base: 0 }, { enemy: 'runner', count: 4, interval: 0.7, base: 2, delay: 3 }, { enemy: 'tank', count: 3, interval: 4, base: 1, delay: 5 }] },
  ],
};

/** Цель escort: колонна идёт через карту к выходу, враги наводятся на неё; зоны приходится двигать вслед. */
const convoy: MissionConfig = {
  id: 'convoy',
  name: 'Колонна',
  size: { w: 13, h: 11 },
  airfield: { x: 12, y: 1 },
  /** Горы внутри петли маршрута закрывают танкам короткий путь, хребты у баз разводят воздушных врагов по проходам. */
  terrain: [
    '.............',
    '.............',
    '..##.........',
    '..##.........',
    '.............',
    '......^^.....',
    '......^^..##.',
    '......^^..##.',
    '.............',
    '.............',
    '.............',
  ],
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
  bases: [
    { id: 'uav', name: 'Площадка БПЛА', pos: { x: 0, y: 0 }, roster: [{ enemy: 'drone' }] },
    { id: 'armor', name: 'Танковая база', pos: { x: 6, y: 10 }, roster: [{ enemy: 'tank', fromWave: 2 }] },
    { id: 'scouts', name: 'Аэродром разведчиков', pos: { x: 12, y: 5 }, roster: [{ enemy: 'runner', fromWave: 3 }, { enemy: 'drone', fromWave: 4 }] },
  ],
  baseLives: 1,
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 5, interval: 1.2, base: 0 }] },
    { prep: 10, groups: [{ enemy: 'tank', count: 2, interval: 3, base: 1 }, { enemy: 'drone', count: 4, interval: 1, base: 0, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'runner', count: 6, interval: 0.6, base: 2 }, { enemy: 'tank', count: 2, interval: 3, base: 1 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 8, interval: 0.7, base: 2 }, { enemy: 'tank', count: 3, interval: 2.5, base: 1, delay: 2 }] },
  ],
};

/** Малая карта, враги почти все малозаметные: без группы обнаружения (ДРЛО) в зоне их никто не атакует. */
const radar: MissionConfig = {
  id: 'radar',
  name: 'Радарный пост',
  size: { w: 11, h: 9 },
  airfield: { x: 5, y: 8 },
  /** Два хребта к северу от радара: площадки отрезаны от прямого пути, враги выходят к посту через проходы. */
  terrain: [
    '..##.......',
    '..##...##..',
    '.......##..',
    '...........',
    '...........',
    '...........',
    '...........',
    '...........',
    '...........',
  ],
  objective: { type: 'defend', pos: { x: 5, y: 3 }, hp: 28, duration: 110 },
  reward: { win: 170, loss: 40 },
  bases: [
    { id: 'uav', name: 'Площадка БПЛА', pos: { x: 0, y: 0 }, roster: [{ enemy: 'drone' }, { enemy: 'runner', fromWave: 3 }, { enemy: 'ghost', fromWave: 5 }] },
    { id: 'stealth', name: 'Скрытая площадка', pos: { x: 10, y: 0 }, roster: [{ enemy: 'ghost', fromWave: 2 }] },
  ],
  baseLives: 1,
  /** Кольцом вокруг радара: зоны близко друг к другу, чтобы ауры Growler и ДРЛО накрывали соседей, а малозаметные цели попадали под обнаружение. */
  zones: [
    { x: 4, y: 2 },
    { x: 6, y: 2 },
    { x: 5, y: 4 },
  ],
  waves: [
    { prep: 6, groups: [{ enemy: 'drone', count: 4, interval: 1.4, base: 0 }] },
    { prep: 10, groups: [{ enemy: 'ghost', count: 2, interval: 2.5, base: 1 }, { enemy: 'drone', count: 4, interval: 1.2, base: 0, delay: 2 }] },
    { prep: 12, groups: [{ enemy: 'ghost', count: 3, interval: 2, base: 1 }, { enemy: 'runner', count: 4, interval: 0.8, base: 0, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'ghost', count: 3, interval: 1.8, base: 1 }, { enemy: 'drone', count: 6, interval: 1, base: 0, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'ghost', count: 3, interval: 1.8, base: 0 }, { enemy: 'ghost', count: 2, interval: 2, base: 1, delay: 3 }, { enemy: 'runner', count: 4, interval: 0.8, base: 0, delay: 5 }] },
    { prep: 14, groups: [{ enemy: 'ghost', count: 3, interval: 1.8, base: 0 }, { enemy: 'ghost', count: 3, interval: 1.8, base: 1, delay: 1 }, { enemy: 'drone', count: 6, interval: 1, base: 0, delay: 4 }] },
  ],
};

/** Большая карта, четыре входа: ударные вертолёты в броне и колонны техники — без штурмовика не отбиться. */
const bastion: MissionConfig = {
  id: 'bastion',
  name: 'Укрепрайон',
  size: { w: 17, h: 13 },
  airfield: { x: 0, y: 10 },
  /** Горная гряда с проходом на севере сводит танки обеих баз в один коридор, озеро закрывает запад, хребет на юго-востоке уводит вертолёты к югу. */
  terrain: [
    '.................',
    '.................',
    '.................',
    '...^^^^^...^^^^..',
    '...^^.......^^^..',
    '...^..........^..',
    '...^..........^..',
    '..~~.........##..',
    '..~~~.......###..',
    '...~~.......##...',
    '.................',
    '.................',
    '.................',
  ],
  objective: { type: 'defend', pos: { x: 9, y: 6 }, hp: 47, duration: 150 },
  reward: { win: 200, loss: 45 },
  bases: [
    { id: 'armor', name: 'Танковая база', pos: { x: 16, y: 0 }, roster: [{ enemy: 'tank' }] },
    { id: 'helipad', name: 'Вертолётная площадка', pos: { x: 16, y: 12 }, roster: [{ enemy: 'gunship', fromWave: 2 }] },
    { id: 'uav', name: 'Площадка БПЛА', pos: { x: 8, y: 0 }, roster: [{ enemy: 'drone', fromWave: 2 }, { enemy: 'runner', fromWave: 4 }] },
    { id: 'west', name: 'Западный лагерь', pos: { x: 0, y: 2 }, roster: [{ enemy: 'tank', fromWave: 3 }, { enemy: 'gunship', fromWave: 5 }] },
  ],
  baseLives: 1,
  /** Вплотную вокруг объекта: на большой карте четыре входа, и разнесённые зоны не успевают прикрыть цель; ауры накрывают соседей. */
  zones: [
    { x: 9, y: 5 },
    { x: 9, y: 7 },
    { x: 8, y: 6 },
  ],
  waves: [
    { prep: 6, groups: [{ enemy: 'tank', count: 2, interval: 3, base: 0 }] },
    { prep: 12, groups: [{ enemy: 'gunship', count: 1, interval: 3, base: 1 }, { enemy: 'drone', count: 5, interval: 1, base: 2, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'tank', count: 2, interval: 3, base: 3 }, { enemy: 'gunship', count: 1, interval: 3, base: 1, delay: 4 }] },
    { prep: 16, groups: [{ enemy: 'gunship', count: 2, interval: 4, base: 1 }, { enemy: 'tank', count: 1, interval: 2.5, base: 0 }, { enemy: 'runner', count: 5, interval: 0.6, base: 2, delay: 4 }] },
    { prep: 16, groups: [{ enemy: 'tank', count: 2, interval: 3, base: 0 }, { enemy: 'gunship', count: 1, interval: 3, base: 3, delay: 3 }] },
    { prep: 16, groups: [{ enemy: 'gunship', count: 2, interval: 4, base: 1 }, { enemy: 'drone', count: 8, interval: 0.8, base: 2, delay: 1 }, { enemy: 'tank', count: 1, interval: 2, base: 3, delay: 3 }] },
    { prep: 18, groups: [{ enemy: 'gunship', count: 2, interval: 4, base: 3 }, { enemy: 'tank', count: 2, interval: 3, base: 0, delay: 3 }, { enemy: 'gunship', count: 1, interval: 3, base: 1, delay: 8 }] },
  ],
};

/** Длинный змеевидный маршрут: колонна идёт долго, топлива и зон одной группы на весь путь не хватает. */
const river: MissionConfig = {
  id: 'river',
  name: 'Речной караван',
  size: { w: 15, h: 9 },
  airfield: { x: 14, y: 8 },
  /** Река между первыми петлями маршрута, хребет посреди карты и на востоке: к колонне выходят через проходы у северного и южного края. */
  terrain: [
    '...............',
    '...............',
    '...~~.##.......',
    '...~~.##.......',
    '...~~.##...##..',
    '...~~.##...##..',
    '...~~.##...##..',
    '...............',
    '...............',
  ],
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
    hp: 38,
    speed: 0.25,
  },
  reward: { win: 190, loss: 40 },
  bases: [
    { id: 'uav', name: 'Площадка БПЛА', pos: { x: 0, y: 4 }, roster: [{ enemy: 'drone' }, { enemy: 'runner', fromWave: 5 }] },
    { id: 'armor', name: 'Танковая база', pos: { x: 4, y: 0 }, roster: [{ enemy: 'tank', fromWave: 2 }] },
    { id: 'east', name: 'Восточная база', pos: { x: 14, y: 0 }, roster: [{ enemy: 'drone', fromWave: 2 }, { enemy: 'runner', fromWave: 3 }, { enemy: 'gunship', fromWave: 5 }] },
  ],
  baseLives: 1,
  /** У головы колонны на первом отрезке маршрута; дальше зоны ведут вслед за ней. */
  zones: [
    { x: 2, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 4 },
  ],
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 4, interval: 1.2, base: 0 }] },
    { prep: 10, groups: [{ enemy: 'tank', count: 2, interval: 3, base: 1 }, { enemy: 'drone', count: 3, interval: 1, base: 2, delay: 3 }] },
    { prep: 12, groups: [{ enemy: 'runner', count: 5, interval: 0.6, base: 2 }, { enemy: 'tank', count: 2, interval: 3, base: 1 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 6, interval: 0.8, base: 0 }, { enemy: 'tank', count: 2, interval: 2.5, base: 1, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'gunship', count: 2, interval: 3, base: 2 }, { enemy: 'runner', count: 5, interval: 0.6, base: 0, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'drone', count: 8, interval: 0.7, base: 0 }, { enemy: 'tank', count: 3, interval: 2.5, base: 1, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'gunship', count: 3, interval: 3, base: 2 }, { enemy: 'drone', count: 8, interval: 0.7, base: 2, delay: 2 }, { enemy: 'tank', count: 2, interval: 3, base: 1, delay: 4 }] },
  ],
};

/** Самая большая карта, пять входов, восемь волн: носители с роем, малозаметные и в конце тяжёлый бомбардировщик. */
const pass: MissionConfig = {
  id: 'pass',
  name: 'Горный перевал',
  size: { w: 19, h: 15 },
  airfield: { x: 18, y: 12 },
  /** Хребты внутри петель маршрута: воздушные враги выходят к колонне через перевалы между ними. */
  terrain: [
    '...................',
    '...................',
    '...................',
    '...........##......',
    '....####...##...##.',
    '....####...##...##.',
    '....####...##......',
    '...........##......',
    '...................',
    '...##..............',
    '...##.....####.....',
    '..........####.....',
    '...................',
    '...................',
    '...................',
  ],
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
    hp: 43,
    speed: 0.3,
  },
  reward: { win: 240, loss: 50 },
  bases: [
    { id: 'uav', name: 'Площадка БПЛА', pos: { x: 0, y: 0 }, roster: [{ enemy: 'drone' }, { enemy: 'ghost', fromWave: 7 }] },
    { id: 'carriers', name: 'Авиабаза носителей', pos: { x: 9, y: 0 }, roster: [{ enemy: 'carrier', fromWave: 2 }, { enemy: 'bomber', fromWave: 8 }] },
    { id: 'stealth', name: 'Скрытая площадка', pos: { x: 18, y: 7 }, roster: [{ enemy: 'ghost', fromWave: 3 }, { enemy: 'runner', fromWave: 7 }] },
    { id: 'uav-south', name: 'Южная площадка БПЛА', pos: { x: 9, y: 14 }, roster: [{ enemy: 'drone', fromWave: 3 }, { enemy: 'carrier', fromWave: 8 }] },
    { id: 'scouts', name: 'Аэродром разведчиков', pos: { x: 0, y: 6 }, roster: [{ enemy: 'runner', fromWave: 2 }, { enemy: 'drone', fromWave: 7 }] },
  ],
  baseLives: 1,
  /** У головы колонны на первом отрезке маршрута; дальше зоны ведут вслед за ней. */
  zones: [
    { x: 3, y: 11 },
    { x: 5, y: 10 },
    { x: 2, y: 10 },
  ],
  waves: [
    { prep: 5, groups: [{ enemy: 'drone', count: 5, interval: 1.2, base: 0 }] },
    { prep: 10, groups: [{ enemy: 'carrier', count: 1, interval: 1, base: 1 }, { enemy: 'runner', count: 4, interval: 0.7, base: 4, delay: 2 }] },
    { prep: 12, groups: [{ enemy: 'ghost', count: 2, interval: 2, base: 2 }, { enemy: 'drone', count: 5, interval: 1, base: 3, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'carrier', count: 1, interval: 1, base: 1 }, { enemy: 'drone', count: 6, interval: 0.8, base: 3, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'ghost', count: 2, interval: 2, base: 2 }, { enemy: 'runner', count: 6, interval: 0.6, base: 4, delay: 2 }] },
    { prep: 14, groups: [{ enemy: 'carrier', count: 1, interval: 1, base: 1 }, { enemy: 'drone', count: 6, interval: 0.8, base: 3, delay: 3 }, { enemy: 'runner', count: 4, interval: 0.6, base: 4, delay: 4 }] },
    { prep: 16, groups: [{ enemy: 'ghost', count: 3, interval: 1.6, base: 0 }, { enemy: 'drone', count: 8, interval: 0.7, base: 4, delay: 3 }, { enemy: 'runner', count: 5, interval: 0.6, base: 2, delay: 5 }] },
    { prep: 18, groups: [{ enemy: 'bomber', count: 1, interval: 1, base: 1 }, { enemy: 'carrier', count: 1, interval: 1, base: 3, delay: 4 }, { enemy: 'drone', count: 6, interval: 0.8, base: 0, delay: 5 }] },
  ],
};

/** Порядок кампании: первая миссия открыта сразу, следующая открывается победой в предыдущей. */
export const CAMPAIGN: readonly string[] = [evac.id, convoy.id, radar.id, bastion.id, river.id, pass.id];

export const MISSIONS: Record<string, MissionConfig> = {
  [evac.id]: evac,
  [convoy.id]: convoy,
  [radar.id]: radar,
  [bastion.id]: bastion,
  [river.id]: river,
  [pass.id]: pass,
};
