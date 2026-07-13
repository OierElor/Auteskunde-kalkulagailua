import { useMemo, useState } from 'react';
import { computeIndices } from './core/indices';
import { runSystem, systemSpec } from './core/systems';
import { useApp } from './state/scenario';
import { ComparisonTable } from './ui/ComparisonTable';
import { ControlPanel } from './ui/ControlPanel';
import { CoalitionBuilder } from './ui/CoalitionBuilder';
import { CsvPanel } from './ui/CsvPanel';
import { DataEditor } from './ui/DataEditor';
import { DistrictResults } from './ui/DistrictResults';
import { Hemicycle } from './ui/Hemicycle';
import { IndicesPanel } from './ui/IndicesPanel';
import { QuotientTable } from './ui/QuotientTable';
import { ResultsTable } from './ui/ResultsTable';
import { TransferMatrix } from './ui/TransferMatrix';
import { usePartyPaint, useTheme } from './ui/theme';

type Tab = 'datuak' | 'banaketa' | 'transferentziak' | 'indizeak' | 'konparaketa' | 'csv';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useState<Tab>('datuak');

  const { scenario, config, coalition, toggleCoalition, clearCoalition, undo, redo, past, future } =
    useApp();

  const spec = systemSpec(config.system);
  const paint = usePartyPaint(scenario.parties, theme);

  const result = useMemo(() => runSystem(scenario, config), [scenario, config]);
  const indices = useMemo(() => computeIndices(scenario, result), [scenario, result]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'datuak', label: 'Datuak' },
    { id: 'banaketa', label: spec.proportional ? 'Nola banatu diren' : 'Barrutiak' },
    ...(config.system === 'two-round'
      ? [{ id: 'transferentziak' as Tab, label: 'Transferentziak' }]
      : []),
    { id: 'indizeak', label: 'Proportzionaltasuna' },
    { id: 'konparaketa', label: spec.proportional ? 'Metodoen konparaketa' : 'Sistemen konparaketa' },
    { id: 'csv', label: 'CSV' },
  ];

  // Fitxa aktiboa desagertu bada (sistema aldatzean), lehenengora itzuli.
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'datuak';

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
            {scenario.name} · {spec.name} · {scenario.districts.length} barruti ·{' '}
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
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ paddingTop: 16 }}>
              {activeTab === 'datuak' && <DataEditor paint={paint} result={result} />}

              {activeTab === 'banaketa' &&
                (spec.proportional ? (
                  <QuotientTable scenario={scenario} result={result} paint={paint} />
                ) : (
                  <DistrictResults scenario={scenario} result={result} paint={paint} />
                ))}

              {activeTab === 'transferentziak' && <TransferMatrix paint={paint} />}

              {activeTab === 'indizeak' && (
                <IndicesPanel parties={scenario.parties} indices={indices} paint={paint} />
              )}

              {activeTab === 'konparaketa' && (
                <ComparisonTable scenario={scenario} config={config} paint={paint} />
              )}

              {activeTab === 'csv' && <CsvPanel />}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
