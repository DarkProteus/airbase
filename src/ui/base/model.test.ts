import { expect, test } from 'vitest';
import { CAMPAIGN, MISSIONS } from '../../content';
import { PROFILE_REJECTIONS } from '../../sim';
import { defaultMission, missionCards, missionSummary, OBJECTIVE_LABEL, REJECTION_TEXT, rejectionText, resetStep, starsText } from './model';

test('у каждой причины отказа есть непустой русский текст', () => {
  for (const reason of PROFILE_REJECTIONS) {
    expect(REJECTION_TEXT[reason], reason).toBeTruthy();
    expect(rejectionText(reason, 3)).not.toContain('{n}');
  }
  expect(Object.keys(REJECTION_TEXT).sort()).toEqual([...PROFILE_REJECTIONS].sort());
});

test('размер состава подставляется в текст', () => {
  expect(rejectionText('lineupIncomplete', 3)).toContain('3');
});

test('у каждого типа цели есть подпись, а сводка миссии показывает тип и награду', () => {
  const types = Object.values(MISSIONS).map((m) => m.objective!.type);
  expect([...new Set(types)].sort()).toEqual(['defend', 'escort']);
  for (const m of Object.values(MISSIONS)) {
    const text = missionSummary(m);
    expect(text).toContain(OBJECTIVE_LABEL[m.objective!.type]);
    expect(text).toContain(String(m.reward!.win));
    expect(text).toContain(String(m.reward!.loss));
  }
});

test('сброс прогресса: сначала вопрос, сброс только после подтверждения, отмена ничего не сбрасывает', () => {
  expect(resetStep('idle', 'ask')).toEqual({ step: 'confirm', reset: false });
  expect(resetStep('confirm', 'confirm')).toEqual({ step: 'idle', reset: true });
  expect(resetStep('confirm', 'cancel')).toEqual({ step: 'idle', reset: false });
  // подтверждение без вопроса сбросом не считается
  expect(resetStep('idle', 'confirm')).toEqual({ step: 'idle', reset: false });
});

test('кампания покрывает все миссии контента ровно по одному разу', () => {
  expect([...CAMPAIGN].sort()).toEqual(Object.keys(MISSIONS).sort());
  expect(new Set(CAMPAIGN).size).toBe(CAMPAIGN.length);
});

test('карточки миссий: порядок кампании, замки, звёзды и чем открыть', () => {
  const fresh = missionCards(MISSIONS, CAMPAIGN, {});
  expect(fresh.map((c) => c.id)).toEqual([...CAMPAIGN]);
  expect(fresh.map((c) => c.locked)).toEqual(CAMPAIGN.map((_, i) => i > 0));
  expect(fresh[1]!.unlockBy).toBe(MISSIONS[CAMPAIGN[0]!]!.name);
  expect(fresh[0]!.unlockBy).toBeUndefined();
  expect(defaultMission(fresh)).toBe(CAMPAIGN[0]);

  const mid = missionCards(MISSIONS, CAMPAIGN, { progress: { [CAMPAIGN[0]!]: 3, [CAMPAIGN[1]!]: 1 } });
  expect(mid.map((c) => c.locked)).toEqual(CAMPAIGN.map((_, i) => i > 2));
  expect(mid.slice(0, 3).map((c) => c.stars)).toEqual([3, 1, 0]);
  expect(defaultMission(mid)).toBe(CAMPAIGN[2]);

  const migrated = missionCards(MISSIONS, CAMPAIGN, { unlocked: CAMPAIGN.slice(0, 2) });
  expect(migrated.map((c) => c.locked)).toEqual(CAMPAIGN.map((_, i) => i > 1));
});

test('строка звёзд', () => {
  expect(starsText(0)).toBe('☆☆☆');
  expect(starsText(2)).toBe('★★☆');
  expect(starsText(5)).toBe('★★★');
});
