import { GROUPS, LINEUP_SIZE, START_PROFILE } from '../../content';
import {
  buyGroup,
  buyRejection,
  lineupRejection,
  sortieRejection,
  toggleLineup,
  upgradeGroup,
  upgradeRejection,
} from '../../sim';
import type { AirGroupConfig, Profile, ProfileRejection } from '../../sim';
import { useProfileStore } from '../../store/profile';
import { GroupCard } from '../entity/GroupCard';
import { viewGroup } from '../entity/model';
import { rejectionText } from './model';
import './base.css';

/** Кнопка действия + причина отказа видимым текстом рядом. */
function Action({ testId, label, reason, onClick }: { testId: string; label: string; reason?: ProfileRejection; onClick: () => void }) {
  return (
    <div className="base-action">
      <button type="button" data-testid={testId} disabled={reason !== undefined} onClick={onClick}>
        {label}
      </button>
      {reason && (
        <span className="base-reason" data-testid="reason">
          {rejectionText(reason, LINEUP_SIZE)}
        </span>
      )}
    </div>
  );
}

/** Экран базы: покупка, улучшение и выбор состава на вылет. Операции — из sim, UI только вызывает их. */
export function BaseScreen({ onSortie }: { onSortie: (profile: Profile) => void }) {
  const stored = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const profile = stored ?? START_PROFILE;
  const sortieReason = sortieRejection(profile, LINEUP_SIZE);

  const actions = (group: AirGroupConfig) => {
    const owned = group.id in profile.levels;
    const inLineup = profile.lineup.includes(group.id);
    return (
      <div className="base-actions">
        {owned ? (
          <Action
            testId="upgrade"
            label="Улучшить"
            reason={upgradeRejection(profile, GROUPS, group.id)}
            onClick={() => setProfile(upgradeGroup(profile, GROUPS, group.id))}
          />
        ) : (
          <Action
            testId="buy"
            label="Купить"
            reason={buyRejection(profile, GROUPS, group.id)}
            onClick={() => setProfile(buyGroup(profile, GROUPS, group.id))}
          />
        )}
        <Action
          testId="lineup-toggle"
          label={inLineup ? 'Убрать' : 'В состав'}
          reason={lineupRejection(profile, GROUPS, group.id, LINEUP_SIZE)}
          onClick={() => setProfile(toggleLineup(profile, GROUPS, group.id, LINEUP_SIZE))}
        />
      </div>
    );
  };

  return (
    <main className="base" data-testid="base-screen">
      <header className="base-header">
        <h1>AIRBASE · база</h1>
        <div className="base-currency">
          Валюта: <strong data-testid="currency">{profile.currency}</strong>
        </div>
        <div className="base-lineup">
          Состав: <strong data-testid="lineup-count">{profile.lineup.length}/{LINEUP_SIZE}</strong>
        </div>
        <Action testId="sortie" label="На вылет" reason={sortieReason} onClick={() => onSortie(profile)} />
      </header>
      <section className="base-grid">
        {Object.values(GROUPS).map((group) => {
          const level = profile.levels[group.id] ?? 0;
          const owned = group.id in profile.levels;
          return (
            <div key={group.id} className="base-slot" data-owned={owned} data-lineup={profile.lineup.includes(group.id)}>
              <GroupCard group={group} view={viewGroup(group, level)} actions={actions(group)} />
            </div>
          );
        })}
      </section>
    </main>
  );
}
