import { describe, expect, test } from 'vitest';
import { CONTENT, MISSIONS } from '../content';
import { createSim, snapshot, step, TICK_RATE } from '../sim';
import type { AirGroupConfig, Content, SimState } from '../sim';
import { auraZones, waveLook, wavePhase } from './auras';

const evac = MISSIONS.evac!;
const growlerCfg = CONTENT.groups.growler!;

const sortie = (content: Content, zone = { x: 5, y: 5 }) => {
  const sim = createSim(evac, content, 1, [{ group: 'growler', level: 0, zone }]);
  const phases: string[] = [];
  const zones: Array<ReturnType<typeof auraZones>> = [];
  for (let i = 0; i < 40 * TICK_RATE; i++) {
    step(sim);
    phases.push(sim.state.groups[0]!.phase);
    zones.push(auraZones({ content, state: snapshot(sim) }));
  }
  return { phases, zones };
};

describe('зоны аур', () => {
  test('круг есть ровно пока владелец патрулирует: не на взлёте, не в перелёте', () => {
    const { phases, zones } = sortie(CONTENT);
    expect(phases).toContain('takeoff');
    expect(phases).toContain('transit');
    expect(phases).toContain('patrol');
    phases.forEach((phase, i) => expect(zones[i]!.length > 0).toBe(phase === 'patrol'));
  });

  test('радиус и центр — зона владельца по умолчанию; Growler (давит врагов и усиливает союзников) даёт один круг', () => {
    const { phases, zones } = sortie(CONTENT, { x: 6, y: 4 });
    const z = zones[phases.indexOf('patrol')]!;
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ at: { x: 6, y: 4 }, radius: growlerCfg.zoneRadius, flow: 'out' });
  });

  test('любая группа с аурами: свой радиус модификатора, отдельный круг на радиус, вражеская аура сходится, global и self круга не дают', () => {
    const custom: AirGroupConfig = {
      ...growlerCfg,
      id: 'custom',
      auras: [
        { stat: 'range', op: 'add', value: 1, scope: 'aura', radius: 5 },
        { stat: 'speed', op: 'mul', value: 0.8, scope: 'aura', side: 'enemy', radius: 2 },
        { stat: 'speed', op: 'mul', value: 0.9, scope: 'aura', side: 'enemy', radius: 2 },
        { stat: 'income', op: 'add', value: 1, scope: 'global' },
        { stat: 'ammo', op: 'add', value: 1, scope: 'self' },
      ],
      upgrades: [],
    };
    const content: Content = { ...CONTENT, groups: { ...CONTENT.groups, custom } };
    const sim = createSim(evac, content, 1, [{ group: 'custom', level: 0, zone: { x: 5, y: 5 } }]);
    for (let i = 0; i < 20 * TICK_RATE && sim.state.groups[0]!.phase !== 'patrol'; i++) step(sim);
    const zones = auraZones({ content, state: snapshot(sim) });
    expect(zones.map((z) => [z.radius, z.flow])).toEqual([
      [2, 'in'],
      [5, 'out'],
    ]);
    expect(new Set(zones.map((z) => z.key)).size).toBe(2);
  });

  test('группа без аур и пустое состояние круга не дают', () => {
    const sim = createSim(evac, CONTENT, 1, [{ group: 'f16', level: 0, zone: { x: 5, y: 5 } }]);
    for (let i = 0; i < 20 * TICK_RATE; i++) step(sim);
    expect(sim.state.groups[0]!.phase).toBe('patrol');
    expect(auraZones({ content: CONTENT, state: snapshot(sim) })).toEqual([]);
    expect(auraZones({ content: CONTENT, state: { ...snapshot(sim), groups: [] } as SimState })).toEqual([]);
  });
});

describe('волны ауры', () => {
  test('фаза циклична, волны расходятся (out) или сходятся (in) и гаснут на краях цикла', () => {
    expect(wavePhase(0)).toBe(0);
    expect(wavePhase(900)).toBeCloseTo(0.5, 9);
    expect(wavePhase(1800 * 3 + 900)).toBeCloseTo(0.5, 9);
    expect(wavePhase(0, 0.5)).toBeCloseTo(0.5, 9);
    expect(waveLook(0, 'out').opacity).toBeCloseTo(0, 9);
    expect(waveLook(1, 'out').opacity).toBeCloseTo(0, 9);
    expect(waveLook(0.5, 'out').opacity).toBeGreaterThan(0.4);
    expect(waveLook(0.2, 'out').scale).toBeLessThan(waveLook(0.8, 'out').scale);
    expect(waveLook(0.2, 'in').scale).toBeGreaterThan(waveLook(0.8, 'in').scale);
    expect(waveLook(1, 'out').scale).toBeCloseTo(1, 9);
  });
});
