import type { UnitConfig } from '../../sim';
import { EntityPreview } from './EntityPreview';
import { formatModifier, viewUnit } from './model';
import type { UnitView } from './model';
import './entity.css';

interface Props {
  unit: UnitConfig;
  /** Готовый расчёт (например, из песочницы галереи). Без него — уровень 0 без модификаторов. */
  view?: UnitView;
  onClick?: () => void;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Универсальная карточка юнита: строится только из UnitConfig (+ расчёта viewUnit). */
export function UnitCard({ unit, view = viewUnit(unit), onClick }: Props) {
  const statKeys = Object.keys({ ...view.baseStats, ...view.stats }) as (keyof typeof view.stats)[];
  return (
    <article className="card" data-testid="unit-card" data-id={unit.id} onClick={onClick}>
      <EntityPreview entity={{ role: unit.role, tags: view.tags }} />
      <div className="card-body">
        <h3>
          {unit.name} <small>{unit.role}</small>
        </h3>
        <div className="cost">
          {unit.cost}
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
            {statKeys.map((k) => {
              const base = view.baseStats[k] ?? 0;
              const cur = view.stats[k] ?? 0;
              return (
                <tr key={k}>
                  <td>{k}</td>
                  <td className={cur > base ? 'up' : cur < base ? 'down' : ''}>{fmt(cur)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {unit.modifiers.length > 0 && (
          <ul className="mods">
            {unit.modifiers.map((m, i) => (
              <li key={i}>{formatModifier(m)}</li>
            ))}
          </ul>
        )}
        <div className="upgrade">
          ур. {view.level}/{view.maxLevel}
          {view.nextUpgradeCost !== undefined && <span> · след. {view.nextUpgradeCost}</span>}
        </div>
      </div>
    </article>
  );
}
