import type { PartyId } from './types';

/** Gehiengo absolutua: eserlekuen erdia + 1. */
export function majorityThreshold(totalSeats: number): number {
  return Math.floor(totalSeats / 2) + 1;
}

export function coalitionSeats(parties: PartyId[], totals: Record<PartyId, number>): number {
  return parties.reduce((sum, p) => sum + (totals[p] ?? 0), 0);
}

export interface Coalition {
  parties: PartyId[];
  seats: number;
}

/** Alderdi gehiegi badaude, azpimultzo guztiak zerrendatzea garestiegia da. */
export const MAX_PARTIES_FOR_ENUMERATION = 18;

/**
 * Gutxieneko koalizio irabazleak: gehiengoa lortzen dutenak, baina kide bat kenduz gero galtzen
 * dutenak. "Sobera dagoen" alderdirik ez duten koalizioak dira — hau da politikoki interesatzen dena.
 *
 * Emaitza tamainaren arabera ordenatuta dator (kide gutxien dituztenak lehenengo), eta tamaina
 * berekoen artean eserleku gehien dituztenak lehenengo.
 */
export function minimalWinningCoalitions(
  totals: Record<PartyId, number>,
  partyOrder: PartyId[],
): Coalition[] {
  const withSeats = partyOrder.filter((p) => (totals[p] ?? 0) > 0);
  if (withSeats.length === 0 || withSeats.length > MAX_PARTIES_FOR_ENUMERATION) return [];

  const totalSeats = coalitionSeats(withSeats, totals);
  const majority = majorityThreshold(totalSeats);
  const n = withSeats.length;
  const out: Coalition[] = [];

  for (let mask = 1; mask < 1 << n; mask++) {
    let seats = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) seats += totals[withSeats[i]] ?? 0;
    }
    if (seats < majority) continue;

    // Minimoa da kide bakoitza ezinbestekoa bada.
    let minimal = true;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) && seats - (totals[withSeats[i]] ?? 0) >= majority) {
        minimal = false;
        break;
      }
    }
    if (!minimal) continue;

    out.push({
      parties: withSeats.filter((_, i) => mask & (1 << i)),
      seats,
    });
  }

  return out.sort((a, b) => a.parties.length - b.parties.length || b.seats - a.seats);
}
