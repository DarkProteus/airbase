import { useState } from 'react';
import { GROUPS, LINEUP_SIZE, MISSIONS } from '../../content';
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
import { GroupCard } from '../entity/GroupCard';
import { viewGroup } from '../entity/model';
import { missionSummary, rejectionText, resetStep } from './model';
import type { ResetStep } from './model';
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

/** Сброс прогресса с подтверждением: кнопка -> вопрос -> «Да, сбросить» / «Отмена». */
function ResetProgress({ onReset }: { onReset: () => void }) {
  const [step, setStep] = useState<ResetStep>('idle');
  const act = (action: 'ask' | 'confirm' | 'cancel') => {
    const next = resetStep(step, action);
    setStep(next.step);
    if (next.reset) onReset();
  };
  return step === 'idle' ? (
    <button type="button" data-testid="reset" onClick={() => act('ask')}>
      Сбросить прогресс
    </button>
  ) : (
    <div className="base-reset" data-testid="reset-confirm">
      <span>Весь прогресс будет потерян. Сбросить?</span>
      <button type="button" data-testid="reset-yes" onClick={() => act('confirm')}>
        Да, сбросить
      </button>
      <button type="button" data-testid="reset-no" onClick={() => act('cancel')}>
        Отмена
      </button>
    </div>
  );
}

/** Экран базы: покупка, улучшение, выбор состава и миссии. Операции — из sim, UI только вызывает их; профиль хранит поток экранов. */
export function BaseScreen({
  profile,
  onProfile: setProfile,
  onSortie,
  onReset,
}: {
  profile: Profile;
  onProfile: (profile: Profile) => void;
  onSortie: (missionId: string) => void;
  onReset: () => void;
}) {
  const [missionId, setMissionId] = useState(() => Object.keys(MISSIONS)[0]!);
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
        <Action testId="sortie" label="На вылет" reason={sortieReason} onClick={() => onSortie(missionId)} />
        <ResetProgress onReset={onReset} />
      </header>
      <section className="base-missions" data-testid="missions">
        {Object.values(MISSIONS).map((m) => (
          <button
            key={m.id}
            type="button"
            className="base-mission"
            data-testid="mission"
            data-mission={m.id}
            data-selected={m.id === missionId}
            aria-pressed={m.id === missionId}
            onClick={() => setMissionId(m.id)}
          >
            <strong>{m.name}</strong>
            <span>{missionSummary(m)}</span>
          </button>
        ))}
      </section>
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
