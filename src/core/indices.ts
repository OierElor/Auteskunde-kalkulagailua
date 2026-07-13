import type { ElectionResult, PartyId, Scenario } from './types';

export interface PartyIndex {
  partyId: PartyId;
  votes: number;
  votePercent: number;
  seats: number;
  seatPercent: number;
  /** eserleku% / boto%. 1 baino handiagoa = sistemak mesede egiten dio. */
  advantage: number | null;
  /** eserleku% − boto%. Positiboa = ordezkaritza gehiegi. */
  deviation: number;
}

export interface Indices {
  /** Gallagher (LSq): desproportzionaltasunaren neurri estandarra. 0 = perfektua; >5 = altua. */
  gallagher: number;
  /** Loosemore-Hanby: desbideratze absolutuen batura zati bi. */
  loosemoreHanby: number;
  /** Alderdi eraginkorren kopurua (Laakso-Taagepera), botoetan eta eserlekuetan. */
  enpVotes: number;
  enpSeats: number;
  /** Eserlekurik lortu ez duten alderdien botoak (estatu mailan). */
  wastedVotes: number;
  wastedVotesPercent: number;
  /**
   * Barruti bakoitzean eserlekurik lortu ez dutenen botoak. Beti handiagoa da aurrekoa baino, eta
   * hau da barruti txikien benetako kostua erakusten duen zenbakia.
   */
  wastedVotesByDistrict: number;
  wastedVotesByDistrictPercent: number;
  parties: PartyIndex[];
}

/**
 * Proportzionaltasun-indizeak. Oinarria alderdiei emandako botoak dira (boto zuriak kanpo), hori
 * baita Gallagher indizearen definizio estandarra.
 */
export function computeIndices(scenario: Scenario, result: ElectionResult): Indices {
  const totalVotes = result.totalVotes;
  const totalSeats = Object.values(result.totals).reduce((a, b) => a + b, 0);

  const parties: PartyIndex[] = scenario.parties.map((p) => {
    const votes = result.voteTotals[p.id] ?? 0;
    const seats = result.totals[p.id] ?? 0;
    const votePercent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
    const seatPercent = totalSeats > 0 ? (seats / totalSeats) * 100 : 0;
    return {
      partyId: p.id,
      votes,
      seats,
      votePercent,
      seatPercent,
      advantage: votePercent > 0 ? seatPercent / votePercent : null,
      deviation: seatPercent - votePercent,
    };
  });

  const sumSquares = parties.reduce((sum, p) => sum + Math.pow(p.seatPercent - p.votePercent, 2), 0);
  const sumAbs = parties.reduce((sum, p) => sum + Math.abs(p.seatPercent - p.votePercent), 0);

  const enp = (shares: number[]) => {
    const sum = shares.reduce((a, b) => a + b * b, 0);
    return sum > 0 ? 1 / sum : 0;
  };

  const wastedVotes = parties.filter((p) => p.seats === 0).reduce((sum, p) => sum + p.votes, 0);

  let wastedByDistrict = 0;
  for (const district of scenario.districts) {
    const seats = result.seatsByDistrict[district.id] ?? {};
    for (const p of scenario.parties) {
      if ((seats[p.id] ?? 0) === 0) {
        wastedByDistrict += scenario.votes[district.id]?.[p.id] ?? 0;
      }
    }
  }

  return {
    gallagher: Math.sqrt(0.5 * sumSquares),
    loosemoreHanby: 0.5 * sumAbs,
    enpVotes: enp(parties.map((p) => p.votePercent / 100)),
    enpSeats: enp(parties.map((p) => p.seatPercent / 100)),
    wastedVotes,
    wastedVotesPercent: totalVotes > 0 ? (wastedVotes / totalVotes) * 100 : 0,
    wastedVotesByDistrict: wastedByDistrict,
    wastedVotesByDistrictPercent: totalVotes > 0 ? (wastedByDistrict / totalVotes) * 100 : 0,
    parties,
  };
}
