import { useMemo } from 'react';
import { ALL_METHODS, METHOD_NAMES } from '../core/allocate';
import { computeIndices } from '../core/indices';
import { runListPR } from '../core/systems/listPR';
import { runSystem, systemSpec } from '../core/systems';
import type { SystemConfig } from '../core/systems';
import type { PartyId, Scenario } from '../core/types';
import { useApp } from '../state/scenario';
import { formatDecimal, formatInt } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  scenario: Scenario;
  config: SystemConfig;
  paint: Record<PartyId, PartyPaint>;
}

interface Column {
  key: string;
  label: string;
  totals: Record<PartyId, number>;
  gallagher: number;
  /** Metodo proportzionala bada, klik eginda hauta daiteke. */
  method?: (typeof ALL_METHODS)[number];
}

/**
 * Metodo guztiak datu berberekin, zutabetan.
 *
 * Sistema maioritarioa aktibo dagoenean, HURA ERE zutabe bat da — eta hor ikusten da benetako aldea:
 * boto berberekin, FPTP-k eta D'Hondt-ek erabat bestelako legebiltzarrak sortzen dituzte.
 */
export function ComparisonTable({ scenario, config, paint }: Props) {
  const setMethod = useApp((s) => s.setMethod);
  const spec = systemSpec(config.system);

  const columns = useMemo<Column[]>(() => {
    const prColumns: Column[] = ALL_METHODS.map((method) => {
      const result = runListPR(scenario, { method, threshold: config.threshold });
      return {
        key: method,
        label: METHOD_NAMES[method],
        totals: result.totals,
        gallagher: computeIndices(scenario, result).gallagher,
        method,
      };
    });

    if (spec.proportional) return prColumns;

    const current = runSystem(scenario, config);
    return [
      {
        key: config.system,
        label: spec.name,
        totals: current.totals,
        gallagher: computeIndices(scenario, current).gallagher,
      },
      ...prColumns,
    ];
  }, [scenario, config, spec]);

  const currentKey = spec.proportional ? config.method : config.system;
  const currentTotals = columns.find((c) => c.key === currentKey)?.totals ?? {};
  const bestGallagher = Math.min(...columns.map((c) => c.gallagher));

  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>
        {spec.proportional ? 'Metodoen konparaketa' : 'Sistemen konparaketa'}
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Boto, barruti eta langa berberak zutabe guztietan. Zenbaki koloredunek uneko emaitzarekiko
        aldea adierazten dute.
        {spec.proportional
          ? ' Klikatu goiburu bat metodo hori hartzeko.'
          : ` Lehen zutabea uneko sistema da (${spec.name}); gainerakoak proportzionalak lirateke.`}
      </p>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Alderdia</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="num"
                  style={{
                    cursor: c.method ? 'pointer' : 'default',
                    color: c.key === currentKey ? 'var(--ink)' : undefined,
                    borderBottom:
                      c.key === currentKey ? '2px solid var(--ink)' : '1px solid var(--grid)',
                  }}
                  onClick={() => c.method && setMethod(c.method)}
                  title={c.label}
                >
                  {c.label}
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
                      key={c.key}
                      className="num"
                      style={{
                        fontWeight: c.key === currentKey ? 700 : 400,
                        background: c.key === currentKey ? 'var(--hover)' : undefined,
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
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="num"
                  style={{
                    fontWeight: c.gallagher === bestGallagher ? 700 : 400,
                    color: c.gallagher === bestGallagher ? 'var(--good)' : 'var(--ink-muted)',
                    background: c.key === currentKey ? 'var(--hover)' : undefined,
                  }}
                >
                  {formatDecimal(c.gallagher)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="hint" style={{ marginBottom: 0 }}>
        Berdez: proportzionaltasun onena datu hauekin. Kontuz — metodo proportzionalenak ez du zertan
        "onena" izan: gobernagarritasunaren eta ordezkaritzaren arteko oreka erabaki politiko bat da.
      </p>
    </div>
  );
}
