import { useState } from 'react';
import { quotientGrid } from '../core/allocate';
import { QUOTA_METHODS } from '../core/quotas';
import { partyVotes } from '../core/threshold';
import type { ElectionResult, PartyId, Scenario } from '../core/types';
import { formatDecimal, formatInt } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  scenario: Scenario;
  result: ElectionResult;
  paint: Record<PartyId, PartyPaint>;
}

/**
 * "D'Hondt taula" klasikoa: zatiduren sareta, eserlekua eman dutenak nabarmenduta.
 * Hau da metodoa ULERTZEKO behar den irudia — emaitza soilak ez du ezer azaltzen.
 */
export function QuotientTable({ scenario, result, paint }: Props) {
  const [districtId, setDistrictId] = useState(scenario.districts[0]?.id ?? '');
  const district =
    scenario.districts.find((d) => d.id === districtId) ?? scenario.districts[0];
  const allocation =
    result.districts.find((d) => d.districtId === district?.id) ?? result.districts[0];

  if (!district || !allocation) return null;

  const seats = result.seatsByDistrict[district.id] ?? {};
  const eligible = scenario.parties.filter(
    (p) => partyVotes(scenario, district.id, p.id) > 0 && !allocation.excluded.includes(p.id),
  );

  const selector = (
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
  );

  if (allocation.detail.kind === 'quota') {
    const detail = allocation.detail;
    const spec = QUOTA_METHODS[detail.effectiveMethod];

    return (
      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>Kuota eta hondarrak</h3>
          {selector}
        </div>

        <p className="hint" style={{ marginTop: 0 }}>
          <strong>{spec.name}</strong> — kuota = {spec.formula} ={' '}
          <strong>{formatDecimal(detail.quota, 1)}</strong> boto eserleku bakoitzeko.
          {detail.effectiveMethod !== detail.method && (
            <span className="warn">
              {' '}
              (Eskatutako metodoak gehiegi esleitzen zuen; honetara itzuli da.)
            </span>
          )}
        </p>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Alderdia</th>
                <th className="num">Botoak</th>
                <th className="num">Kuota osoak</th>
                <th className="num">Hondarra</th>
                <th className="num">Hondar-eserlekuak</th>
                <th className="num">Guztira</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="party-cell">
                      <span className="swatch" style={{ background: paint[p.id]?.fill }} aria-hidden />
                      {p.name}
                    </span>
                  </td>
                  <td className="num">{formatInt(partyVotes(scenario, district.id, p.id))}</td>
                  <td className="num">{detail.automatic[p.id] ?? 0}</td>
                  <td
                    className="num"
                    style={{
                      fontWeight: (detail.remainderSeats[p.id] ?? 0) > 0 ? 700 : 400,
                      color: (detail.remainderSeats[p.id] ?? 0) > 0 ? 'var(--ink)' : undefined,
                    }}
                  >
                    {formatDecimal(detail.remainders[p.id] ?? 0, 1)}
                  </td>
                  <td className="num">{detail.remainderSeats[p.id] ?? 0}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {seats[p.id] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Lodiz: hondar handienagatik eserleku bat gehiago hartu duten alderdiak.
        </p>
      </div>
    );
  }

  const grid = quotientGrid(
    Object.fromEntries(eligible.map((p) => [p.id, partyVotes(scenario, district.id, p.id)])),
    district.seats,
    allocation.detail.method,
    eligible.map((p) => p.id),
    seats,
    Math.min(district.seats, 14),
  );

  // Zenbatgarren eserlekua eman duen zatidura bakoitzak: sareta irakurgarri egiten duena.
  const order = new Map(
    allocation.detail.steps.map((s) => [`${s.partyId}:${s.seatForParty}`, s.seatNumber]),
  );

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3>Zatiduren taula</h3>
        {selector}
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        Alderdi bakoitzaren botoak zatitzaile bakoitzarekin zatituta. {district.seats} zatidura
        handienek hartzen dituzte eserlekuak — <strong>nabarmenduta</strong> daudenak, eta zenbaki
        txikiak esleipenaren ordena adierazten du.
      </p>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Alderdia</th>
              {grid[0]?.cells.map((c) => (
                <th key={c.divisorIndex} className="num">
                  ÷{c.divisorIndex}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => {
              const party = scenario.parties.find((p) => p.id === row.partyId)!;
              return (
                <tr key={row.partyId}>
                  <td>
                    <span className="party-cell">
                      <span
                        className="swatch"
                        style={{ background: paint[row.partyId]?.fill }}
                        aria-hidden
                      />
                      {party.abbrev}
                      <span className="muted">{seats[row.partyId] ?? 0}</span>
                    </span>
                  </td>
                  {row.cells.map((c) => {
                    const seatNumber = order.get(`${row.partyId}:${c.divisorIndex}`);
                    return (
                      <td
                        key={c.divisorIndex}
                        className="num"
                        style={{
                          background: c.won
                            ? `color-mix(in srgb, ${paint[row.partyId]?.fill} 20%, transparent)`
                            : undefined,
                          fontWeight: c.won ? 700 : 400,
                          color: c.won ? 'var(--ink)' : 'var(--ink-muted)',
                          borderRadius: c.won ? 4 : 0,
                        }}
                      >
                        {Number.isFinite(c.value) ? formatDecimal(c.value, 0) : '∞'}
                        {seatNumber !== undefined && (
                          <sup style={{ marginLeft: 3, color: 'var(--ink-muted)', fontWeight: 400 }}>
                            {seatNumber}
                          </sup>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {allocation.excluded.length > 0 && (
        <p className="hint" style={{ marginBottom: 0 }}>
          Langak kanpoan utziak (taulatik kanpo):{' '}
          {allocation.excluded
            .map((id) => scenario.parties.find((p) => p.id === id)?.name ?? id)
            .join(', ')}
          .
        </p>
      )}
    </div>
  );
}
