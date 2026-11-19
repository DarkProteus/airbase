import type { VisualConfig } from '../../sim';
import { EntityPreview } from './EntityPreview';
import { describeFields } from '../../view/entity';
import './entity.css';

interface Props {
  /** Любой конфиг с id, name и тегами (враг и т.п.): остальные поля выводятся обобщённо. */
  config: { id: string; name: string; tags: readonly string[]; visual?: VisualConfig };
  extraTags?: readonly string[];
}

/** Обобщённая карточка: превью + все поля конфига. Новое поле появляется само. */
export function EntityCard({ config, extraTags = [] }: Props) {
  const tags = [...new Set([...config.tags, ...extraTags])];
  const rows = describeFields(config).filter((r) => r.key !== 'tags');
  return (
    <article className="card" data-testid="entity-card" data-id={config.id}>
      <EntityPreview entity={{ tags, visual: config.visual }} />
      <div className="card-body">
        <h3>
          {config.name} <small>{config.id}</small>
        </h3>
        <div className="tags">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <table className="stats">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                <td>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
