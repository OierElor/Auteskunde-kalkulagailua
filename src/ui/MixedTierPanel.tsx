import type { ElectionResult, Party, PartyId } from '../core/types';
import { formatInt, formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  parties: Party[];
  result: ElectionResult;
  paint: Record<PartyId, PartyPaint>;
}

/**
 * Bi mailak zutabetan. Hau da sistema mistoak ULERTZEKO behar den taula:
 * barrutietan irabazitakoa + zerrenda-eserlekuak = guztizkoa.
 *
 * MMP-n `dagokiona` zutabea agertzen da, eta hor ikusten da mekanismoa: zerrenda-eserlekuak
 * dagokionaren eta irabazitakoaren arteko ALDEA dira. MMM-n zutabe hori ez da existitzen, eta
 * horregatik ez du ezer orekatzen.
 */
export function MixedTierPanel({ parties, result, paint }: Props) {
  const tier = result.listTier;
  if (!tier) return null;

  const totalOverhang = Object.values(tier.overhang).reduce((a, b) => a + b, 0);
  const grew = tier.chamberSize !== tier.nominalSize;

  const rows = [...parties].sort(
    (a, b) => (result.totals[b.id] ?? 0) - (result.totals[a.id] ?? 0),
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>{tier.compensatory ? 'MMP — konpentsatzailea' : 'MMM — paraleloa'}</h3>
          <span className="hint">
            {formatInt(tier.nominalSize)} eserleku nominal
            {grew && (
              <>
                {' → '}
                <strong style={{ color: 'var(--critical)' }}>
                  {formatInt(tier.chamberSize)} benetan
                </strong>
              </>
            )}
          </span>
        </div>

        <p className="hint" style={{ marginTop: 0 }}>
          {tier.compensatory ? (
            <>
              Alderdi bakoitzari <strong>dagokion guztizkoa</strong> proportzionalki kalkulatzen da.
              Zerrenda-eserlekuak dagokionaren eta barrutietan irabazitakoaren arteko{' '}
              <strong>aldea</strong> dira. Barrutietan asko irabazteak zerrenda-eserlekuak kentzen
              ditu.
            </>
          ) : (
            <>
              Bi mailak <strong>bereiz</strong> kalkulatzen dira eta batu egiten dira. Barrutietan
              irabazteak <strong>ez du</strong> zerrenda-eserlekurik kentzen — horregatik MMM-k ez du
              desproportzionaltasuna zuzentzen.
            </>
          )}
        </p>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Alderdia</th>
                <th className="num">Botoak %</th>
                <th className="num">Barrutiak</th>
                {tier.compensatory && <th className="num">Dagokiona</th>}
                {tier.compensatory && totalOverhang > 0 && <th className="num">Overhang</th>}
                <th className="num">Zerrenda</th>
                <th className="num">Guztira</th>
                <th className="num">Eserlekuak %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const votePercent =
                  result.totalVotes > 0
                    ? ((result.voteTotals[p.id] ?? 0) / result.totalVotes) * 100
                    : 0;
                const seatPercent =
                  result.totalSeats > 0 ? ((result.totals[p.id] ?? 0) / result.totalSeats) * 100 : 0;
                const out = tier.excluded.includes(p.id);

                return (
                  <tr key={p.id} style={{ opacity: (result.totals[p.id] ?? 0) === 0 ? 0.6 : 1 }}>
                    <td>
                      <span className="party-cell">
                        <span
                          className="swatch"
                          style={{ background: paint[p.id]?.fill }}
                          aria-hidden
                        />
                        {p.name}
                        {out && (
                          <span className="badge warn" style={{ border: '1px solid var(--border)' }}>
                            langatik kanpo
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="num muted">{formatPercent(votePercent)}</td>
                    <td className="num">{formatInt(tier.districtWins[p.id] ?? 0)}</td>

                    {tier.compensatory && (
                      <td className="num muted">{formatInt(tier.entitlement[p.id] ?? 0)}</td>
                    )}
                    {tier.compensatory && totalOverhang > 0 && (
                      <td
                        className="num"
                        style={{
                          color: (tier.overhang[p.id] ?? 0) > 0 ? 'var(--critical)' : undefined,
                          fontWeight: (tier.overhang[p.id] ?? 0) > 0 ? 700 : 400,
                        }}
                      >
                        {(tier.overhang[p.id] ?? 0) > 0 ? `+${tier.overhang[p.id]}` : '—'}
                      </td>
                    )}

                    <td className="num">{formatInt(tier.listSeats[p.id] ?? 0)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatInt(result.totals[p.id] ?? 0)}
                    </td>
                    <td
                      className="num muted"
                      title="Boto-ehunekotik hurbil egoteak esan nahi du sistema proportzionala dela"
                    >
                      {formatPercent(seatPercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tier.compensatory && totalOverhang > 0 && (
          <div className="banner alert" style={{ marginTop: 12 }}>
            <span aria-hidden>⚠</span>
            <div>
              <strong>{totalOverhang} overhang eserleku.</strong> Alderdi batek dagokiona baino
              barruti gehiago irabazi ditu. Eserlekuak ezin zaizkio kendu —barrutian irabazi
              baititu—, beraz zerbait hautsi behar da:{' '}
              {tier.levelingSeats > 0
                ? `${tier.levelingSeats} orekatze-eserleku gehitu dira proportzionaltasuna berreskuratzeko.`
                : 'ganbera hazi egin da.'}
            </div>
          </div>
        )}

        {tier.compensatory && totalOverhang === 0 && tier.chamberSize === tier.nominalSize && (
          <p className="hint" style={{ marginBottom: 0 }}>
            Overhang-ik ez: alderdi bakar batek ere ez du dagokiona baino barruti gehiago irabazi.
            Jaitsi zerrenda-eserlekuen kopurua alboko panelean eta ikusi noiz agertzen den.
          </p>
        )}
      </div>
    </div>
  );
}
