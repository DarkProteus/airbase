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
    { at: 2, groups: [{ enemy: 'drone', count: 5, interval: 1 }] },
    { at: 15, groups: [{ enemy: 'drone', count: 10, interval: 0.6 }] },
  ],
};

export const MISSIONS: Record<string, MissionConfig> = { [proto.id]: proto };
