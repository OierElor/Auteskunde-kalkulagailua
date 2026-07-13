import { majorityThreshold, minimalWinningCoalitions } from '../core/coalitions';
import type { Party, PartyId } from '../core/types';
import { formatInt } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  parties: Party[];
  totals: Record<PartyId, number>;
  paint: Record<PartyId, PartyPaint>;
  coalition: PartyId[];
  onToggleParty: (id: PartyId) => void;
  onClear: () => void;
  onSet: (ids: PartyId[]) => void;
}

export function CoalitionBuilder({
  parties,
  totals,
  paint,
  coalition,
  onToggleParty,
  onClear,
  onSet,
}: Props) {
  const totalSeats = parties.reduce((sum, p) => sum + (totals[p.id] ?? 0), 0);
  const majority = majorityThreshold(totalSeats);
  const seats = coalition.reduce((sum, id) => sum + (totals[id] ?? 0), 0);
  const wins = seats >= majority && totalSeats > 0;

  const options = minimalWinningCoalitions(
    totals,
    parties.map((p) => p.id),
  ).slice(0, 6);

  const byId = (id: PartyId) => parties.find((p) => p.id === id);

  return (
    <div className="card stack">
      <div className="spread">
        <h3>Koalizioa</h3>
        {coalition.length > 0 && (
          <button className="ghost" onClick={onClear}>
            Garbitu
          </button>
        )}
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {parties
          .filter((p) => (totals[p.id] ?? 0) > 0)
          .sort((a, b) => a.position - b.position)
          .map((p) => {
            const on = coalition.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onToggleParty(p.id)}
                aria-pressed={on}
                style={{
                  background: on ? paint[p.id].fill : 'var(--raised)',
                  color: on ? paint[p.id].ink : 'var(--ink-2)',
                  borderColor: on ? paint[p.id].fill : 'var(--border)',
                  fontWeight: on ? 700 : 400,
                }}
              >
                {p.abbrev} · {formatInt(totals[p.id] ?? 0)}
              </button>
            );
          })}
      </div>

      {/* Aurrerapen-barra: gehiengoaren marra da irakurtzen den gauza bakarra. */}
      <div>
        <div
          style={{
            position: 'relative',
            height: 22,
            background: 'var(--grid)',
            borderRadius: 5,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
            {coalition.map((id) => {
              const p = byId(id);
              if (!p) return null;
              return (
                <div
                  key={id}
                  title={`${p.name}: ${totals[id]}`}
                  style={{
                    width: `${totalSeats > 0 ? ((totals[id] ?? 0) / totalSeats) * 100 : 0}%`,
                    background: paint[id].fill,
                    // 2px hutsune bat zatien artean: mugak argi geratzen dira.
                    boxShadow: 'inset -2px 0 0 var(--surface)',
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              left: `${totalSeats > 0 ? (majority / totalSeats) * 100 : 50}%`,
              width: 2,
              background: 'var(--ink)',
            }}
          />
        </div>
        <div className="spread" style={{ marginTop: 6 }}>
          <span className="value" style={{ color: wins ? 'var(--good)' : 'var(--ink)' }}>
            {formatInt(seats)} / {formatInt(majority)} eserleku
          </span>
          <span className="hint">
            {coalition.length === 0
              ? 'Aukeratu alderdiak'
              : wins
                ? `Gehiengo absolutua — ${formatInt(seats - majority)} eserleku soberan`
                : `${formatInt(majority - seats)} eserleku falta`}
          </span>
        </div>
      </div>

      {options.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 6 }}>Gutxieneko koalizio irabazleak</h3>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {options.map((c) => (
              <button
                key={c.parties.join('+')}
                onClick={() => onSet(c.parties)}
                title={`${formatInt(c.seats)} eserleku`}
              >
                <span className="row" style={{ gap: 4 }}>
                  {c.parties.map((id) => (
                    <span
                      key={id}
                      className="swatch"
                      style={{ background: paint[id]?.fill }}
                      aria-hidden
                    />
                  ))}
                  <span>{c.parties.map((id) => byId(id)?.abbrev ?? id).join(' + ')}</span>
                  <span className="muted">{formatInt(c.seats)}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>
            Kide guztiak ezinbestekoak diren koalizioak: bat kenduta, gehiengoa galtzen da.
          </p>
        </div>
      )}
    </div>
  );
}
