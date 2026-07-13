import type { Indices } from '../core/indices';
import type { ElectionResult, Party, PartyId } from '../core/types';
import { formatInt, formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  parties: Party[];
  result: ElectionResult;
  indices: Indices;
  paint: Record<PartyId, PartyPaint>;
  coalition: PartyId[];
  onToggleParty: (id: PartyId) => void;
}

/**
 * Emaitza-taula. Hemizikloaren kondaira ere BADA: koloreak inoiz ez du identitatea bakarrik
 * garraiatzen — hemen alderdi bakoitzak bere izena eta zenbakiak ditu, beti ikusgai.
 */
export function ResultsTable({ parties, result, indices, paint, coalition, onToggleParty }: Props) {
  const rows = [...parties]
    .map((p) => ({
      party: p,
      idx: indices.parties.find((i) => i.partyId === p.id)!,
    }))
    .sort((a, b) => b.idx.seats - a.idx.seats || b.idx.votes - a.idx.votes);

  const totalSeats = Object.values(result.totals).reduce((a, b) => a + b, 0);

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3>Emaitzak</h3>
        <span className="hint">Klikatu errenkada bat koalizioan sartzeko</span>
      </div>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Alderdia</th>
              <th className="num">Botoak</th>
              <th className="num">Boto %</th>
              <th className="num">Eserlekuak</th>
              <th className="num">Eserleku %</th>
              <th className="num" title="Eserleku % − boto %. Positiboa = ordezkaritza gehiegi.">
                Desbid.
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ party, idx }) => {
              const selected = coalition.includes(party.id);
              return (
                <tr
                  key={party.id}
                  onClick={() => onToggleParty(party.id)}
                  style={{
                    cursor: 'pointer',
                    background: selected ? 'var(--hover)' : undefined,
                    opacity: idx.seats === 0 ? 0.62 : 1,
                  }}
                >
                  <td>
                    <span className="party-cell">
                      <span
                        className="swatch"
                        style={{ background: paint[party.id]?.fill }}
                        aria-hidden
                      />
                      <span>{party.name}</span>
                      {selected && (
                        <span
                          className="badge"
                          style={{ background: 'var(--ink)', color: 'var(--surface)' }}
                        >
                          koalizioan
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="num">{formatInt(idx.votes)}</td>
                  <td className="num muted">{formatPercent(idx.votePercent)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {formatInt(idx.seats)}
                  </td>
                  <td className="num muted">{formatPercent(idx.seatPercent)}</td>
                  <td
                    className="num"
                    style={{
                      color:
                        Math.abs(idx.deviation) < 0.5
                          ? 'var(--ink-muted)'
                          : idx.deviation > 0
                            ? 'var(--good)'
                            : 'var(--critical)',
                    }}
                  >
                    {idx.deviation > 0 ? '+' : ''}
                    {formatPercent(idx.deviation)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 600 }}>Guztira</td>
              <td className="num" style={{ fontWeight: 600 }}>
                {formatInt(result.totalVotes)}
              </td>
              <td className="num muted">—</td>
              <td className="num" style={{ fontWeight: 600 }}>
                {formatInt(totalSeats)}
              </td>
              <td className="num muted">—</td>
              <td className="num muted">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
