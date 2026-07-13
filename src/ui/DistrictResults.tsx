import { useState } from 'react';
import type { ElectionResult, Party, PartyId, PluralityDetail, RunoffDetail, Scenario } from '../core/types';
import { formatInt, formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  scenario: Scenario;
  result: ElectionResult;
  paint: Record<PartyId, PartyPaint>;
}

/** Barrutia "eztabaidatua" da irabazlearen aldea emandako botoen %5etik beherakoa bada. */
const CLOSE_RACE = 5;

function PartyBadge({
  id,
  parties,
  paint,
}: {
  id: PartyId | null;
  parties: Party[];
  paint: Record<PartyId, PartyPaint>;
}) {
  const party = parties.find((p) => p.id === id);
  if (!party) return <span className="muted">—</span>;
  return (
    <span className="badge" style={{ background: paint[party.id]?.fill, color: paint[party.id]?.ink }}>
      {party.abbrev}
    </span>
  );
}

/**
 * Sistema maioritarioen emaitza barrutika. Bi itzulikoan, aukeratutako barrutiaren transferentziak
 * ere erakusten dira: nondik nora joan diren botoak, eta zenbat galdu diren abstentzioan.
 */
export function DistrictResults({ scenario, result, paint }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const rows = scenario.districts.map((district) => {
    const allocation = result.districts.find((d) => d.districtId === district.id)!;
    const detail = allocation.detail as PluralityDetail | RunoffDetail;
    const cast = scenario.parties.reduce(
      (sum, p) => sum + (scenario.votes[district.id]?.[p.id] ?? 0),
      0,
    );

    const winner = detail.winner;
    const margin = detail.margin;
    const marginPercent = cast > 0 ? (margin / cast) * 100 : 0;

    return { district, detail, winner, margin, marginPercent, cast };
  });

  const wins: Record<PartyId, number> = {};
  for (const p of scenario.parties) wins[p.id] = 0;
  for (const r of rows) if (r.winner) wins[r.winner] += r.district.seats;

  const close = rows.filter((r) => r.marginPercent < CLOSE_RACE && r.winner).length;
  const isRunoff = rows[0]?.detail.kind === 'runoff';
  const selectedRow = rows.find((r) => r.district.id === selected);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3>Barrutien emaitzak</h3>
          <span className="hint">
            {close} barruti eztabaidatu ({'<'} %{CLOSE_RACE} aldea)
          </span>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[...scenario.parties]
            .sort((a, b) => wins[b.id] - wins[a.id])
            .map((p) => (
              <span
                key={p.id}
                className="row"
                style={{
                  gap: 5,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  opacity: wins[p.id] === 0 ? 0.5 : 1,
                }}
              >
                <span className="swatch" style={{ background: paint[p.id]?.fill }} aria-hidden />
                <span style={{ fontSize: '0.82rem' }}>{p.abbrev}</span>
                <span className="value">{wins[p.id]}</span>
              </span>
            ))}
        </div>

        <div className="scroll-x" style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Barrutia</th>
                <th>Irabazlea</th>
                <th className="num">Irabazlearen %</th>
                <th className="num">Aldea</th>
                {isRunoff && <th>Nola</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tight = r.marginPercent < CLOSE_RACE && r.winner;
                const percent =
                  r.detail.kind === 'plurality'
                    ? r.detail.winnerPercent
                    : r.winner && r.cast > 0
                      ? ((r.detail.secondRound[r.winner] ?? 0) /
                          Object.values(r.detail.secondRound).reduce((a, b) => a + b, 0)) *
                        100
                      : 0;

                return (
                  <tr
                    key={r.district.id}
                    onClick={() => setSelected(r.district.id === selected ? null : r.district.id)}
                    style={{
                      cursor: 'pointer',
                      background: r.district.id === selected ? 'var(--hover)' : undefined,
                    }}
                  >
                    <td>{r.district.name}</td>
                    <td>
                      <PartyBadge id={r.winner} parties={scenario.parties} paint={paint} />
                    </td>
                    <td className="num muted">{formatPercent(percent)}</td>
                    <td className="num" style={{ color: tight ? 'var(--critical)' : undefined }}>
                      {formatInt(Math.round(r.margin))}
                      <span className="muted" style={{ marginLeft: 5, fontSize: '0.75rem' }}>
                        {formatPercent(r.marginPercent)}
                      </span>
                    </td>
                    {isRunoff && (
                      <td className="muted">
                        {(r.detail as RunoffDetail).decidedInFirstRound
                          ? '1. itzulian'
                          : '2. itzulian'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="hint" style={{ marginBottom: 0 }}>
          Klikatu barruti bat xehetasunak ikusteko. Gorriz: aldea %{CLOSE_RACE}etik beherakoa da —
          barruti horiek erabakitzen dute hauteskundea.
        </p>
      </div>

      {selectedRow && selectedRow.detail.kind === 'runoff' && (
        <RunoffDetailPanel
          name={selectedRow.district.name}
          detail={selectedRow.detail}
          parties={scenario.parties}
          paint={paint}
        />
      )}

      {selectedRow && selectedRow.detail.kind === 'plurality' && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>{selectedRow.district.name}</h3>
          <table>
            <thead>
              <tr>
                <th>Alderdia</th>
                <th className="num">Botoak</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {[...scenario.parties]
                .sort(
                  (a, b) =>
                    (selectedRow.detail as PluralityDetail).votes[b.id] -
                    (selectedRow.detail as PluralityDetail).votes[a.id],
                )
                .map((p) => {
                  const v = (selectedRow.detail as PluralityDetail).votes[p.id] ?? 0;
                  const won = selectedRow.winner === p.id;
                  return (
                    <tr key={p.id} style={{ fontWeight: won ? 700 : 400 }}>
                      <td>
                        <span className="party-cell">
                          <span
                            className="swatch"
                            style={{ background: paint[p.id]?.fill }}
                            aria-hidden
                          />
                          {p.name}
                          {won && <span className="muted">irabazlea</span>}
                        </span>
                      </td>
                      <td className="num">{formatInt(v)}</td>
                      <td className="num muted">
                        {formatPercent(selectedRow.cast > 0 ? (v / selectedRow.cast) * 100 : 0)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunoffDetailPanel({
  name,
  detail,
  parties,
  paint,
}: {
  name: string;
  detail: RunoffDetail;
  parties: Party[];
  paint: Record<PartyId, PartyPaint>;
}) {
  const byId = (id: PartyId) => parties.find((p) => p.id === id);
  const secondTotal = Object.values(detail.secondRound).reduce((a, b) => a + b, 0);
  const firstTotal = Object.values(detail.firstRound).reduce((a, b) => a + b, 0);

  return (
    <div className="card stack">
      <h3>{name}</h3>

      {detail.decidedInFirstRound ? (
        <p className="hint" style={{ margin: 0 }}>
          <strong>{byId(detail.winner!)?.name}</strong> gehiengo absolutua lortu du lehen itzulian
          (%50 baino gehiago): ez da bigarren itzulirik egon.
        </p>
      ) : (
        <p className="hint" style={{ margin: 0 }}>
          Inork ez du %50 lortu. Bigarren itzulira{' '}
          <strong>{detail.qualified.map((id) => byId(id)?.abbrev).join(' eta ')}</strong> pasatu
          dira. Kanporatutakoen botoak transferentzia-matrizearen arabera banatu dira —{' '}
          <strong>hipotesi bat da, ez datu bat</strong>.
        </p>
      )}

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Alderdia</th>
              <th className="num">1. itzulia</th>
              <th className="num">%</th>
              <th className="num">2. itzulia</th>
              <th className="num">%</th>
            </tr>
          </thead>
          <tbody>
            {[...parties]
              .filter((p) => (detail.firstRound[p.id] ?? 0) > 0)
              .sort((a, b) => detail.firstRound[b.id] - detail.firstRound[a.id])
              .map((p) => {
                const out = detail.eliminated.includes(p.id);
                const won = detail.winner === p.id;
                return (
                  <tr key={p.id} style={{ opacity: out ? 0.55 : 1, fontWeight: won ? 700 : 400 }}>
                    <td>
                      <span className="party-cell">
                        <span
                          className="swatch"
                          style={{ background: paint[p.id]?.fill }}
                          aria-hidden
                        />
                        {p.name}
                        {out && <span className="muted">kanporatua</span>}
                        {won && <span className="muted">irabazlea</span>}
                      </span>
                    </td>
                    <td className="num">{formatInt(detail.firstRound[p.id])}</td>
                    <td className="num muted">
                      {formatPercent(firstTotal > 0 ? (detail.firstRound[p.id] / firstTotal) * 100 : 0)}
                    </td>
                    <td className="num">
                      {out ? (
                        <span className="muted">—</span>
                      ) : (
                        formatInt(Math.round(detail.secondRound[p.id] ?? 0))
                      )}
                    </td>
                    <td className="num muted">
                      {out
                        ? '—'
                        : formatPercent(
                            secondTotal > 0 ? ((detail.secondRound[p.id] ?? 0) / secondTotal) * 100 : 0,
                          )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {detail.transfers.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Boto-transferentziak</h3>
          <div className="stack" style={{ gap: 5 }}>
            {detail.transfers.map((t, i) => (
              <div key={i} className="row" style={{ fontSize: '0.82rem' }}>
                <span className="swatch" style={{ background: paint[t.from]?.fill }} aria-hidden />
                <span style={{ minWidth: 44 }}>{byId(t.from)?.abbrev}</span>
                <span className="muted">→</span>
                <span className="swatch" style={{ background: paint[t.to]?.fill }} aria-hidden />
                <span style={{ minWidth: 44 }}>{byId(t.to)?.abbrev}</span>
                <span className="value">{formatInt(Math.round(t.votes))}</span>
              </div>
            ))}
            <div className="row muted" style={{ fontSize: '0.82rem' }}>
              <span style={{ width: 10 }} aria-hidden />
              <span>Abstentzioan galduak</span>
              <span className="value muted">{formatInt(Math.round(detail.abstained))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
