/**
 * Hemizikloaren geometria. Funtzio purua, marrazkirik gabe: horrela proba daiteke eserleku
 * guztiak beti kokatzen direla, kopurua edozein dela ere.
 */

const OUTER = 100;
/**
 * Barruko zuloaren tamaina. Erdiko zenbaki handia hemen sartu behar da, eserlekuak ukitu gabe:
 * 0,42 txikiegia zen eta zenbakiak barruko errenkada estaltzen zuen.
 */
const INNER_RATIO = 0.48;
/** Eserlekuaren erradioa tarteari dagokionez. Gainerakoa hutsunea da: bolatxoak ez dira ukitzen. */
const SEAT_FILL = 0.42;
/**
 * Bolatxoen gehieneko erradioa. Muga hau gabe, eserleku gutxiko ganberetan bolatxo erraldoiak
 * ateratzen dira (eserleku 1: erradioa 21,8, ohiko 5,5en aldean) eta erdiko zuloa jaten dute.
 */
const MAX_SEAT_RADIUS = 12;

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

/**
 * Errenkada kopurua.
 *
 * Ez da formula arbitrario bat: errenkaden arteko tarteak (erradiala) eta errenkada bateko
 * bolatxoen arteko tarteak (arkukoa) ANTZEKOAK izan behar dute. Bestela bi errenkada bakarrik
 * dituen ganberak arku deskonektatu itxura hartzen du, erdian hutsune handi batekin.
 *
 * Eraztunaren zabalera W bada eta R errenkada badaude, tarte erradiala W/(R−1) da. Errenkada
 * bakoitzak ~r·π/tartea eserleku hartzen ditu, eta batez besteko erradioa (barrukoa+kanpokoa)/2 da.
 * Biak berdinduta: eserlekuak ≈ k·R·(R−1). Hortik R askatzen dugu.
 */
function rowCountFor(seats: number): number {
  if (seats <= 0) return 0;
  const ringWidth = OUTER * (1 - INNER_RATIO);
  const meanRadius = (OUTER * (1 + INNER_RATIO)) / 2;
  const k = (meanRadius * Math.PI) / ringWidth;
  const rows = (1 + Math.sqrt(1 + (4 * seats) / k)) / 2;
  return Math.max(1, Math.min(14, Math.round(rows)));
}

export interface HeroLayout {
  valueFontSize: number;
  valueY: number;
  labelFontSize: number;
  labelY: number;
}

/** Testuak zuloan bete dezakeen zatia. Gainerakoa tarte segurua da. */
const HERO_SAFE = 0.92;
/**
 * Etiketarik luzeena ("koalizioan"). Beti honekin neurtzen dugu, "eserleku" laburragoa izan arren:
 * bestela koalizio bat hautatzean letra-tamaina jauzi egingo luke.
 */
const WORST_LABEL_CHARS = 10;

/**
 * Testuaren gutxi gorabeherako muturreko puntua, zuloaren erdigunetik neurtuta.
 *
 * Letra-tipoen metrikak hurbilduak dira (goiera 0,72·em, karaktere-zabalera 0,58·em): SVGak ez du
 * neurketarik eskaintzen marraztu aurretik. Hurbilketa nahikoa da tarte segurua utziz gero.
 */
export function heroTextExtent(hero: HeroLayout, digits: number, labelChars: number): number {
  const valueHalfWidth = (digits * hero.valueFontSize * 0.58) / 2;
  const valueTop = hero.valueY - hero.valueFontSize * 0.72;
  const valueCorner = Math.hypot(valueHalfWidth, valueTop);

  const labelHalfWidth = (labelChars * hero.labelFontSize * 0.52) / 2;
  const labelCorner = Math.hypot(labelHalfWidth, hero.labelY);

  return Math.max(valueCorner, labelCorner);
}

/**
 * Erdiko zenbaki handiaren neurriak.
 *
 * Zergatik funtzio bat eta ez balio finko batzuk: neurriak eskuz jarrita zeuden, eta zenbakia
 * barruko eserlekuen gainera ateratzen zen. Orain espazio ERABILGARRITIK kalkulatzen dira
 * (zuloa ken bolatxoen erradioa), eta beharrezkoa bada txikitu egiten dira. Testuak beti sartzen
 * du, eraikuntzaz — eta proba batek zaintzen du.
 */
export function heroLayout(
  innerRadius: number,
  seatRadius: number,
  /**
   * Erakutsiko den zenbakiaren digitu kopurua. Ganberaren guztizkoarena pasatu behar da, ez
   * unekoarena: koalizioaren zenbakia beti da txikiagoa, beraz neurria egonkorra da eta ez du
   * jauzirik egiten alderdiak hautatzean.
   */
  digits: number,
): HeroLayout {
  const base: HeroLayout = {
    valueFontSize: innerRadius * 0.46,
    valueY: -innerRadius * 0.42,
    labelFontSize: innerRadius * 0.17,
    labelY: -innerRadius * 0.42 + innerRadius * 0.46 * 0.52,
  };

  const limit = Math.max(0, innerRadius - seatRadius) * HERO_SAFE;
  const extent = heroTextExtent(base, Math.max(1, digits), WORST_LABEL_CHARS);
  if (extent <= limit || extent === 0) return base;

  const scale = limit / extent;
  return {
    valueFontSize: base.valueFontSize * scale,
    valueY: base.valueY * scale,
    labelFontSize: base.labelFontSize * scale,
    labelY: base.labelY * scale,
  };
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
  const seatRadius = Math.min(MAX_SEAT_RADIUS, SEAT_FILL * Math.min(minChord, radialGap));

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
