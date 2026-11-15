import { expect, test } from 'vitest';
import { MISSIONS } from '../../content';
import { PROFILE_REJECTIONS } from '../../sim';
import { missionSummary, OBJECTIVE_LABEL, REJECTION_TEXT, rejectionText, resetStep } from './model';

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
  expect(types.sort()).toEqual(['defend', 'escort']);
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
