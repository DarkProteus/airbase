import type { ReactNode } from 'react';
import type { AirGroupConfig, GroupStats } from '../../sim';
import { EntityPreview } from './EntityPreview';
import { RoleIcon } from './RoleIcon';
import { formatModifier, viewGroup } from '../../view/entity';
import type { GroupView } from '../../view/entity';
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

/** Числовые параметры карточки: подпись и поле GroupStats. Необязательные нулевые у базы и у расчёта не показываются. */
const ROWS: { label: string; key: Exclude<keyof GroupStats, 'weapons'>; optional?: boolean }[] = [
  { label: 'скорость', key: 'speed' },
  { label: 'топливо, с', key: 'fuel' },
  { label: 'боекомплект', key: 'ammo', optional: true },
  { label: 'перезарядка, с', key: 'rearmTime' },
  { label: 'радиус зоны', key: 'zoneRadius', optional: true },
  { label: 'бонус за вылет', key: 'income', optional: true },
];

/** Значение; если «что-если» ауры его изменили — «было → стало». */
const shown = (cur: number, own: number) => (cur !== own ? `${fmt(own)} → ${fmt(cur)}` : fmt(cur));

const delta = (cur: number, base: number) => (cur > base ? 'up' : cur < base ? 'down' : '');

/** Универсальная карточка авиагруппы: строится только из AirGroupConfig (+ расчёта viewGroup). */
export function GroupCard({ group, view = viewGroup(group), onClick, actions }: Props) {
  const { stats, baseStats, own } = view;
  return (
    <article className="card" data-testid="group-card" data-id={group.id} onClick={onClick}>
      <EntityPreview entity={{ role: group.role, tags: view.tags, visual: group.visual }} />
      <div className="card-body">
        <h3>
          <RoleIcon role={group.role} />
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
            {ROWS.filter((r) => !r.optional || stats[r.key] !== 0 || baseStats[r.key] !== 0).map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className={delta(stats[r.key], baseStats[r.key])}>{shown(stats[r.key], own[r.key])}</td>
              </tr>
            ))}
            {stats.weapons.map((w, i) => {
              const base = baseStats.weapons[i];
              return (
                <tr key={`w${i}`}>
                  <td>оружие → {w.targetTags.join(', ') || 'любые'}</td>
                  <td className={delta(w.damage * w.fireRate, (base?.damage ?? 0) * (base?.fireRate ?? 0))}>
                    {shown(w.damage, own.weapons[i]?.damage ?? w.damage)} × {shown(w.fireRate, own.weapons[i]?.fireRate ?? w.fireRate)}/с
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
        {view.spec && (
          <div className="spec" data-testid="spec" data-option={view.spec.id} title={view.spec.description}>
            Специализация: <strong>{view.spec.name}</strong>
          </div>
        )}
        {actions}
      </div>
    </article>
  );
}
