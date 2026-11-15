import { describe, expect, test } from 'vitest';
import { GROUPS, MISSIONS } from '../../content';
import { missionReward } from '../../sim';
import type { MatchStats, MissionResult } from '../../sim';
import { resultView, weakSpots } from './model';

const result = (patch: Partial<MissionResult> = {}): MissionResult => ({
  status: 'won',
  kills: 12,
  sorties: 5,
  killMoney: 90,
  income: 120,
  hp: 7.2,
  ticks: 30 * 95,
  stats: { groups: [], waves: [] },
  ...patch,
});

test('победа и поражение дают разные заголовки и подписи награды', () => {
  const m = MISSIONS.convoy!;
  const won = resultView(m, result(), missionReward(m, result()), 500, GROUPS);
  const lost = resultView(m, result({ status: 'lost', hp: 0 }), missionReward(m, result({ status: 'lost' })), 500, GROUPS);
  expect(won.title).toBe('Победа');
  expect(lost.title).toBe('Поражение');
  expect(won.reward[0]!.label).not.toBe(lost.reward[0]!.label);
});

test('статистика: время, убийства, вылеты и прочность цели по типу миссии', () => {
  const stats = (id: string) => Object.fromEntries(resultView(MISSIONS[id]!, result(), missionReward(MISSIONS[id]!, result()), 0, GROUPS).stats.map((r) => [r.label, r.value]));
  expect(stats('evac')).toMatchObject({ 'Время боя': '1:35', 'Сбито врагов': '12', 'Завершено вылетов': '5', 'Прочность объекта': '8' });
  expect(stats('convoy')['Прочность колонны']).toBe('8');
});

test('награда разложена по статьям, бонус вылетов показан, сумма сходится', () => {
  const m = MISSIONS.evac!;
  const reward = missionReward(m, result());
  const v = resultView(m, result(), reward, 700, GROUPS);
  expect(v.reward.map((r) => Number(r.value)).reduce((a, b) => a + b)).toBe(reward.total);
  expect(v.reward.find((r) => r.label.includes('Бонус'))!.value).toBe('120');
  expect(v.total.value).toBe(String(reward.total));
  expect(v.balance.value).toBe('700');
});

const tally = (id: number, type: string, kills: number, damage: number, patrolTicks: number) => ({ id, type, kills, damage, sorties: 3, patrolTicks });
const wave = (spawned: number, killed: number, leaked: number, damage: number) => ({ spawned, killed, leaked, damage });
const TICKS = 30 * 100;

describe('слабое место боя', () => {
  const busy = [tally(1, 'f16', 5, 60, TICKS * 0.5), tally(2, 'a10', 4, 90, TICKS * 0.4)];

  test('волна с наибольшим уроном по цели; при равенстве — больше прорвавшихся, затем более ранняя', () => {
    const stats: MatchStats = { groups: busy, waves: [wave(5, 5, 0, 0), wave(6, 3, 3, 6), wave(7, 4, 3, 6), wave(8, 6, 2, 4)] };
    const spots = weakSpots(stats, TICKS, GROUPS);
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ kind: 'wave', wave: 2, leaked: 3, damage: 6 });
    stats.waves[2]!.leaked = 4;
    expect(weakSpots(stats, TICKS, GROUPS)[0]).toMatchObject({ wave: 3 });
    stats.waves[3]!.damage = 9;
    expect(weakSpots(stats, TICKS, GROUPS)[0]).toMatchObject({ wave: 4 });
  });

  test('идеальная победа без прорывов и простоев слабого места не выдумывает', () => {
    expect(weakSpots({ groups: busy, waves: [wave(5, 5, 0, 0), wave(6, 6, 0, 0)] }, TICKS, GROUPS)).toEqual([]);
  });

  test('вооружённая группа без урона или с малой долей патруля помечена простаивавшей', () => {
    const waves = [wave(5, 5, 0, 0)];
    const zero = weakSpots({ groups: [busy[0]!, tally(2, 'a10', 0, 0, TICKS * 0.4)], waves }, TICKS, GROUPS);
    expect(zero).toMatchObject([{ kind: 'idle', group: 2 }]);
    const rare = weakSpots({ groups: [tally(1, 'f16', 2, 20, TICKS * 0.05), busy[1]!], waves }, TICKS, GROUPS);
    expect(rare).toMatchObject([{ kind: 'idle', group: 1 }]);
  });

  test('группа без оружия (поддержка) не считается простаивавшей', () => {
    const support = Object.values(GROUPS).find((g) => g.weapons.length === 0)!;
    expect(weakSpots({ groups: [tally(1, support.id, 0, 0, 0)], waves: [wave(1, 1, 0, 0)] }, TICKS, GROUPS)).toEqual([]);
  });
});

describe('разбор по группам и волнам на экране итога', () => {
  const stats: MatchStats = {
    groups: [tally(1, 'f16', 5, 60.4, TICKS * 0.5), tally(2, 'a10', 0, 0, TICKS * 0.25)],
    waves: [wave(5, 5, 0, 0), wave(6, 3, 3, 6), wave(0, 0, 0, 0)],
  };
  const v = resultView(MISSIONS.evac!, result({ stats, ticks: TICKS }), missionReward(MISSIONS.evac!, result()), 0, GROUPS);

  test('таблица групп: название из конфига, убийства, урон, вылеты, доля патруля; простаивавшая помечена', () => {
    expect(v.groups.rows[0]!.cells).toEqual([GROUPS.f16!.name, '5', '60', '3', '50%']);
    expect(v.groups.rows[1]).toMatchObject({ cells: [GROUPS.a10!.name, '0', '0', '3', '25%'], mark: 'idle' });
  });

  test('таблица волн: только начавшиеся, слабая волна помечена', () => {
    expect(v.waves.rows.map((r) => r.cells)).toEqual([['1', '5', '5', '0', '0'], ['2', '6', '3', '3', '6']]);
    expect(v.waves.rows.map((r) => r.mark)).toEqual([undefined, 'weak']);
    expect(v.waves.head.at(-1)).toBe('Урон по цели');
    expect(v.weak.map((w) => w.kind)).toEqual(['wave', 'idle']);
  });
});
