import type { Indices } from '../core/indices';
import type { Party, PartyId } from '../core/types';
import { formatDecimal, formatInt, formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  parties: Party[];
  indices: Indices;
  paint: Record<PartyId, PartyPaint>;
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        background: 'var(--raised)',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.25 }}>{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}

/**
 * Boto% vs eserleku% barra bikoitietan. Bi neurriak ehunekoak dira, beraz ardatz BAKARRA
 * partekatzen dute — inolaz ere ez bi eskala.
 */
function VotesSeatsChart({ parties, indices, paint }: Props) {
  const rows = [...indices.parties]
    .map((idx) => ({ idx, party: parties.find((p) => p.id === idx.partyId)! }))
    .filter((r) => r.party && (r.idx.votes > 0 || r.idx.seats > 0))
    .sort((a, b) => b.idx.votePercent - a.idx.votePercent);

  const max = Math.max(10, ...rows.flatMap((r) => [r.idx.votePercent, r.idx.seatPercent]));

  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map(({ idx, party }) => (
        <div key={party.id}>
          <div className="spread" style={{ marginBottom: 3 }}>
            <span className="party-cell" style={{ fontSize: '0.82rem' }}>
              <span className="swatch" style={{ background: paint[party.id].fill }} aria-hidden />
              {party.name}
            </span>
            <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatPercent(idx.votePercent)} boto · {formatPercent(idx.seatPercent)} eserleku
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ height: 9, background: 'var(--grid)', borderRadius: '0 4px 4px 0' }}>
              <div
                style={{
                  width: `${(idx.votePercent / max) * 100}%`,
                  height: '100%',
                  background: paint[party.id].fill,
                  borderRadius: '0 4px 4px 0',
                  opacity: 0.45,
                }}
                title={`Botoak: ${formatPercent(idx.votePercent)}`}
              />
            </div>
            <div style={{ height: 9, background: 'var(--grid)', borderRadius: '0 4px 4px 0' }}>
              <div
                style={{
                  width: `${(idx.seatPercent / max) * 100}%`,
                  height: '100%',
                  background: paint[party.id].fill,
                  borderRadius: '0 4px 4px 0',
                }}
                title={`Eserlekuak: ${formatPercent(idx.seatPercent)}`}
              />
            </div>
          </div>
        </div>
      ))}
      <p className="hint" style={{ margin: 0 }}>
        Barra argia = botoen ehunekoa. Barra sendoa = eserlekuen ehunekoa. Sendoa argia baino
        luzeagoa bada, sistemak mesede egiten dio alderdi horri.
      </p>
    </div>
  );
}

export function IndicesPanel({ parties, indices, paint }: Props) {
  const gallagherHint =
    indices.gallagher < 2
      ? 'Oso proportzionala'
      : indices.gallagher < 5
        ? 'Proportzionaltasun ona'
        : indices.gallagher < 10
          ? 'Desproportzionaltasun nabarmena'
          : 'Desproportzionaltasun handia';

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Desproportzionaltasuna</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
            gap: 10,
          }}
        >
          <Tile
            label="Gallagher"
            value={formatDecimal(indices.gallagher)}
            hint={`${gallagherHint}. 0 = perfektua.`}
          />
          <Tile
            label="Loosemore-Hanby"
            value={formatDecimal(indices.loosemoreHanby)}
            hint="Desbideratze absolutuen batura zati bi."
          />
          <Tile
            label="Galdutako botoak"
            value={formatPercent(indices.wastedVotesByDistrictPercent)}
            hint={`${formatInt(indices.wastedVotesByDistrict)} boto, barrutian eserlekurik lortu ez dutenenak.`}
          />
          <Tile
            label="Alderdi eraginkorrak"
            value={`${formatDecimal(indices.enpVotes, 1)} → ${formatDecimal(indices.enpSeats, 1)}`}
            hint="Botoetan → eserlekuetan. Jaitsiera = sistemak alderdi-sistema estutzen du."
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Botoak vs eserlekuak</h3>
        <VotesSeatsChart parties={parties} indices={indices} paint={paint} />
      </div>
    </div>
  );
}
