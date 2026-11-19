import { KindChip } from './GroupPanel';
import type { WaveWarning as Warning } from '../../view/markup';

/** Предупреждение о ближайшей волне: через сколько секунд, с каких баз, какой состав (новые типы помечены) и кто его может бить. */
export function WaveWarning({ warning }: { warning: Warning }) {
  return (
    <div className="wave-warning panel panel-warn" data-testid="wave-warning">
      <div className="wave-warning-title">
        Волна {warning.wave}/{warning.waves}{' '}
        {warning.seconds === null ? 'после зачистки' : `через ${Math.ceil(warning.seconds)} с`} · врагов {warning.total}
      </div>
      {warning.entries.map((e) => (
        <div key={e.base} className="wave-entry" data-testid="wave-entry">
          <span className="wave-entry-name">{e.name}</span>
          {e.items.map((i) => (
            <span key={i.enemy} className="wave-item" title={i.hitBy.length ? `Бьют: ${i.hitBy.join(', ')}` : 'Бить некому'}>
              {i.name} ×{i.count} <KindChip kind={i.kind} />
              {i.fresh && (
                <span className="wave-fresh" data-testid="wave-fresh">
                  новый
                </span>
              )}
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
