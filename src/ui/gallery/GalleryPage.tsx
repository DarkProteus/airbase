import { ownModifiers } from '../../sim';
import { useGalleryStore } from '../../store/gallery';
import { EntityCard } from '../entity/EntityCard';
import { GroupCard } from '../entity/GroupCard';
import { clampLevel, formatModifier, viewGroupWhatIf } from '../entity/model';
import { CONTENT_REGISTRIES, collectTags, listAuraSources, listEnemies, listGroups } from './catalog';
import './gallery.css';

/** Dev-галерея: всё, что описано реестрами контента, с переключателями параметров. */
export function GalleryPage() {
  const { levels, activeSources, activeTags, setLevel, toggleSource, toggleTag, reset } = useGalleryStore();
  const groups = listGroups();
  const enemies = listEnemies();
  const auraGroups = listAuraSources();
  const tags = collectTags();
  // Источник действует на своём текущем уровне (ползунок его карточки).
  const sources = auraGroups.filter((g) => activeSources.includes(g.id)).map((group) => ({ group, level: levels[group.id] ?? 0 }));

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
          <strong>«Что-если»: ауры групп (на уровне источника; действуют на остальные группы по тегам):</strong>
          {auraGroups.length === 0 && <em>в реестре нет групп с аурами</em>}
          {auraGroups.map((g) => (
            <label key={g.id} className="chk" title={g.id}>
              <input type="checkbox" checked={activeSources.includes(g.id)} onChange={() => toggleSource(g.id)} /> {g.name}:{' '}
              {ownModifiers(g, clampLevel(g, levels[g.id] ?? 0))
                .filter((m) => m.scope !== 'self')
                .map(formatModifier)
                .join('; ')}
            </label>
          ))}
        </div>
        <button type="button" onClick={reset}>
          Сбросить
        </button>
      </section>

      <section aria-label="Авиагруппы">
        <h2>Авиагруппы ({groups.length})</h2>
        <div className="grid">
          {groups.map((u) => {
            const view = viewGroupWhatIf(u, levels[u.id] ?? 0, sources, activeTags);
            return (
              <div key={u.id} className="cell">
                <GroupCard group={u} view={view} />
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
        Реестры: groups={Object.keys(CONTENT_REGISTRIES.groups).length}, enemies=
        {Object.keys(CONTENT_REGISTRIES.enemies).length}
      </footer>
    </main>
  );
}
