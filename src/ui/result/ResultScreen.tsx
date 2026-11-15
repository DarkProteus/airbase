import type { MissionConfig, MissionResult, Reward } from '../../sim';
import { resultView, type ResultRow } from './model';
import './result.css';

const Rows = ({ rows, testId }: { rows: ResultRow[]; testId: string }) => (
  <dl className="result-rows" data-testid={testId}>
    {rows.map((r) => (
      <div key={r.label}>
        <dt>{r.label}</dt>
        <dd>{r.value}</dd>
      </div>
    ))}
  </dl>
);

/** Экран итога: исход по цели миссии, статистика, награда с бонусом групп и возврат на базу. */
export function ResultScreen({
  mission,
  result,
  reward,
  currency,
  onHome,
}: {
  mission: MissionConfig;
  result: MissionResult;
  reward: Reward;
  currency: number;
  onHome: () => void;
}) {
  const v = resultView(mission, result, reward, currency);
  return (
    <main className="result" data-testid="result-screen" data-outcome={result.status}>
      <h1 data-testid="result-title" data-won={v.won}>{v.title}</h1>
      <section>
        <h2>Статистика</h2>
        <Rows rows={v.stats} testId="result-stats" />
      </section>
      <section>
        <h2>Награда</h2>
        <Rows rows={v.reward} testId="result-reward" />
        <div className="result-total">
          {v.total.label}: <strong data-testid="result-total">{v.total.value}</strong>
        </div>
        <div className="result-balance">
          {v.balance.label}: <strong data-testid="result-balance">{v.balance.value}</strong>
        </div>
      </section>
      <button type="button" data-testid="to-base" onClick={onHome}>
        На базу
      </button>
    </main>
  );
}
