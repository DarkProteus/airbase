import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { createSim, flowStep, initialFlow, missionReward, missionResult, snapshot, step, TICK_RATE } from '.';
import type { Flow, FlowEvent, Profile, SimState } from '.';

const mission = MISSIONS.convoy!;
const FULL: Profile = { currency: 100, levels: { f16: 0, a10: 0, c130: 1 }, lineup: ['f16', 'a10', 'c130'] };

const sortie = (seed = 1, missionCfg = mission): FlowEvent => ({
  type: 'sortie',
  mission: missionCfg,
  lineupSize: LINEUP_SIZE,
  zones: DEFAULT_ZONES,
  seed,
});

/** Конечное состояние матча состава профиля. */
function finished(flow: Extract<Flow, { screen: 'battle' }>): SimState {
  const sim = createSim(flow.mission, CONTENT, flow.seed, flow.lineup);
  while (sim.state.status === 'running' && sim.state.tick < 600 * TICK_RATE) step(sim);
  return snapshot(sim);
}

const toBattle = (profile = FULL, seed = 1) => flowStep(initialFlow(profile), sortie(seed)) as Extract<Flow, { screen: 'battle' }>;

describe('поток экранов', () => {
  test('старт — база с переданным профилем', () => {
    expect(initialFlow(START_PROFILE)).toEqual({ screen: 'base', profile: START_PROFILE });
  });

  test('база -> бой: состав и уровни профиля, миссия и сид из события', () => {
    const battle = toBattle(FULL, 42);
    expect(battle.screen).toBe('battle');
    expect(battle.mission).toBe(mission);
    expect(battle.seed).toBe(42);
    expect(battle.lineup.map((e) => [e.group, e.level])).toEqual([['f16', 0], ['a10', 0], ['c130', 1]]);
    expect(battle.profile).toBe(FULL);
  });

  test('вылет с неполным составом невозможен', () => {
    const base = initialFlow(START_PROFILE);
    expect(flowStep(base, sortie())).toBe(base);
  });

  test('бой -> итог -> база -> новый бой', () => {
    const battle = toBattle();
    const result = flowStep(battle, { type: 'finish', final: finished(battle) });
    expect(result.screen).toBe('result');
    const base = flowStep(result, { type: 'home' });
    expect(base.screen).toBe('base');
    expect(flowStep(base, sortie(7)).screen).toBe('battle');
  });

  test('повторный вылет создаёт новый матч с новым сидом', () => {
    const first = toBattle(FULL, 1);
    const result = flowStep(first, { type: 'finish', final: finished(first) });
    const second = flowStep(flowStep(result, { type: 'home' }), sortie(2)) as typeof first;
    expect(second).not.toBe(first);
    expect(second.seed).toBe(2);
    expect(second.seed).not.toBe(first.seed);
  });

  test('из боя на базу попасть нельзя: home в бою игнорируется', () => {
    const battle = toBattle();
    expect(flowStep(battle, { type: 'home' })).toBe(battle);
  });

  test('бой нельзя закончить, пока матч идёт', () => {
    const battle = toBattle();
    const running = createSim(battle.mission, CONTENT, battle.seed, battle.lineup).state;
    expect(flowStep(battle, { type: 'finish', final: running })).toBe(battle);
  });

  test('профиль меняется только на базе', () => {
    const battle = toBattle();
    const other: Profile = { ...FULL, currency: 1 };
    expect(flowStep(battle, { type: 'profile', profile: other })).toBe(battle);
    expect(flowStep(initialFlow(FULL), { type: 'profile', profile: other })).toEqual({ screen: 'base', profile: other });
  });

  test('sortie и finish вне своих экранов ничего не меняют', () => {
    const battle = toBattle();
    const final = finished(battle);
    const base = initialFlow(FULL);
    expect(flowStep(base, { type: 'finish', final })).toBe(base);
    expect(flowStep(battle, sortie())).toBe(battle);
    const result = flowStep(battle, { type: 'finish', final });
    expect(flowStep(result, sortie())).toBe(result);
  });
});

describe('награда начисляется в профиль ровно один раз', () => {
  const battle = toBattle();
  const final = finished(battle);
  const expected = missionReward(mission, missionResult(final)!);

  test('при переходе в итог валюта растёт на награду, показанную на экране', () => {
    const result = flowStep(battle, { type: 'finish', final }) as Extract<Flow, { screen: 'result' }>;
    expect(result.reward).toEqual(expected);
    expect(result.result.stats).toEqual(final.stats);
    expect(result.reward.total).toBeGreaterThan(0);
    expect(result.profile.currency).toBe(FULL.currency + expected.total);
  });

  test('повторные finish (StrictMode, двойной эффект) не начисляют второй раз', () => {
    const once = flowStep(battle, { type: 'finish', final });
    const twice = flowStep(flowStep(once, { type: 'finish', final }), { type: 'finish', final });
    expect(twice).toBe(once);
    expect((twice as Extract<Flow, { screen: 'result' }>).profile.currency).toBe(FULL.currency + expected.total);
  });

  test('возврат на базу сохраняет начисленное, повторный home ничего не добавляет', () => {
    const base = flowStep(flowStep(battle, { type: 'finish', final }), { type: 'home' });
    expect(base).toEqual({ screen: 'base', profile: { ...FULL, currency: FULL.currency + expected.total } });
    expect(flowStep(base, { type: 'home' })).toBe(base);
  });

  test('бонус C-130 входит в награду', () => {
    expect(expected.income).toBeGreaterThan(0);
  });
});
