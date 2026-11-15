import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useGameStore } from '../../store/game';
import type { MissionConfig } from '../../sim';
import { objectiveInfo, OBJECTIVE_TEXT, PHASE_TEXT, STATUS_TEXT } from './selectors';

const NOTICE_MS = 2500;

/** Ячейка панели: подпись, значение, необязательная пометка и полоска доли (0..1). */
function Cell({ label, value, note, ratio, tone = '', testId }: { label: string; value: ReactNode; note?: string; ratio?: number; tone?: string; testId?: string }) {
  return (
    <div className="hud-cell" data-testid={testId}>
      <span className="hud-label">{label}</span>
      <strong className={`hud-value ${tone}`}>{value}</strong>
      {note && <span className="hud-note">{note}</span>}
      {ratio !== undefined && (
        <span className={`meter ${tone === 'is-bad' ? 'meter-danger' : 'meter-accent'}`}>
          <span style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

/** Верхняя панель: миссия, награда, цель (прочность и остаток до победы) или жизни, волна + короткое сообщение (причина отказа). */
export function Hud({ mission }: { mission: MissionConfig }) {
  const s = useGameStore((st) => st.snapshot);
  const notice = useGameStore((st) => st.notice);
  const setNotice = useGameStore((st) => st.setNotice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice, setNotice]);
  const o = s && objectiveInfo(mission, s);
  return (
    <>
      <div className="hud panel" data-testid="hud">
        <div className="hud-cell hud-mission">
          <span className="hud-label">AIRBASE</span>
          <strong className="hud-value">{mission.name}</strong>
        </div>
        {s && (
          <>
            <Cell label="Награда" value={s.money} tone="is-accent" />
            {o ? (
              <>
                <Cell
                  label={OBJECTIVE_TEXT[o.type].name}
                  value={`${o.hp}/${o.maxHp}`}
                  ratio={o.maxHp > 0 ? o.hp / o.maxHp : 0}
                  tone={o.maxHp > 0 && o.hp / o.maxHp <= 0.3 ? 'is-bad' : ''}
                />
                <Cell label="Задача" value={OBJECTIVE_TEXT[o.type].left(o)} ratio={o.progress} />
              </>
            ) : (
              <Cell label="Жизни" value={s.lives} tone={s.lives <= 3 ? 'is-bad' : ''} />
            )}
            <Cell label="Волна" value={`${s.wave}/${mission.waves.length}`} note={PHASE_TEXT[s.phase]} />
            {s.status !== 'running' && <div className={`hud-status is-${s.status}`}>{STATUS_TEXT[s.status]}</div>}
          </>
        )}
      </div>
      {notice && (
        <div className="notice panel panel-danger" data-testid="notice" role="status">
          {notice.text}
        </div>
      )}
    </>
  );
}
