import { useState } from 'react';
import { CAMPAIGN, GROUPS, LINEUP_SIZE, MISSIONS } from '../../content';
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
import type { GroupView } from '../entity/model';
import { defaultMission, missionCards, rejectionText, resetStep, starsText } from './model';
import type { ResetStep } from './model';
import './base.css';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Кнопка действия + причина отказа видимым текстом рядом. */
function Action({
  testId,
  label,
  reason,
  onClick,
  primary = false,
}: {
  testId: string;
  label: string;
  reason?: ProfileRejection;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <div className="base-action">
      <button type="button" className={primary ? 'btn btn-primary' : 'btn'} data-testid={testId} disabled={reason !== undefined} onClick={onClick}>
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
    <button type="button" className="btn btn-ghost btn-danger" data-testid="reset" onClick={() => act('ask')}>
      Сбросить прогресс
    </button>
  ) : (
    <div className="base-reset" data-testid="reset-confirm">
      <span>Весь прогресс будет потерян. Сбросить?</span>
      <button type="button" className="btn btn-danger" data-testid="reset-yes" onClick={() => act('confirm')}>
        Да, сбросить
      </button>
      <button type="button" className="btn" data-testid="reset-no" onClick={() => act('cancel')}>
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
  const cards = missionCards(MISSIONS, CAMPAIGN, profile);
  const [picked, setMissionId] = useState<string | undefined>(undefined);
  // Выбор игрока действует, пока миссия открыта; иначе — самая дальняя открытая.
  const missionId = (cards.find((c) => c.id === picked && !c.locked)?.id ?? defaultMission(cards))!;
  const sortieReason = sortieRejection(profile, LINEUP_SIZE);

  const actions = (group: AirGroupConfig, view: GroupView) => {
    const owned = group.id in profile.levels;
    const inLineup = profile.lineup.includes(group.id);
    const fork = owned && view.options.length > 0;
    return (
      <div className="base-actions">
        {fork && (
          <div className="spec-options" data-testid="spec-options">
            {view.options.map(({ option, changes }) => (
              <div key={option.id} className="spec-option" data-testid="spec-option" data-option={option.id}>
                <strong>{option.name}</strong>
                <span className="spec-desc">{option.description}</span>
                {changes.length > 0 && (
                  <ul className="spec-changes" data-testid="spec-changes">
                    {changes.map((c) => (
                      <li key={c.label}>
                        {c.label}: {fmt(c.from)} → {fmt(c.to)}
                      </li>
                    ))}
                  </ul>
                )}
                <Action
                  testId="spec-pick"
                  label={`Выбрать · ${view.nextUpgradeCost}`}
                  reason={upgradeRejection(profile, GROUPS, group.id, option.id)}
                  onClick={() => setProfile(upgradeGroup(profile, GROUPS, group.id, option.id))}
                />
              </div>
            ))}
          </div>
        )}
        {owned ? (
          !fork && (
            <Action
              testId="upgrade"
              label="Улучшить"
              reason={upgradeRejection(profile, GROUPS, group.id)}
              onClick={() => setProfile(upgradeGroup(profile, GROUPS, group.id))}
            />
          )
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
      <header className="base-header panel">
        <h1>
          AIRBASE <span>· база</span>
        </h1>
        <div className="base-stat base-currency">
          <span>Валюта</span>
          <strong data-testid="currency">{profile.currency}</strong>
        </div>
        <div className="base-stat base-lineup">
          <span>Состав</span>
          <strong data-testid="lineup-count">{profile.lineup.length}/{LINEUP_SIZE}</strong>
        </div>
        <Action testId="sortie" label="На вылет" primary reason={sortieReason} onClick={() => onSortie(missionId)} />
        <ResetProgress onReset={onReset} />
      </header>
      <h2 className="base-section">Миссии</h2>
      <section className="base-missions" data-testid="missions">
        {cards.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className="base-mission panel"
            data-testid="mission"
            data-mission={m.id}
            data-selected={m.id === missionId}
            data-locked={m.locked}
            data-stars={m.stars}
            aria-pressed={m.id === missionId}
            disabled={m.locked}
            onClick={() => setMissionId(m.id)}
          >
            <span className="base-mission-head">
              <strong>
                {i + 1}. {m.name}
              </strong>
              <span className="base-mission-stars" data-testid="mission-stars" aria-label={`звёзд: ${m.stars} из ${m.maxStars}`}>
                {m.locked ? 'закрыта' : starsText(m.stars, m.maxStars)}
              </span>
            </span>
            <span>{m.locked && m.unlockBy ? `Откроется после победы в миссии «${m.unlockBy}»` : m.summary}</span>
          </button>
        ))}
      </section>
      <h2 className="base-section">Авиагруппы</h2>
      <section className="base-grid">
        {Object.values(GROUPS).map((group) => {
          const level = profile.levels[group.id] ?? 0;
          const view = viewGroup(group, level, [], [], profile.specs?.[group.id]);
          const owned = group.id in profile.levels;
          return (
            <div key={group.id} className="base-slot" data-owned={owned} data-lineup={profile.lineup.includes(group.id)}>
              <GroupCard group={group} view={view} actions={actions(group, view)} />
            </div>
          );
        })}
      </section>
    </main>
  );
}
