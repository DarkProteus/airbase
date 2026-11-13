import { useGalleryStore } from '../../store/gallery';
import { EntityCard } from '../entity/EntityCard';
import { formatModifier, viewUnit } from '../entity/model';
import { UnitCard } from '../entity/UnitCard';
import { CONTENT_REGISTRIES, collectTags, listEnemies, listUnits, modifierPool } from './catalog';
import './gallery.css';

/** Dev-галерея: всё, что описано реестрами контента, с переключателями параметров. */
export function GalleryPage() {
  const { levels, activeModifiers, activeTags, setLevel, toggleModifier, toggleTag, reset } = useGalleryStore();
  const units = listUnits();
  const enemies = listEnemies();
  const pool = modifierPool();
  const tags = collectTags();
  const extra = pool.filter((p) => activeModifiers.includes(p.key)).map((p) => p.modifier);

  return (
    <main className="gallery">
      <h1>AIRBASE · галерея контента</h1>

      <section className="panel" aria-label="Параметры">
        <h2>Песочница</h2>
        <div className="row">
          <strong>Теги (добавляются всем превью):</strong>
          {tags.map((t) => (
            <label key={t} className="chk">
              <input type="checkbox" checked={activeTags.includes(t)} onChange={() => toggleTag(t)} /> {t}
            </label>
          ))}
        </div>
        <div className="row">
          <strong>Модификаторы «что-если» (применяются, если подходят по тегам):</strong>
          {pool.length === 0 && <em>в реестре нет модификаторов</em>}
          {pool.map((p) => (
            <label key={p.key} className="chk" title={p.key}>
              <input type="checkbox" checked={activeModifiers.includes(p.key)} onChange={() => toggleModifier(p.key)} />{' '}
              {p.label} · {formatModifier(p.modifier)}
            </label>
          ))}
        </div>
        <button type="button" onClick={reset}>
          Сбросить
        </button>
      </section>

      <section aria-label="Юниты">
        <h2>Юниты ({units.length})</h2>
        <div className="grid">
          {units.map((u) => {
            const view = viewUnit(u, levels[u.id] ?? 0, extra, activeTags);
            return (
              <div key={u.id} className="cell">
                <UnitCard unit={u} view={view} />
                <label className="level">
                  Уровень улучшения: {view.level}
                  <input
                    type="range"
                    min={0}
                    max={view.maxLevel}
                    value={view.level}
                    disabled={view.maxLevel === 0}
                    onChange={(e) => setLevel(u.id, Number(e.target.value))}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Враги">
        <h2>Враги ({enemies.length})</h2>
        <div className="grid">
          {enemies.map((e) => (
            <EntityCard key={e.id} config={e} extraTags={activeTags} />
          ))}
        </div>
      </section>

      <footer>
        Реестры: units={Object.keys(CONTENT_REGISTRIES.units).length}, enemies=
        {Object.keys(CONTENT_REGISTRIES.enemies).length}
      </footer>
    </main>
  );
}
