import { expect, test } from 'vitest';
import { MISSIONS } from '../../content';
import { missionReward } from '../../sim';
import type { MissionResult } from '../../sim';
import { resultView } from './model';

const result = (patch: Partial<MissionResult> = {}): MissionResult => ({
  status: 'won',
  kills: 12,
  sorties: 5,
  killMoney: 90,
  income: 120,
  hp: 7.2,
  ticks: 30 * 95,
  ...patch,
});

test('победа и поражение дают разные заголовки и подписи награды', () => {
  const m = MISSIONS.convoy!;
  const won = resultView(m, result(), missionReward(m, result()), 500);
  const lost = resultView(m, result({ status: 'lost', hp: 0 }), missionReward(m, result({ status: 'lost' })), 500);
  expect(won.title).toBe('Победа');
  expect(lost.title).toBe('Поражение');
  expect(won.reward[0]!.label).not.toBe(lost.reward[0]!.label);
});

test('статистика: время, убийства, вылеты и прочность цели по типу миссии', () => {
  const stats = (id: string) => Object.fromEntries(resultView(MISSIONS[id]!, result(), missionReward(MISSIONS[id]!, result()), 0).stats.map((r) => [r.label, r.value]));
  expect(stats('evac')).toMatchObject({ 'Время боя': '1:35', 'Сбито врагов': '12', 'Завершено вылетов': '5', 'Прочность объекта': '8' });
  expect(stats('convoy')['Прочность колонны']).toBe('8');
});

test('награда разложена по статьям, бонус вылетов показан, сумма сходится', () => {
  const m = MISSIONS.evac!;
  const reward = missionReward(m, result());
  const v = resultView(m, result(), reward, 700);
  expect(v.reward.map((r) => Number(r.value)).reduce((a, b) => a + b)).toBe(reward.total);
  expect(v.reward.find((r) => r.label.includes('Бонус'))!.value).toBe('120');
  expect(v.total.value).toBe(String(reward.total));
  expect(v.balance.value).toBe('700');
});
