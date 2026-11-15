import type { GroupState } from './sortie';

/** Счётчики одной авиагруппы за матч. */
export interface GroupTally {
  /** GroupState.id. */
  id: number;
  /** Тип группы (id конфига): по нему экран итога берёт название. */
  type: string;
  kills: number;
  /** Фактически нанесённый урон: выстрел по цели с остатком здоровья меньше урона засчитывается остатком. */
  damage: number;
  /** Завершённые вылеты (то же, что GroupState.sorties). */
  sorties: number;
  /** Тиков, проведённых в фазе patrol; доля времени = patrolTicks / тиков матча. */
  patrolTicks: number;
}

/** Счётчики одной волны (индекс в массиве = индекс волны в миссии). */
export interface WaveTally {
  /** Заспавнено врагов волны. */
  spawned: number;
  /** Уничтожено до цели. */
  killed: number;
  /** Дошло до цели (в миссии без цели — до базы). */
  leaked: number;
  /** Урон по цели миссии (без цели — по жизням базы) от дошедших врагов волны: Σ leakDamage. */
  damage: number;
}

/** Статистика матча: ведёт движок, считается детерминированно вместе с остальным состоянием. */
export interface MatchStats {
  groups: GroupTally[];
  waves: WaveTally[];
}

export function createStats(groups: readonly Pick<GroupState, 'id' | 'type'>[], waveCount: number): MatchStats {
  return {
    groups: groups.map((g) => ({ id: g.id, type: g.type, kills: 0, damage: 0, sorties: 0, patrolTicks: 0 })),
    waves: Array.from({ length: waveCount }, () => ({ spawned: 0, killed: 0, leaked: 0, damage: 0 })),
  };
}
