import { afterEach, expect, test, vi } from 'vitest';
import { createSim, DT, snapshot, step } from '../../sim';
import type { Command, Content, MissionConfig, SimEvent, SimState } from '../../sim';
import { startGame, withEvents } from './driver';

const content: Content = {
  groups: {
    gun: { id: 'gun', name: 'Gun', role: 'r', cost: 10, tags: [], speed: 5, fuel: 100, ammo: 100, takeoffTime: 0, rearmTime: 1, zoneRadius: 20, weapons: [{ damage: 5, fireRate: 3, targetTags: [] }], auras: [], upgrades: [] },
  },
  enemies: { e: { id: 'e', name: 'E', hp: 8, speed: 2, reward: 1, leakDamage: 1, tags: [] } },
};
const mission: MissionConfig = {
  id: 'm',
  name: 'M',
  size: { w: 10, h: 3 },
  airfield: { x: 0, y: 0 },
  path: [
    { x: 0, y: 1 },
    { x: 9, y: 1 },
  ],
  baseLives: 5,
  waves: [{ prep: 0.1, groups: [{ enemy: 'e', count: 4, interval: 0.3 }] }],
};

afterEach(() => vi.unstubAllGlobals());

test('withEvents подменяет events копией переданных', () => {
  const sim = createSim(mission, content, 1);
  const evs: SimEvent[] = [{ type: 'waveStart', wave: 0 }];
  const s = withEvents(snapshot(sim), evs);
  expect(s.events).toEqual(evs);
  expect(s.events).not.toBe(evs);
});

test('драйвер отдаёт события всех шагов кадра, а не только последнего тика', () => {
  let cb: ((t: number) => void) | undefined;
  vi.stubGlobal('requestAnimationFrame', (f: (t: number) => void) => ((cb = f), 1));
  vi.stubGlobal('cancelAnimationFrame', () => {});

  const snaps: SimState[] = [];
  const lineup = [{ group: 'gun', level: 0, zone: { x: 3, y: 0 } }];
  const driver = startGame(mission, content, 7, (s) => snaps.push(s), lineup);
  const move: Command = { type: 'setZone', group: 1, zone: { x: 4, y: 1 } };
  driver.dispatch(move);

  // Эталон: те же команды и тики на голой sim.
  const ref = createSim(mission, content, 7, lineup);
  const refEvents: SimEvent[] = [];
  let t = 0;
  cb?.(t); // первый кадр: dt = 0
  let first = true;
  let lastTickOnly = 0;
  for (let frame = 0; frame < 40; frame++) {
    t += DT * 4 * 1000 + 1; // 4 тика за кадр
    const before = snaps.length;
    cb?.(t);
    if (snaps.length === before) continue;
    for (let i = 0; i < 4; i++) {
      step(ref, first ? [move] : []);
      first = false;
      refEvents.push(...ref.state.events);
    }
    lastTickOnly += ref.state.events.length; // что бы увидел потребитель без накопления
  }
  const got = snaps.slice(1).flatMap((s) => s.events);
  expect(got.length).toBeGreaterThan(lastTickOnly); // без накопления промежуточные тики терялись бы
  expect(got).toEqual(refEvents);
  expect(got.some((e) => e.type === 'zoneSet')).toBe(true);
  expect(got.some((e) => e.type === 'groupShot')).toBe(true);
  driver.stop();
});
