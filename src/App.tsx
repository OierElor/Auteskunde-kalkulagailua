import { useMemo, useState } from 'react';
import { computeIndices } from './core/indices';
import { runSystem } from './core/systems';
import { useApp } from './state/scenario';
import { ComparisonTable } from './ui/ComparisonTable';
import { ControlPanel } from './ui/ControlPanel';
import { CoalitionBuilder } from './ui/CoalitionBuilder';
import { CsvPanel } from './ui/CsvPanel';
import { DataEditor } from './ui/DataEditor';
import { Hemicycle } from './ui/Hemicycle';
import { IndicesPanel } from './ui/IndicesPanel';
import { QuotientTable } from './ui/QuotientTable';
import { ResultsTable } from './ui/ResultsTable';
import { usePartyPaint, useTheme } from './ui/theme';

type Tab = 'datuak' | 'zatidurak' | 'indizeak' | 'konparaketa' | 'csv';

const TABS: { id: Tab; label: string }[] = [
  { id: 'datuak', label: 'Datuak' },
  { id: 'zatidurak', label: 'Nola banatu diren' },
  { id: 'indizeak', label: 'Proportzionaltasuna' },
  { id: 'konparaketa', label: 'Metodoen konparaketa' },
  { id: 'csv', label: 'CSV' },
];

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useState<Tab>('datuak');

  const { scenario, config, coalition, toggleCoalition, clearCoalition, undo, redo, past, future } =
    useApp();

  const paint = usePartyPaint(scenario.parties, theme);

  const result = useMemo(() => runSystem(scenario, config), [scenario, config]);
  const indices = useMemo(() => computeIndices(scenario, result), [scenario, result]);

  const setCoalition = (ids: string[]) => {
    clearCoalition();
    ids.forEach(toggleCoalition);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Hauteskunde Kalkulagailua</h1>
          <span className="subtitle">
            {scenario.name} · {scenario.districts.length} barruti ·{' '}
            {scenario.districts.reduce((s, d) => s + d.seats, 0)} eserleku
          </span>
        </div>

        <div className="row">
          <button onClick={undo} disabled={past.length === 0} title="Desegin">
            ↶ Desegin
          </button>
          <button onClick={redo} disabled={future.length === 0} title="Berregin">
            ↷ Berregin
          </button>
          <button onClick={toggleTheme} title="Gaia aldatu">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <div className="app">
        <aside className="sidebar">
          <ControlPanel />
        </aside>

        <main className="main">
          {result.warnings.length > 0 && (
            <div className="banner alert">
              <span aria-hidden>⚠</span>
              <div>
                {result.warnings.slice(0, 3).map((w, i) => (
                  <div key={i}>{w.message}</div>
                ))}
                {result.warnings.length > 3 && (
                  <div className="muted">…eta beste {result.warnings.length - 3}.</div>
                )}
              </div>
            </div>
          )}

          <Hemicycle
            parties={scenario.parties}
            totals={result.totals}
            paint={paint}
            coalition={coalition}
            onToggleParty={toggleCoalition}
          />

          <CoalitionBuilder
            parties={scenario.parties}
            totals={result.totals}
            paint={paint}
            coalition={coalition}
            onToggleParty={toggleCoalition}
            onClear={clearCoalition}
            onSet={setCoalition}
          />

          <ResultsTable
            parties={scenario.parties}
            result={result}
            indices={indices}
            paint={paint}
            coalition={coalition}
            onToggleParty={toggleCoalition}
          />

          <div>
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ paddingTop: 16 }}>
              {tab === 'datuak' && <DataEditor paint={paint} result={result} />}
              {tab === 'zatidurak' && (
                <QuotientTable scenario={scenario} result={result} paint={paint} />
              )}
              {tab === 'indizeak' && (
                <IndicesPanel parties={scenario.parties} indices={indices} paint={paint} />
              )}
              {tab === 'konparaketa' && (
                <ComparisonTable
                  scenario={scenario}
                  threshold={config.threshold}
                  current={config.method}
                  paint={paint}
                />
              )}
              {tab === 'csv' && <CsvPanel />}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
