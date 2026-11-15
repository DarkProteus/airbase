import { TICK_RATE } from '../../sim';
import type { MissionConfig, MissionResult, Reward } from '../../sim';

export interface ResultRow {
  label: string;
  value: string;
}

export interface ResultView {
  title: string;
  won: boolean;
  stats: ResultRow[];
  reward: ResultRow[];
  /** Итоговая строка награды и новый баланс. */
  total: ResultRow;
  balance: ResultRow;
}

/** Подпись остатка прочности по типу цели миссии; без цели — жизни базы. */
const HP_LABEL = { defend: 'Прочность объекта', escort: 'Прочность колонны' } as const;

const clock = (ticks: number): string => {
  const sec = Math.round(ticks / TICK_RATE);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** Экран итога из данных: заголовок по исходу, статистика матча и разбивка награды (бонус групп отдельной строкой). */
export function resultView(mission: MissionConfig, result: MissionResult, reward: Reward, currency: number): ResultView {
  const won = result.status === 'won';
  return {
    title: won ? 'Победа' : 'Поражение',
    won,
    stats: [
      { label: 'Миссия', value: mission.name },
      { label: 'Время боя', value: clock(result.ticks) },
      { label: 'Сбито врагов', value: String(result.kills) },
      { label: 'Завершено вылетов', value: String(result.sorties) },
      { label: mission.objective ? HP_LABEL[mission.objective.type] : 'Жизни базы', value: String(Math.ceil(result.hp)) },
    ],
    reward: [
      { label: won ? 'За победу' : 'За участие', value: String(reward.base) },
      { label: 'За убийства', value: String(reward.kills) },
      { label: 'Бонус вылетов (C-130 и др.)', value: String(reward.income) },
    ],
    total: { label: 'Награда', value: String(reward.total) },
    balance: { label: 'Валюта на базе', value: String(currency) },
  };
}
