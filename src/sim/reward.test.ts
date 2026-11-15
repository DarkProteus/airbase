import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, MISSIONS } from '../content';
import { bestStars, creditReward, createSim, missionResult, missionReward, missionStars, missionUnlocked, recordStars, profileLineup, snapshot, step, TICK_RATE, MAX_STARS, REPEAT_SHARE, STAR_SHARE } from '.';
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
    const stars = r.earned * Math.round(convoy.reward!.win * STAR_SHARE);
    expect(r).toEqual({ base: convoy.reward!.win, stars, kills: 40, income: 60, total: convoy.reward!.win + stars + 100, earned: r.earned, first: true });
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
  const next = creditReward(profile, { base: 10, stars: 0, kills: 5, income: 5, total: 20, earned: 1, first: true });
  expect(next).toEqual({ ...profile, currency: 70 });
  expect(profile.currency).toBe(50);
});

describe('звёзды и кампания', () => {
  const maxHp = convoy.objective!.hp;
  const win = convoy.reward!.win;
  const star = Math.round(win * STAR_SHARE);

  test('звёзды: поражение — 0, победа — 1–3 по остатку прочности цели', () => {
    expect(missionStars(convoy, { status: 'lost', hp: maxHp })).toBe(0);
    expect(missionStars(convoy, { status: 'won', hp: maxHp })).toBe(3);
    expect(missionStars(convoy, { status: 'won', hp: maxHp * 0.7 })).toBe(3);
    expect(missionStars(convoy, { status: 'won', hp: maxHp * 0.69 })).toBe(2);
    expect(missionStars(convoy, { status: 'won', hp: maxHp * 0.35 })).toBe(2);
    expect(missionStars(convoy, { status: 'won', hp: maxHp * 0.34 })).toBe(1);
    expect(missionStars(convoy, { status: 'won', hp: 0.01 })).toBe(1);
    // Миссия без цели: доля жизней базы.
    const bare = { ...convoy, objective: undefined, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], baseLives: 10 };
    expect(missionStars(bare, { status: 'won', hp: 10 })).toBe(3);
    expect(missionStars(bare, { status: 'won', hp: 4 })).toBe(2);
    expect(missionStars(bare, { status: 'won', hp: 1 })).toBe(1);
  });

  test('первое прохождение и новые звёзды дороже повтора', () => {
    const three = result({ hp: maxHp });
    const one = result({ hp: 0.01 });
    const first3 = missionReward(convoy, three);
    const first1 = missionReward(convoy, one);
    expect(first3).toMatchObject({ base: win, stars: 3 * star, earned: 3, first: true });
    expect(first1).toMatchObject({ base: win, stars: star, earned: 1, first: true });
    // Повтор без новых звёзд: доля базы, бонуса за звёзды нет.
    const repeat = missionReward(convoy, three, 3);
    expect(repeat).toMatchObject({ base: Math.round(win * REPEAT_SHARE), stars: 0, earned: 3, first: false });
    expect(repeat.total).toBeLessThan(first1.total);
    // Повтор с улучшением результата: платят только за новые звёзды.
    const better = missionReward(convoy, three, 1);
    expect(better).toMatchObject({ base: Math.round(win * REPEAT_SHARE), stars: 2 * star, first: false });
    expect(better.total).toBeGreaterThan(repeat.total);
    // Результат хуже лучшего — бонуса нет, отрицательным он не бывает.
    expect(missionReward(convoy, one, 3).stars).toBe(0);
    // Сумма по частям: пройти на 1, потом на 3 звезды — те же звёздные деньги, что сразу на 3.
    expect(first1.stars + better.stars).toBe(first3.stars);
  });

  test('поражение: утешительная сумма миссии, без звёзд, прежний результат на неё не влияет', () => {
    const lost = result({ status: 'lost', hp: 0 });
    for (const best of [0, 2]) {
      expect(missionReward(convoy, lost, best)).toEqual({ base: convoy.reward!.loss, stars: 0, kills: 40, income: 60, total: convoy.reward!.loss + 100, earned: 0, first: false });
    }
  });

  test('recordStars хранит лучший результат; поражение и худший результат профиль не меняют', () => {
    const p: Profile = { currency: 5, levels: {}, lineup: [] };
    expect(recordStars(p, 'convoy', 0)).toBe(p);
    const two = recordStars(p, 'convoy', 2);
    expect(two).toEqual({ ...p, progress: { convoy: 2 } });
    expect(p.progress).toBeUndefined();
    expect(recordStars(two, 'convoy', 1)).toBe(two);
    expect(recordStars(two, 'convoy', 2)).toBe(two);
    expect(bestStars(recordStars(two, 'convoy', 9), 'convoy')).toBe(MAX_STARS);
    expect(bestStars(recordStars(two, 'evac', 1), 'convoy')).toBe(2);
  });

  test('цепочка: первая открыта, следующая — после победы в предыдущей; unlocked открывает помимо цепочки', () => {
    const chain = ['a', 'b', 'c'];
    const fresh = {};
    expect(chain.map((id) => missionUnlocked(fresh, chain, id))).toEqual([true, false, false]);
    expect(chain.map((id) => missionUnlocked({ progress: { a: 1 } }, chain, id))).toEqual([true, true, false]);
    expect(chain.map((id) => missionUnlocked({ progress: { a: 3, b: 1 } }, chain, id))).toEqual([true, true, true]);
    expect(chain.map((id) => missionUnlocked({ unlocked: ['a', 'b'] }, chain, id))).toEqual([true, true, false]);
    expect(missionUnlocked(fresh, chain, 'outside')).toBe(true);
  });
});
