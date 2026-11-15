import { auraSources } from '../sim';
import type { Vec2, World } from '../sim';

/**
 * Зоны действия аур для показа на карте: чистая функция от снапшота и конфигов.
 * Использует `auraSources` из sim, поэтому аура видна ровно тогда, когда она действует (владелец в фазе patrol).
 * Ничего не знает про id групп: любая группа с аура-модификаторами получает свои круги.
 */

export interface AuraZone {
  /** Стабильный ключ круга: владелец + радиус. */
  key: string;
  /** Владелец ауры (GroupState.id): рендер красит круг его цветом. */
  group: number;
  /** Центр — центр зоны владельца, клетки. */
  at: Vec2;
  radius: number;
  /** out — аура усиливает союзников (волны расходятся), in — давит врагов (волны сходятся к центру). */
  flow: 'out' | 'in';
}

export function auraZones(w: Pick<World, 'content' | 'state'>): AuraZone[] {
  const out: AuraZone[] = [];
  for (const src of auraSources(w)) {
    // Один круг на каждый различный радиус действия; global-модификаторы действуют на всю карту и круга не имеют.
    const byRadius = new Map<number, { enemyOnly: boolean }>();
    for (const m of src.mods) {
      if (m.scope !== 'aura') continue;
      const r = m.radius ?? src.radius;
      if (r <= 0) continue;
      const cur = byRadius.get(r);
      const enemy = m.side === 'enemy';
      byRadius.set(r, { enemyOnly: cur ? cur.enemyOnly && enemy : enemy });
    }
    for (const [radius, { enemyOnly }] of [...byRadius].sort((a, b) => a[0] - b[0]))
      out.push({ key: `${src.id}:${radius}`, group: src.id, at: { ...src.zone }, radius, flow: enemyOnly ? 'in' : 'out' });
  }
  return out;
}

/** Фаза бегущей волны 0..1 для момента now (мс); offset разносит несколько волн одного круга. */
export function wavePhase(now: number, offset = 0, period = 1800): number {
  const k = (now / period + offset) % 1;
  return k < 0 ? k + 1 : k;
}

/** Масштаб и прозрачность волны в фазе k: расходится от центра к краю (или сходится) и гаснет у конца пути. */
export function waveLook(k: number, flow: 'out' | 'in'): { scale: number; opacity: number } {
  const t = Math.max(0, Math.min(1, k));
  const along = flow === 'out' ? t : 1 - t;
  // Прозрачность: плавный вход, затем затухание к краю (для in — затухание к центру).
  const fade = Math.sin(Math.PI * t) ** 0.8;
  return { scale: 0.12 + 0.88 * along, opacity: 0.55 * fade };
}
