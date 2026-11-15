import type { GroupRegistry, MissionConfig, MissionResult, Reward } from '../../sim';
import { resultView, type ResultRow, type TableView } from './model';
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

const Table = ({ table, testId }: { table: TableView; testId: string }) => (
  <table className="result-table" data-testid={testId}>
    <thead>
      <tr>
        {table.head.map((h) => (
          <th key={h}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {table.rows.map((r, i) => (
        <tr key={i} data-mark={r.mark}>
          {r.cells.map((c, j) => (
            <td key={j}>{c}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/** Экран итога: исход по цели миссии, статистика, награда с бонусом групп и возврат на базу. */
export function ResultScreen({
  mission,
  result,
  reward,
  currency,
  groups,
  onHome,
}: {
  mission: MissionConfig;
  result: MissionResult;
  reward: Reward;
  currency: number;
  groups: GroupRegistry;
  onHome: () => void;
}) {
  const v = resultView(mission, result, reward, currency, groups);
  return (
    <main className="result" data-testid="result-screen" data-outcome={result.status}>
      <h1 data-testid="result-title" data-won={v.won}>{v.title}</h1>
      <section>
        <h2>Статистика</h2>
        <Rows rows={v.stats} testId="result-stats" />
      </section>
      <section>
        <h2>Разбор по группам</h2>
        <Table table={v.groups} testId="result-groups" />
      </section>
      <section>
        <h2>Разбор по волнам</h2>
        <Table table={v.waves} testId="result-waves" />
        {v.weak.length > 0 && (
          <ul className="result-weak" data-testid="result-weak">
            {v.weak.map((w) => (
              <li key={w.kind === 'wave' ? 'wave' : `g${w.group}`} data-kind={w.kind}>
                {w.text}
              </li>
            ))}
          </ul>
        )}
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
