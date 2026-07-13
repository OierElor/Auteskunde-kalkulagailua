import { useState } from 'react';
import { generateCandidates } from '../core/candidates';
import type { ElectionResult, PartyId, Scenario, StvDetail } from '../core/types';
import { useApp } from '../state/scenario';
import { formatDecimal, formatInt, formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  scenario: Scenario;
  result: ElectionResult;
  paint: Record<PartyId, PartyPaint>;
}

/**
 * STV erronda-erronda.
 *
 * Hau da STV ULERTZEKO behar den irudia: emaitza soilak ez du ezer azaltzen. Hemen ikusten da
 * nork transferitzen dion zer nori, eta zenbat boto agortzen diren bidean.
 */
export function StvRounds({ scenario, result, paint }: Props) {
  const config = useApp((s) => s.config);
  const [districtId, setDistrictId] = useState(scenario.districts[0]?.id ?? '');

  const district = scenario.districts.find((d) => d.id === districtId) ?? scenario.districts[0];
  const allocation =
    result.districts.find((d) => d.districtId === district?.id) ?? result.districts[0];

  if (!district || !allocation || allocation.detail.kind !== 'stv') return null;
  const detail: StvDetail = allocation.detail;

  const candidates = generateCandidates(scenario, config.candidates).filter(
    (c) => c.districtId === district.id,
  );
  const byId = (id: string) => candidates.find((c) => c.id === id);
  const partyOf = (id: string) => byId(id)?.partyId;

  const electedSet = new Set(detail.elected);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="banner">
        <span aria-hidden>ℹ</span>
        <div>
          STVn <strong>hautagaiak</strong> lehiatzen dira, ez alderdiak, eta hautesleak ORDENATU
          egiten ditu. Boto-txartel ordenatuak ez daude datuetan: bigarren itzuliko{' '}
          <strong>transferentzia-matrize berbera</strong> erabiltzen dugu sortzeko. Hipotesi bat da —
          aldatu <strong>Transferentziak</strong> fitxan eta ikusi emaitza mugitzen.
        </div>
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>Erronda-erronda</h3>
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

        <p className="hint" style={{ marginTop: 0 }}>
          <strong>Droop kuota = ⌊{formatInt(detail.totalVotes)} / ({district.seats}+1)⌋ + 1 ={' '}
          {formatInt(detail.quota)}</strong> boto. Hau da benetako langa — ez dago beste bat.{' '}
          {district.seats === 1 && <>Eserleku bakarra denez, hau <strong>IRV</strong> da.</>}
        </p>

        {/* 25 eserlekuko barrutiak ~150 erronda ditu (ekintza bat erronda bakoitzeko). */}
        <div className="scroll-x" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Erronda</th>
                <th>Ekintza</th>
                <th className="num">Botoak</th>
                <th>Transferentziak</th>
                <th className="num">Agortuak</th>
              </tr>
            </thead>
            <tbody>
              {detail.rounds.map((round) => {
                const actor = round.elected ?? round.eliminated;
                const actorParty = actor ? partyOf(actor) : undefined;

                return (
                  <tr key={round.round}>
                    <td className="num muted">{round.round}</td>
                    <td>
                      {actor ? (
                        <span className="party-cell">
                          <span
                            className="swatch"
                            style={{ background: actorParty ? paint[actorParty]?.fill : undefined }}
                            aria-hidden
                          />
                          <strong>{byId(actor)?.name ?? actor}</strong>
                          <span
                            className="badge"
                            style={{
                              background: round.elected ? 'var(--good)' : 'var(--critical)',
                              color: '#fff',
                            }}
                          >
                            {round.elected ? 'hautatua' : 'kanporatua'}
                          </span>
                        </span>
                      ) : (
                        <span className="muted">Geratzen direnak hautatuak</span>
                      )}
                    </td>
                    <td className="num">
                      {actor ? formatDecimal(round.counts[actor] ?? 0, 0) : '—'}
                    </td>
                    <td>
                      {round.transfers.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="stack" style={{ gap: 2 }}>
                          {round.transfers
                            .filter((t) => t.votes > 0.5)
                            .sort((a, b) => b.votes - a.votes)
                            .slice(0, 4)
                            .map((t, i) => {
                              const toParty = partyOf(t.to);
                              return (
                                <span
                                  key={i}
                                  className="row"
                                  style={{ gap: 5, fontSize: '0.78rem' }}
                                >
                                  <span className="muted">→</span>
                                  <span
                                    className="swatch"
                                    style={{ background: toParty ? paint[toParty]?.fill : undefined }}
                                    aria-hidden
                                  />
                                  <span>{byId(t.to)?.name ?? t.to}</span>
                                  <span className="value">{formatDecimal(t.votes, 0)}</span>
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </td>
                    <td className="num muted">{formatDecimal(round.exhausted, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detail.exhausted > 0 && (
          <p className="hint" style={{ marginBottom: 0 }}>
            <strong>{formatDecimal(detail.exhausted, 0)} boto agortu dira</strong> (
            {formatPercent((detail.exhausted / detail.totalVotes) * 100)}): lehentasun gehiagorik ez
            zuten txartelak. Horregatik azken hautatuek kuota baino gutxiago izan dezakete —
            hautesle-gorputz eraginkorra txikitu egin da.
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Hautatuak — {district.name}</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {detail.elected.map((id, i) => {
            const candidate = byId(id);
            if (!candidate) return null;
            return (
              <span
                key={id}
                className="row"
                style={{
                  gap: 6,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 9px',
                }}
              >
                <span className="muted" style={{ fontSize: '0.72rem' }}>
                  {i + 1}.
                </span>
                <span
                  className="swatch"
                  style={{ background: paint[candidate.partyId]?.fill }}
                  aria-hidden
                />
                <span style={{ fontSize: '0.84rem' }}>{candidate.name}</span>
              </span>
            );
          })}
        </div>
        {detail.elected.length < district.seats && (
          <p className="hint warn" style={{ marginBottom: 0, marginTop: 8 }}>
            {district.seats - detail.elected.length} eserleku bete gabe: botoak agortu dira.
          </p>
        )}
        {electedSet.size !== detail.elected.length && (
          <p className="hint warn">Errepikapena hautatuen zerrendan — hau akats bat da.</p>
        )}
      </div>
    </div>
  );
}
