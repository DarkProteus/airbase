import { useEffect } from 'react';
import { useGameStore } from '../../store/game';
import type { MissionConfig } from '../../sim';
import { hudLine } from './selectors';

const NOTICE_MS = 2500;

/** Верхняя строка: миссия, деньги, жизни, волна + короткое сообщение (причина отказа). */
export function Hud({ mission }: { mission: MissionConfig }) {
  const s = useGameStore((st) => st.snapshot);
  const notice = useGameStore((st) => st.notice);
  const setNotice = useGameStore((st) => st.setNotice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice, setNotice]);
  return (
    <>
      <div className="hud" data-testid="hud">
        AIRBASE · {mission.name}
        {s && <> · {hudLine(mission, s)}</>}
      </div>
      {notice && (
        <div className="notice" data-testid="notice" role="status">
          {notice.text}
        </div>
      )}
    </>
  );
}
