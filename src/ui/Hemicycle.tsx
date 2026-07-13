import { useMemo, useState } from 'react';
import { heroLayout, layoutHemicycle } from '../core/hemicycle';
import { majorityThreshold } from '../core/coalitions';
import type { Party, PartyId } from '../core/types';
import { formatInt } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  parties: Party[];
  totals: Record<PartyId, number>;
  paint: Record<PartyId, PartyPaint>;
  coalition: PartyId[];
  onToggleParty: (id: PartyId) => void;
}

export function Hemicycle({ parties, totals, paint, coalition, onToggleParty }: Props) {
  const [hovered, setHovered] = useState<PartyId | null>(null);

  const totalSeats = parties.reduce((sum, p) => sum + (totals[p.id] ?? 0), 0);
  const majority = majorityThreshold(totalSeats);

  const layout = useMemo(() => layoutHemicycle(totalSeats), [totalSeats]);
  // Digituak GUZTIZKOTIK: koalizioaren zenbakia beti txikiagoa da, beraz tamaina egonkor mantentzen
  // da alderdiak hautatzean.
  const hero = useMemo(
    () => heroLayout(layout.innerRadius, layout.seatRadius, String(totalSeats).length),
    [layout.innerRadius, layout.seatRadius, totalSeats],
  );

  /** Eserlekuak ezkerretik eskuinera betetzen dira, alderdiak ardatz politikoan ordenatuta. */
  const seated = useMemo(() => {
    const ordered = [...parties]
      .filter((p) => (totals[p.id] ?? 0) > 0)
      .sort((a, b) => a.position - b.position);

    return layout.seats.map((seat, i) => {
      let cursor = 0;
      for (const party of ordered) {
        cursor += totals[party.id] ?? 0;
        if (i < cursor) return { seat, party };
      }
      return { seat, party: ordered[ordered.length - 1] };
    });
  }, [layout, parties, totals]);

  if (totalSeats === 0) {
    return (
      <div className="card">
        <p className="hint">Ez dago eserlekurik banatzeko. Gehitu barruti bat edo botoak.</p>
      </div>
    );
  }

  const coalitionSeats = coalition.reduce((sum, id) => sum + (totals[id] ?? 0), 0);
  const dimming = coalition.length > 0;

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 4 }}>
        <h3>Eserlekuen banaketa</h3>
        <span className="hint">
          {formatInt(totalSeats)} eserleku · gehiengo absolutua {formatInt(majority)}
        </span>
      </div>

      <svg
        viewBox={layout.viewBox}
        style={{ width: '100%', height: 'auto', maxHeight: 380, display: 'block' }}
        role="img"
        aria-label={`Hemizikloa, ${totalSeats} eserleku. ${parties
          .filter((p) => (totals[p.id] ?? 0) > 0)
          .map((p) => `${p.name}: ${totals[p.id]}`)
          .join('. ')}`}
      >
        {/* Erdiko marra: gehiengo absolutuaren muga. Ezkerreko blokeak hau gurutzatu behar du. */}
        <line
          x1={0}
          y1={-layout.innerRadius + 4}
          x2={0}
          y2={-layout.outerRadius - layout.seatRadius - 3}
          stroke="var(--axis)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {seated.map(({ seat, party }, i) => {
          if (!party) return null;
          const inCoalition = coalition.includes(party.id);
          const isHovered = hovered === party.id;
          const dim = dimming && !inCoalition;

          return (
            <circle
              key={i}
              cx={seat.x}
              cy={seat.y}
              r={layout.seatRadius * (isHovered ? 1.12 : 1)}
              fill={paint[party.id]?.fill ?? '#888'}
              opacity={dim ? 0.18 : 1}
              stroke={isHovered || inCoalition ? 'var(--ink)' : 'none'}
              strokeWidth={isHovered || inCoalition ? 1.2 : 0}
              style={{ cursor: 'pointer', transition: 'opacity .12s, r .12s' }}
              onMouseEnter={() => setHovered(party.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onToggleParty(party.id)}
            >
              <title>
                {party.name} — {formatInt(totals[party.id] ?? 0)} eserleku
              </title>
            </circle>
          );
        })}

        {/* Neurriak zuloaren espazio erabilgarritik datoz: bestela zenbakia eserlekuen gainera
            ateratzen da. Etiketa laburra da nahita — luzeagoa behean doa, HTMLan. */}
        <text
          x={0}
          y={hero.valueY}
          textAnchor="middle"
          fill="var(--ink)"
          style={{ fontSize: hero.valueFontSize, fontWeight: 700 }}
        >
          {formatInt(dimming ? coalitionSeats : totalSeats)}
        </text>
        <text
          x={0}
          y={hero.labelY}
          textAnchor="middle"
          fill="var(--ink-muted)"
          style={{ fontSize: hero.labelFontSize }}
        >
          {dimming ? 'koalizioan' : 'eserleku'}
        </text>
      </svg>

      <p className="hint" style={{ marginTop: 2, marginBottom: 0 }}>
        Klikatu eserleku bat alderdia koalizioan sartu edo kentzeko. Marra etenak gehiengo
        absolutuaren muga adierazten du.
      </p>
    </div>
  );
}
