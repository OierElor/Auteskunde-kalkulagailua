import { useState } from 'react';
import { scenarioToCsv } from '../core/csv';
import { useApp } from '../state/scenario';

export function CsvPanel() {
  const { scenario, importCsv } = useApp();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const current = scenarioToCsv(scenario);

  function handleImport() {
    try {
      importCsv(text);
      setError(null);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOk(false);
    }
  }

  function download() {
    const blob = new Blob([current], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.name.replace(/[^\w-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack">
        <h3>Zure datuak kargatu</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Lehen zutabea barrutia, bigarrena eserlekuak, gainerakoak alderdiak. <code>Zuriak</code>{' '}
          izeneko zutabea boto zuritzat hartzen da. Bereizlea (<code>;</code> edo <code>,</code>) eta
          milakoen puntuak automatikoki antzematen dira.
        </p>

        <pre
          style={{
            margin: 0,
            padding: 10,
            background: 'var(--raised)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: '0.75rem',
            overflowX: 'auto',
            color: 'var(--ink-2)',
          }}
        >
          {'Barrutia;Eserlekuak;EAJ;EH Bildu;PSE-EE;Zuriak\nAraba;25;62.000;51.000;38.000;1.200'}
        </pre>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Itsatsi hemen zure CSVa…"
          rows={8}
          spellCheck={false}
          style={{
            font: 'inherit',
            fontSize: '0.8rem',
            fontFamily: 'ui-monospace, monospace',
            color: 'var(--ink)',
            background: 'var(--raised)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            width: '100%',
            resize: 'vertical',
          }}
        />

        <div className="row">
          <button className="primary" onClick={handleImport} disabled={text.trim() === ''}>
            Inportatu
          </button>
          <button onClick={() => setText(current)}>Oraingoa kargatu editatzeko</button>
          {ok && <span className="hint" style={{ color: 'var(--good)' }}>Inportatuta.</span>}
        </div>

        {error && (
          <div className="banner alert">
            <strong className="warn">Ezin izan da inportatu.</strong> {error}
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="spread">
          <h3>Oraingo datuak esportatu</h3>
          <button onClick={download}>CSV jaitsi</button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 10,
            background: 'var(--raised)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: '0.75rem',
            overflowX: 'auto',
            maxHeight: 220,
            color: 'var(--ink-2)',
          }}
        >
          {current}
        </pre>
      </div>
    </div>
  );
}
