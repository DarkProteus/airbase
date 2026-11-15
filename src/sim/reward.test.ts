import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, MISSIONS } from '../content';
import { creditReward, createSim, missionResult, missionReward, profileLineup, snapshot, step, TICK_RATE } from '.';
import type { MissionResult, Profile, SimState } from '.';

const evac = MISSIONS.evac!;
const convoy = MISSIONS.convoy!;

/** Матч до конца: состав из id групп уровня 0 по зонам по умолчанию. */
function play(mission = convoy, groups: string[] = ['f16', 'a10', 'c130']): SimState {
  const profile: Profile = { currency: 0, levels: Object.fromEntries(groups.map((g) => [g, 0])), lineup: groups };
  const sim = createSim(mission, CONTENT, 1, profileLineup(profile, DEFAULT_ZONES));
  while (sim.state.status === 'running' && sim.state.tick < 600 * TICK_RATE) step(sim);
  return snapshot(sim);
}

const result = (patch: Partial<MissionResult> = {}): MissionResult => ({
  status: 'won',
  kills: 3,
  sorties: 2,
  killMoney: 40,
  income: 60,
  hp: 10,
  ticks: 100,
  stats: { groups: [], waves: [] },
  ...patch,
});

describe('missionResult', () => {
  test('пока матч идёт, итога нет', () => {
    const sim = createSim(convoy, CONTENT, 1);
    expect(missionResult(sim.state)).toBeUndefined();
  });

  test('итог законченного матча согласован со счётчиками состояния', () => {
    const final = play();
    const r = missionResult(final)!;
    expect(r.status).toBe(final.status);
    expect(r.kills).toBe(final.kills);
    expect(r.killMoney + r.income).toBe(final.money);
    expect(r.sorties).toBe(final.groups.reduce((n, g) => n + g.sorties, 0));
    expect(r.stats).toEqual(final.stats);
  });

  test('бонус группы с income входит в итог, без неё — нулевой', () => {
    expect(missionResult(play(convoy, ['f16', 'a10', 'c130']))!.income).toBeGreaterThan(0);
    expect(missionResult(play(convoy, ['f16', 'a10', 'growler']))!.income).toBe(0);
  });
});

describe('missionReward', () => {
  test('база исхода берётся из конфига миссии: победа и поражение', () => {
    expect(missionReward(evac, result({ status: 'won' })).base).toBe(evac.reward!.win);
    expect(missionReward(evac, result({ status: 'lost' })).base).toBe(evac.reward!.loss);
  });

  test('итог = база + убийства + бонус групп', () => {
    const r = missionReward(convoy, result());
    expect(r).toEqual({ base: convoy.reward!.win, kills: 40, income: 60, total: convoy.reward!.win + 100 });
  });

  test('миссия без reward даёт только заработанное в бою', () => {
    const { reward: _reward, ...bare } = convoy;
    expect(missionReward(bare, result()).total).toBe(100);
  });

  test('функция чистая: одинаковый вход — одинаковый выход', () => {
    expect(missionReward(convoy, result())).toEqual(missionReward(convoy, result()));
  });

  test('победа выгоднее поражения при прочих равных', () => {
    for (const m of [evac, convoy]) expect(m.reward!.win).toBeGreaterThan(m.reward!.loss);
  });

  test('состав с C-130 получает больше без него: бонус виден в награде', () => {
    const with130 = missionReward(convoy, missionResult(play(convoy, ['f16', 'a10', 'c130']))!);
    const without = missionReward(convoy, missionResult(play(convoy, ['f16', 'a10', 'growler']))!);
    expect(with130.income).toBeGreaterThan(0);
    expect(without.income).toBe(0);
  });
});

test('creditReward прибавляет награду к валюте и не трогает остальное', () => {
  const profile: Profile = { currency: 50, levels: { f16: 1 }, lineup: ['f16'] };
  const next = creditReward(profile, { base: 10, kills: 5, income: 5, total: 20 });
  expect(next).toEqual({ ...profile, currency: 70 });
  expect(profile.currency).toBe(50);
});
