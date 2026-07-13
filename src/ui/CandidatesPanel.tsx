import { useMemo, useState } from 'react';
import { electedCandidates, generateCandidates } from '../core/candidates';
import type { ElectionResult, PartyId, Scenario } from '../core/types';
import { useApp } from '../state/scenario';
import { formatInt } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  scenario: Scenario;
  result: ElectionResult;
  paint: Record<PartyId, PartyPaint>;
}

/**
 * Zerrenda irekiak: alderdiaren eserleku KOPURUA ez da aldatzen; hautagaien ORDENA bai.
 *
 * Geruza hau edozein sistema proportzionalen gainean doa. Hemen ikusten den galdera hau da:
 * alderdiak erabakitzen du nor sartzen den (zerrenda itxia), ala hautesleak (zerrenda irekia)?
 */
export function CandidatesPanel({ scenario, result, paint }: Props) {
  const { config, setCandidates, setPreference, resetPreferences } = useApp();
  const [districtId, setDistrictId] = useState(scenario.districts[0]?.id ?? '');

  const district = scenario.districts.find((d) => d.id === districtId) ?? scenario.districts[0];
  const cfg = config.candidates;

  const candidates = useMemo(() => generateCandidates(scenario, cfg), [scenario, cfg]);
  const elected = useMemo(
    () => electedCandidates(scenario, result, candidates, cfg),
    [scenario, result, candidates, cfg],
  );

  if (!district) return null;

  const inDistrict = elected[district.id] ?? [];
  const electedIds = new Set(inDistrict.map((e) => e.candidate.id));
  const changed = inDistrict.filter((e) => !e.wouldBeElectedClosed).length;

  const partiesWithSeats = scenario.parties.filter(
    (p) => (result.seatsByDistrict[district.id]?.[p.id] ?? 0) > 0,
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack">
        <div className="spread">
          <h3>Zerrenda-mota</h3>
          <select
            value={district.id}
            onChange={(e) => setDistrictId(e.target.value)}
            style={{ width: 'auto' }}
            aria-label="Barrutia"
          >
            {scenario.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.seats})
              </option>
            ))}
          </select>
        </div>

        <select
          value={cfg.listMode}
          onChange={(e) => setCandidates({ listMode: e.target.value as never })}
          aria-label="Zerrenda-mota"
        >
          <option value="closed">Itxia — alderdiak erabakitzen du ordena</option>
          <option value="open">Irekia — lehentasun-boto gehien dutenak (Finlandia, Brasil)</option>
          <option value="flexible">Malgua — kuota gainditzen dutenak aurreratzen dira (Herbehereak)</option>
        </select>

        {cfg.listMode === 'flexible' && (
          <div className="spread">
            <label style={{ minWidth: 110 }}>Aurreratzeko kuota</label>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={cfg.flexibleQuota}
              onChange={(e) => setCandidates({ flexibleQuota: Number(e.target.value) })}
              aria-label="Aurreratzeko kuota"
            />
            <span className="value" style={{ minWidth: 40, textAlign: 'right' }}>
              %{cfg.flexibleQuota}
            </span>
          </div>
        )}

        <p className="hint" style={{ margin: 0 }}>
          {cfg.listMode === 'closed'
            ? 'Hautagaiak zerrendako ordenan sartzen dira. Hautesleak alderdiari bozkatzen dio, ez pertsonari.'
            : cfg.listMode === 'open'
              ? 'Lehentasun-boto gehien dituztenak sartzen dira, zerrendako ordena edozein dela ere.'
              : 'Kuota gainditzen duten hautagaiak aurreratzen dira; gainerakoak zerrendako ordenaz sartzen dira.'}{' '}
          <strong>
            Alderdiaren eserleku kopurua ez da aldatzen — nor sartzen den bakarrik.
          </strong>
        </p>

        {changed > 0 && (
          <div className="banner alert">
            <span aria-hidden>⚠</span>
            <div>
              <strong>{changed} hautagai</strong> sartu dira zerrenda itxiarekin sartuko EZ
              liratekeenak. Hautesleek alderdiaren ordena aldatu dute.
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>{district.name} — hautagaiak</h3>
          {Object.keys(cfg.preferences).length > 0 && (
            <button className="ghost" onClick={resetPreferences}>
              Eskuzko botoak kendu
            </button>
          )}
        </div>

        <p className="hint" style={{ marginTop: 0 }}>
          Lehentasun-botoak sintetikoak dira (hazi finko batekin sortuak). Editatu eta ikusi nola
          aldatzen den nor sartzen den. <strong>Berdez</strong>: hautatuak.{' '}
          <strong>Marra batekin</strong>: zerrenda itxiarekin sartuko litzatekeena, baina orain ez.
        </p>

        <div className="scroll-x" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Alderdia</th>
                <th className="num" style={{ width: 60 }}>
                  Postua
                </th>
                <th>Hautagaia</th>
                <th className="num" style={{ width: 120 }}>
                  Lehentasun-botoak
                </th>
                <th style={{ width: 100 }}>Emaitza</th>
              </tr>
            </thead>
            <tbody>
              {partiesWithSeats.map((party) => {
                const list = candidates
                  .filter((c) => c.districtId === district.id && c.partyId === party.id)
                  .sort((a, b) => a.listOrder - b.listOrder);
                const seats = result.seatsByDistrict[district.id]?.[party.id] ?? 0;

                return list.map((c, i) => {
                  const isElected = electedIds.has(c.id);
                  const closedWinner = c.listOrder <= seats;

                  return (
                    <tr key={c.id} style={{ opacity: isElected || closedWinner ? 1 : 0.55 }}>
                      {i === 0 && (
                        <td rowSpan={list.length} style={{ verticalAlign: 'top' }}>
                          <span className="party-cell">
                            <span
                              className="swatch"
                              style={{ background: paint[party.id]?.fill }}
                              aria-hidden
                            />
                            <span>
                              {party.abbrev}
                              <br />
                              <span className="hint">{seats} eserleku</span>
                            </span>
                          </span>
                        </td>
                      )}
                      <td className="num muted">{c.listOrder}</td>
                      <td
                        style={{
                          fontWeight: isElected ? 600 : 400,
                          textDecoration:
                            !isElected && closedWinner ? 'line-through' : undefined,
                        }}
                      >
                        {c.name}
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          value={c.preferenceVotes}
                          onChange={(e) => setPreference(c.id, Number(e.target.value) || 0)}
                          aria-label={`${c.name} lehentasun-botoak`}
                          disabled={cfg.listMode === 'closed'}
                        />
                      </td>
                      <td>
                        {isElected ? (
                          <span
                            className="badge"
                            style={{ background: 'var(--good)', color: '#fff' }}
                          >
                            {closedWinner ? 'hautatua' : 'aurreratua'}
                          </span>
                        ) : closedWinner ? (
                          <span className="badge warn" style={{ border: '1px solid var(--border)' }}>
                            baztertua
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {partiesWithSeats.length === 0 && (
          <p className="hint" style={{ marginBottom: 0 }}>
            Alderdi bakar batek ere ez du eserlekurik barruti honetan.
          </p>
        )}

        <p className="hint" style={{ marginBottom: 0 }}>
          Guztira {formatInt(inDistrict.length)} hautatu barruti honetan.
        </p>
      </div>
    </div>
  );
}
