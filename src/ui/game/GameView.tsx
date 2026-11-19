import { useEffect, useRef } from 'react';
import { CONTENT } from '../../content';
import { createScene } from '../../render';
import { useGameStore } from '../../store/game';
import { startGame } from './driver';
import { GroupPanel } from './GroupPanel';
import { baseMarks, baseUpgradeNotice, terrainLegend, warningRoutes, waveWarning } from '../../view/markup';
import { terrainCss } from '../../view/terrain';
import { WaveWarning } from './WaveWarning';
import { groupRows, recallCommand, REJECT_TEXT, rejectionNotice, world, zoneClick } from './selectors';
import type { LineupEntry, MissionConfig, SimState } from '../../sim';

/** Базы ближайшей волны для подсветки на карте (пусто, если волна не ожидается). У баз подпись постоянная, кольцу своя не нужна. */
const warningPoints = (mission: MissionConfig, state: SimState) =>
  (waveWarning(world(mission, CONTENT, state))?.entries ?? []).map((e) => ({ at: e.at, label: mission.objective ? '' : e.name }));

/** Холст карты и панель авиагрупп; `lineup` держать стабильным (смена `mission`/`lineup`/`seed` перезапускает бой). Игра мутируется только командами sim через драйвер. */
export function GameView({ mission, lineup, seed }: { mission: MissionConfig; lineup: readonly LineupEntry[]; seed: number }) {
  const host = useRef<HTMLDivElement>(null);
  const dispatch = useRef<((command: ReturnType<typeof recallCommand>) => void) | null>(null);
  const snapshot = useGameStore((st) => st.snapshot);
  const selectedGroup = useGameStore((st) => st.selectedGroup);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { setSnapshot, setNotice, selectGroup } = useGameStore.getState();
    const game = startGame(mission, CONTENT, seed, setSnapshot, lineup);
    dispatch.current = game.dispatch;
    const scene = createScene(el, mission, CONTENT, {
      // Выбрана группа — клик по карте ставит или переносит её зону.
      onMapClick: (cell) => {
        const st = useGameStore.getState();
        if (!st.snapshot) return;
        const action = zoneClick(world(mission, CONTENT, st.snapshot), st.selectedGroup, cell);
        if (!action) return;
        // Команда уходит в sim в любом случае (решает движок); подсказка — те же проверки sim.
        game.dispatch(action.command);
        if (action.rejection) setNotice(REJECT_TEXT[action.rejection]);
      },
    });
    const first = useGameStore.getState().snapshot;
    if (first) {
      scene.update(first);
      scene.setBases(baseMarks(mission, first));
      scene.setWarning(warningPoints(mission, first));
      scene.setRoutes(warningRoutes(world(mission, CONTENT, first)));
    }
    scene.setSelectedGroup(useGameStore.getState().selectedGroup);
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.selectedGroup !== prev.selectedGroup) scene.setSelectedGroup(s.selectedGroup);
      if (!s.snapshot || s.snapshot === prev.snapshot) return;
      scene.update(s.snapshot);
      scene.setBases(baseMarks(mission, s.snapshot));
      scene.setWarning(warningPoints(mission, s.snapshot));
      scene.setRoutes(warningRoutes(world(mission, CONTENT, s.snapshot)));
      const text = rejectionNotice(s.snapshot.events) ?? baseUpgradeNotice(mission, CONTENT, s.snapshot.events);
      if (text) setNotice(text);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectGroup(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unsub();
      dispatch.current = null;
      game.stop();
      scene.dispose();
      // Следующий бой не должен видеть снапшот, выбор и сообщение прошлого.
      setSnapshot(null);
      selectGroup(null);
      setNotice(null);
    };
  }, [mission, lineup, seed]);

  const store = useGameStore.getState;
  const warning = snapshot && waveWarning(world(mission, CONTENT, snapshot));
  const legend = terrainLegend(mission);
  return (
    <>
      <div ref={host} className="game-view" />
      {warning && <WaveWarning warning={warning} />}
      {legend.length > 0 && (
        <div className="terrain-legend panel" data-testid="terrain-legend">
          {legend.map((n) => (
            <span key={n.kind} className="terrain-note">
              <i className="terrain-swatch" style={{ background: terrainCss(n.kind) }} />
              {n.name} — {n.text}
            </span>
          ))}
          <span className="terrain-note terrain-routes">
            <i className="terrain-dot is-air" />
            <i className="terrain-dot is-ground" />
            точки — маршруты ближайшей волны
          </span>
        </div>
      )}
      {snapshot && (
        <GroupPanel
          rows={groupRows(world(mission, CONTENT, snapshot))}
          selected={selectedGroup}
          roles={Object.fromEntries(snapshot.groups.map((g) => [g.id, CONTENT.groups[g.type]?.role]))}
          onSelect={(g) => store().selectGroup(g)}
          onRecall={(g) => dispatch.current?.(recallCommand(g))}
        />
      )}
    </>
  );
}
