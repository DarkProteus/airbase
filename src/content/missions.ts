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
  slots: proto.slots,
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

export const MISSIONS: Record<string, MissionConfig> = { [proto.id]: proto, [sortie.id]: sortie };
