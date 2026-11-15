import { KindChip } from './GroupPanel';
import type { WaveWarning as Warning } from './markup';

/** Номера точек входа на карте и в списке совпадают (подпись у кольца — «Вход N»). */
export const entryLabel = (spawn: number): string => `Вход ${spawn + 1}`;

/** Предупреждение о ближайшей волне: через сколько секунд, из каких входов, какой состав и кто его может бить. */
export function WaveWarning({ warning }: { warning: Warning }) {
  return (
    <div className="wave-warning panel panel-warn" data-testid="wave-warning">
      <div className="wave-warning-title">
        Волна {warning.wave}/{warning.waves}{' '}
        {warning.seconds === null ? 'после зачистки' : `через ${Math.ceil(warning.seconds)} с`} · врагов {warning.total}
      </div>
      {warning.entries.map((e) => (
        <div key={e.spawn} className="wave-entry" data-testid="wave-entry">
          <span className="wave-entry-name">{entryLabel(e.spawn)}</span>
          {e.items.map((i) => (
            <span key={i.enemy} className="wave-item" title={i.hitBy.length ? `Бьют: ${i.hitBy.join(', ')}` : 'Бить некому'}>
              {i.name} ×{i.count} <KindChip kind={i.kind} />
              <span className={i.hitBy.length ? 'wave-hitby' : 'wave-hitby wave-nobody'}>
                {i.hitBy.length ? i.hitBy.join(', ') : 'бить некому'}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
