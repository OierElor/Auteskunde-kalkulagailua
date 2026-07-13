import { districtValidVotes } from '../core/threshold';
import type { ElectionResult, PartyId } from '../core/types';
import { useApp } from '../state/scenario';
import { formatInt, formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  paint: Record<PartyId, PartyPaint>;
  result: ElectionResult;
}

export function DataEditor({ paint, result }: Props) {
  const {
    scenario,
    config,
    addParty,
    removeParty,
    updateParty,
    addDistrict,
    removeDistrict,
    updateDistrict,
    setBlankVotes,
    setVotes,
  } = useApp();

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>Alderdiak</h3>
          <button onClick={addParty}>+ Alderdia gehitu</button>
        </div>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>Kol.</th>
                <th>Izena</th>
                <th style={{ width: 80 }}>Laburdura</th>
                <th style={{ width: 190 }}>
                  Ezker–eskuin
                  <span className="muted" style={{ textTransform: 'none', fontWeight: 400 }}>
                    {' '}
                    (hemizikloa ordenatzeko)
                  </span>
                </th>
                <th style={{ width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {scenario.parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updateParty(p.id, { color: e.target.value })}
                      aria-label={`${p.name} kolorea`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updateParty(p.id, { name: e.target.value })}
                      aria-label="Izena"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={p.abbrev}
                      onChange={(e) => updateParty(p.id, { abbrev: e.target.value })}
                      aria-label="Laburdura"
                    />
                  </td>
                  <td>
                    <div className="row">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={p.position}
                        onChange={(e) => updateParty(p.id, { position: Number(e.target.value) })}
                        aria-label={`${p.name} posizioa ardatz politikoan`}
                      />
                      <span
                        className="badge"
                        style={{ background: paint[p.id]?.fill, color: paint[p.id]?.ink }}
                      >
                        {p.abbrev || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="ghost"
                      onClick={() => removeParty(p.id)}
                      disabled={scenario.parties.length <= 1}
                      aria-label={`${p.name} kendu`}
                      title="Kendu"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>Barrutiak eta botoak</h3>
          <button onClick={addDistrict}>+ Barrutia gehitu</button>
        </div>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Barrutia</th>
                <th className="num" style={{ width: 78 }}>
                  Eserlekuak
                </th>
                <th className="num" style={{ width: 92 }} title="Hutsik = langa globala erabili">
                  Langa propioa
                </th>
                {scenario.parties.map((p) => (
                  <th key={p.id} className="num" style={{ minWidth: 96 }}>
                    <span className="party-cell" style={{ justifyContent: 'flex-end' }}>
                      <span
                        className="swatch"
                        style={{ background: paint[p.id]?.fill }}
                        aria-hidden
                      />
                      {p.abbrev}
                    </span>
                  </th>
                ))}
                <th className="num" style={{ minWidth: 88 }}>
                  Zuriak
                </th>
                <th style={{ width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {scenario.districts.map((d) => {
                const valid = districtValidVotes(scenario, d.id, config.threshold.includeBlank);
                const excluded = result.districts.find((x) => x.districtId === d.id)?.excluded ?? [];

                return (
                  <tr key={d.id}>
                    <td>
                      <input
                        type="text"
                        value={d.name}
                        onChange={(e) => updateDistrict(d.id, { name: e.target.value })}
                        aria-label="Barrutiaren izena"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={d.seats}
                        onChange={(e) =>
                          updateDistrict(d.id, { seats: Math.max(1, Number(e.target.value) || 1) })
                        }
                        aria-label={`${d.name} eserlekuak`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="—"
                        value={d.threshold ?? ''}
                        onChange={(e) =>
                          updateDistrict(d.id, {
                            threshold: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        aria-label={`${d.name} langa propioa`}
                      />
                    </td>

                    {scenario.parties.map((p) => {
                      const votes = scenario.votes[d.id]?.[p.id] ?? 0;
                      const out = excluded.includes(p.id);
                      return (
                        <td key={p.id}>
                          <input
                            type="number"
                            min={0}
                            value={votes}
                            onChange={(e) => setVotes(d.id, p.id, Number(e.target.value) || 0)}
                            aria-label={`${p.name} botoak ${d.name}n`}
                            style={{ borderColor: out ? 'var(--critical)' : undefined }}
                          />
                          <span
                            className="hint"
                            style={{
                              display: 'block',
                              textAlign: 'right',
                              color: out ? 'var(--critical)' : undefined,
                            }}
                          >
                            {valid > 0 ? formatPercent((votes / valid) * 100) : '—'}
                            {out ? ' · kanpo' : ''}
                          </span>
                        </td>
                      );
                    })}

                    <td>
                      <input
                        type="number"
                        min={0}
                        value={scenario.blankVotes[d.id] ?? 0}
                        onChange={(e) => setBlankVotes(d.id, Number(e.target.value) || 0)}
                        aria-label={`${d.name} boto zuriak`}
                      />
                      <span className="hint" style={{ display: 'block', textAlign: 'right' }}>
                        {formatInt(valid)} balio.
                      </span>
                    </td>

                    <td>
                      <button
                        className="ghost"
                        onClick={() => removeDistrict(d.id)}
                        disabled={scenario.districts.length <= 1}
                        aria-label={`${d.name} kendu`}
                        title="Kendu"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Ehunekoa langaren izendatzailearen gainean kalkulatzen da (boto zuriak sartuta edo gabe,
          zure ezarpenaren arabera). Gorriz markatutakoak langak kanpoan utzitakoak dira.
        </p>
      </div>
    </div>
  );
}
