import { TARGET_KIND_LABEL } from './markup';
import type { TargetKind } from './markup';
import type { GroupRow } from './selectors';

interface Props {
  rows: readonly GroupRow[];
  selected: number | null;
  onSelect: (group: number | null) => void;
}

const sec = (s: number) => `${Math.ceil(s)} с`;

/** Метка типа цели: ромб — воздух, квадрат — земля (так же помечены враги на карте). */
export function KindChip({ kind }: { kind: TargetKind | undefined }) {
  if (!kind) return null;
  return (
    <span className={`kind kind-${kind}`} data-kind={kind} title={TARGET_KIND_LABEL[kind]}>
      {kind === 'air' ? '◆' : '■'} {TARGET_KIND_LABEL[kind]}
    </span>
  );
}

/** Панель авиагрупп: фаза вылета, топливо, боекомплект, время до конца перезарядки; клик выбирает группу, повторный — снимает. */
export function GroupPanel({ rows, selected, onSelect }: Props) {
  if (rows.length === 0) return null;
  return (
    <div className="group-panel" data-testid="group-panel">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          className="group-row"
          data-testid="group-row"
          data-id={r.id}
          data-phase={r.phase}
          data-selected={selected === r.id}
          aria-pressed={selected === r.id}
          style={r.color ? { borderLeft: `4px solid ${r.color}` } : undefined}
          onClick={() => onSelect(selected === r.id ? null : r.id)}
        >
          <span className="group-name">{r.name}</span>
          <span className="group-phase">{r.phaseLabel}</span>
          <span className="group-stat" title="Топливо">
            топл. {sec(r.fuel.seconds)}
            <span className="group-bar">
              <span style={{ width: `${Math.round(r.fuel.ratio * 100)}%` }} />
            </span>
          </span>
          <span className="group-stat" title="Боекомплект">
            бк {r.ammo.left}/{r.ammo.max}
          </span>
          <span className="group-targets" data-testid="group-targets">
            бьёт:{' '}
            {r.targets.length ? r.targets.map((k) => <KindChip key={k} kind={k} />) : <span className="kind-none">не стреляет</span>}
            {r.attack && (
              <span className="group-attack" data-testid="group-attack">
                {' '}
                → {r.attack.enemyName} <KindChip kind={r.attack.kind} />
              </span>
            )}
          </span>
          <span className="group-stat group-rearm">{r.rearmSeconds !== null ? `заряжается ${sec(r.rearmSeconds)}` : ''}</span>
        </button>
      ))}
      <div className="group-hint" data-testid="group-hint">
        {selected !== null ? 'Клик по карте — зона патрулирования' : 'Выберите группу, затем кликните по карте — её зона переедет туда'}
      </div>
    </div>
  );
}
