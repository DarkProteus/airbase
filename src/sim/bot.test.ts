import { describe, expect, test } from 'vitest';
import { CONTENT, MISSIONS } from '../content';
import { botZone, createSim, runMatch } from '.';
import type { EnemyState, Sim, Vec2 } from '.';

const evac = MISSIONS.evac!;
const target = evac.objective!.type === 'defend' ? evac.objective!.pos : { x: 0, y: 0 };

/** Матч с группой на цели миссии и врагами в заданных точках. */
function simWith(group: string, enemies: [string, Vec2][]): Sim {
  const sim = createSim(evac, CONTENT, 1, [{ group, level: 0, zone: { ...target } }]);
  sim.state.enemies = enemies.map(([type, pos], i): EnemyState => ({ id: 100 + i, type, wave: 0, hp: 1, speed: 1, dist: 0, pos }));
  return sim;
}
const zoneOf = (sim: Sim) => botZone(sim, sim.state.groups[0]!);
const west = { x: target.x - 4, y: target.y };
const east = { x: target.x + 4, y: target.y };

describe('бот: куда ставить зону', () => {
  test('без врагов зона на цели миссии', () => {
    expect(zoneOf(simWith('f16', []))).toEqual(target);
  });

  test('ударная группа выносит зону навстречу врагу, но цель миссии остаётся внутри зоны', () => {
    const zone = zoneOf(simWith('f16', [['drone', west]]));
    expect(zone.y).toBeCloseTo(target.y, 9);
    expect(zone.x).toBeLessThan(target.x);
    expect(target.x - zone.x).toBeLessThan(CONTENT.groups.f16!.zoneRadius);
  });

  test('враги с противоположных сторон — зона остаётся на цели', () => {
    const zone = zoneOf(simWith('f16', [['drone', west], ['drone', east]]));
    expect(zone.x).toBeCloseTo(target.x, 9);
    expect(zone.y).toBeCloseTo(target.y, 9);
  });

  test('враг, по которому группа не стреляет, и далёкий враг зону не сдвигают', () => {
    expect(zoneOf(simWith('f16', [['tank', west]]))).toEqual(target);
    expect(zoneOf(simWith('a10', [['tank', { x: target.x, y: 0 }]]))).not.toEqual(target);
    expect(zoneOf(simWith('a10', [['drone', west]]))).toEqual(target);
    const far = simWith('a10', [['tank', { x: target.x + 7.6, y: target.y }]]);
    expect(zoneOf(far)).toEqual(target);
  });

  test('группа поддержки (без оружия) держит зону на цели', () => {
    expect(zoneOf(simWith('growler', [['drone', west]]))).toEqual(target);
  });
});

test('runMatch детерминирован: тот же сид — тот же исход', () => {
  const lineup = ['f16', 'a10', 'c130'];
  expect(runMatch(evac, CONTENT, 7, lineup)).toEqual(runMatch(evac, CONTENT, 7, lineup));
});
