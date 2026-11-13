import { expect, test } from 'vitest';
import { PROFILE_REJECTIONS } from '../../sim';
import { REJECTION_TEXT, rejectionText } from './model';

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
