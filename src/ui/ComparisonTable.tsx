import { useMemo } from 'react';
import { ALL_METHODS, METHOD_NAMES } from '../core/allocate';
import { computeIndices } from '../core/indices';
import { runListPR } from '../core/systems/listPR';
import type { MethodId, PartyId, Scenario, ThresholdConfig } from '../core/types';
import { useApp } from '../state/scenario';
import { formatDecimal, formatInt } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  scenario: Scenario;
  threshold: ThresholdConfig;
  current: MethodId;
  paint: Record<PartyId, PartyPaint>;
}

/**
 * Metodo guztiak datu berberekin, zutabetan. Hau da galdera zuzenean erantzuten duen taula:
 * "eta beste metodo bat erabiliko balitz?".
 */
export function ComparisonTable({ scenario, threshold, current, paint }: Props) {
  const setMethod = useApp((s) => s.setMethod);

  const columns = useMemo(
    () =>
      ALL_METHODS.map((method) => {
        const result = runListPR(scenario, { method, threshold });
        return {
          method,
          totals: result.totals,
          gallagher: computeIndices(scenario, result).gallagher,
        };
      }),
    [scenario, threshold],
  );

  const currentTotals = columns.find((c) => c.method === current)!.totals;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>Metodoen konparaketa</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Boto, barruti eta langa berberak metodo guztietan. Zenbaki koloredunek uneko metodoarekiko
        aldea adierazten dute. Klikatu goiburu bat metodo hori hartzeko.
      </p>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Alderdia</th>
              {columns.map((c) => (
                <th
                  key={c.method}
                  className="num"
                  style={{
                    cursor: 'pointer',
                    color: c.method === current ? 'var(--ink)' : undefined,
                    borderBottom:
                      c.method === current ? '2px solid var(--ink)' : '1px solid var(--grid)',
                  }}
                  onClick={() => setMethod(c.method)}
                  title={METHOD_NAMES[c.method]}
                >
                  {METHOD_NAMES[c.method]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.parties.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="party-cell">
                    <span className="swatch" style={{ background: paint[p.id]?.fill }} aria-hidden />
                    {p.name}
                  </span>
                </td>
                {columns.map((c) => {
                  const seats = c.totals[p.id] ?? 0;
                  const delta = seats - (currentTotals[p.id] ?? 0);
                  return (
                    <td
                      key={c.method}
                      className="num"
                      style={{
                        fontWeight: c.method === current ? 700 : 400,
                        background:
                          c.method === current ? 'var(--hover)' : undefined,
                      }}
                    >
                      {formatInt(seats)}
                      {delta !== 0 && (
                        <span
                          style={{
                            marginLeft: 5,
                            fontSize: '0.72rem',
                            color: delta > 0 ? 'var(--good)' : 'var(--critical)',
                          }}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="muted" title="Desproportzionaltasuna: txikiagoa = proportzionalagoa">
                Gallagher
              </td>
              {columns.map((c) => {
                const best = Math.min(...columns.map((x) => x.gallagher));
                return (
                  <td
                    key={c.method}
                    className="num"
                    style={{
                      fontWeight: c.gallagher === best ? 700 : 400,
                      color: c.gallagher === best ? 'var(--good)' : 'var(--ink-muted)',
                      background: c.method === current ? 'var(--hover)' : undefined,
                    }}
                  >
                    {formatDecimal(c.gallagher)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="hint" style={{ marginBottom: 0 }}>
        Berdez: proportzionaltasun onena lortzen duen metodoa datu hauekin. Kontuz — metodo
        proportzionalenak ez du zertan "onena" izan: gobernagarritasunaren eta ordezkaritzaren
        arteko oreka erabaki politiko bat da.
      </p>
    </div>
  );
}
