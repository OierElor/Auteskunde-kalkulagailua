/**
 * Hemizikloaren geometria. Funtzio purua, marrazkirik gabe: horrela proba daiteke eserleku
 * guztiak beti kokatzen direla, kopurua edozein dela ere.
 */

const OUTER = 100;
const INNER_RATIO = 0.42;
/** Eserlekuaren erradioa tarteari dagokionez. Gainerakoa hutsunea da: bolatxoak ez dira ukitzen. */
const SEAT_FILL = 0.42;

export interface SeatPoint {
  x: number;
  y: number;
  /** Radianetan: π = ezkerra, 0 = eskuina. */
  angle: number;
  row: number;
}

export interface HemicycleLayout {
  /** EZKERRETIK ESKUINERA ordenatuta: alderdiak ardatz politikoaren arabera betetzeko prest. */
  seats: SeatPoint[];
  rows: number;
  seatRadius: number;
  outerRadius: number;
  innerRadius: number;
  viewBox: string;
}

function rowCountFor(seats: number): number {
  if (seats <= 0) return 0;
  return Math.max(1, Math.min(14, Math.round(Math.sqrt(seats / 3.2))));
}

export function layoutHemicycle(totalSeats: number): HemicycleLayout {
  const rows = rowCountFor(totalSeats);
  const innerRadius = OUTER * INNER_RATIO;

  const empty: HemicycleLayout = {
    seats: [],
    rows: 0,
    seatRadius: 0,
    outerRadius: OUTER,
    innerRadius,
    viewBox: `${-OUTER - 8} ${-OUTER - 8} ${2 * (OUTER + 8)} ${OUTER + 16}`,
  };
  if (rows === 0) return empty;

  const radii = Array.from({ length: rows }, (_, i) =>
    rows === 1 ? (OUTER + innerRadius) / 2 : innerRadius + (OUTER - innerRadius) * (i / (rows - 1)),
  );

  // Errenkada bakoitzeko eserlekuak arku-luzeraren arabera: kanpokoak gehiago hartzen ditu.
  const radiusSum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((totalSeats * r) / radiusSum)));

  // Biribiltzeak sortutako aldea zuzendu, guztizkoa zehatza izan dadin.
  let drift = counts.reduce((a, b) => a + b, 0) - totalSeats;
  while (drift !== 0) {
    const density = counts.map((c, i) => c / radii[i]);
    if (drift > 0) {
      // Errenkada estuenetik kendu (dentsitate handiena duenetik).
      let target = -1;
      for (let i = 0; i < rows; i++) {
        if (counts[i] > 1 && (target < 0 || density[i] > density[target])) target = i;
      }
      if (target < 0) break;
      counts[target] -= 1;
      drift -= 1;
    } else {
      let target = 0;
      for (let i = 1; i < rows; i++) if (density[i] < density[target]) target = i;
      counts[target] += 1;
      drift += 1;
    }
  }

  const minChord = Math.min(...radii.map((r, i) => (r * Math.PI) / counts[i]));
  const radialGap = rows === 1 ? OUTER - innerRadius : (OUTER - innerRadius) / (rows - 1);
  const seatRadius = SEAT_FILL * Math.min(minChord, radialGap);

  const seats: SeatPoint[] = [];
  for (let row = 0; row < rows; row++) {
    const n = counts[row];
    for (let j = 0; j < n; j++) {
      // Erdiko desplazamenduak (j + 0.5) eserlekuak ertzetatik urruntzen ditu.
      const angle = Math.PI - (Math.PI * (j + 0.5)) / n;
      seats.push({
        x: radii[row] * Math.cos(angle),
        y: -radii[row] * Math.sin(angle),
        angle,
        row,
      });
    }
  }

  // π-tik 0-ra = ezkerretik eskuinera. Angelu berean, barruko errenkada lehenengo: horrela
  // alderdi bakoitzak ziri (wedge) trinko bat betetzen du, ez sakabanatutako bolatxoak.
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);

  const pad = seatRadius + 4;
  return {
    seats,
    rows,
    seatRadius,
    outerRadius: OUTER,
    innerRadius,
    viewBox: `${-OUTER - pad} ${-OUTER - pad} ${2 * (OUTER + pad)} ${OUTER + 2 * pad}`,
  };
}
