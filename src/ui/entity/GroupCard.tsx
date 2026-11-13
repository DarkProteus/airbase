import type { ReactNode } from 'react';
import type { AirGroupConfig, GroupStats } from '../../sim';
import { EntityPreview } from './EntityPreview';
import { formatModifier, viewGroup } from './model';
import type { GroupView } from './model';
import './entity.css';

interface Props {
  group: AirGroupConfig;
  /** Готовый расчёт (например, из песочницы галереи). Без него — уровень 0 без модификаторов. */
  view?: GroupView;
  onClick?: () => void;
  /** Действия под карточкой (кнопки базы); галерея их не передаёт. */
  actions?: ReactNode;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Числовые параметры карточки: подпись и поле GroupStats. Нулевые у базы и у расчёта строки не показываются. */
const ROWS: { label: string; key: Exclude<keyof GroupStats, 'weapons'> }[] = [
  { label: 'скорость', key: 'speed' },
  { label: 'топливо, с', key: 'fuel' },
  { label: 'боекомплект', key: 'ammo' },
  { label: 'перезарядка, с', key: 'rearmTime' },
  { label: 'радиус зоны', key: 'zoneRadius' },
  { label: 'бонус за вылет', key: 'income' },
];

const delta = (cur: number, base: number) => (cur > base ? 'up' : cur < base ? 'down' : '');

/** Универсальная карточка авиагруппы: строится только из AirGroupConfig (+ расчёта viewGroup). */
export function GroupCard({ group, view = viewGroup(group), onClick, actions }: Props) {
  const { stats, baseStats } = view;
  return (
    <article className="card" data-testid="group-card" data-id={group.id} onClick={onClick}>
      <EntityPreview entity={{ role: group.role, tags: view.tags, visual: group.visual }} />
      <div className="card-body">
        <h3>
          {group.name} <small>{group.role}</small>
        </h3>
        <div className="cost">
          {group.cost}
          {view.level > 0 && <small> (всего {view.totalCost})</small>}
        </div>
        <div className="tags">
          {view.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <table className="stats">
          <tbody>
            {ROWS.filter((r) => stats[r.key] !== 0 || baseStats[r.key] !== 0).map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className={delta(stats[r.key], baseStats[r.key])}>{fmt(stats[r.key])}</td>
              </tr>
            ))}
            {stats.weapons.map((w, i) => {
              const base = baseStats.weapons[i];
              return (
                <tr key={`w${i}`}>
                  <td>оружие → {w.targetTags.join(', ') || 'любые'}</td>
                  <td className={delta(w.damage * w.fireRate, (base?.damage ?? 0) * (base?.fireRate ?? 0))}>
                    {fmt(w.damage)} × {fmt(w.fireRate)}/с
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {group.auras.length > 0 && (
          <ul className="mods">
            {group.auras.map((m, i) => (
              <li key={i}>{formatModifier(m)}</li>
            ))}
          </ul>
        )}
        <div className="upgrade">
          ур. {view.level}/{view.maxLevel}
          {view.nextUpgradeCost !== undefined && <span> · след. {view.nextUpgradeCost}</span>}
        </div>
        {actions}
      </div>
    </article>
  );
}
