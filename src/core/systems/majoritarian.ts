import { buildTransferMatrix, distributeVotes } from '../transfers';
import type { TransferConfig } from '../transfers';
import { districtValidVotes, partyVotes } from '../threshold';
import type {
  DistrictAllocation,
  ElectionResult,
  PartyId,
  PluralityDetail,
  RunoffDetail,
  Scenario,
  TransferFlow,
  Warning,
} from '../types';

/**
 * Sistema maioritarioak: FPTP eta bi itzuli.
 *
 * Bi ohar garrantzitsu:
 *
 * 1. LANGAK EZ DU ZENTZURIK hemen, eta ez da aplikatzen. Boto gehien dituenak irabazten du,
 *    %2rekin bada ere. Sistema maioritarioek ez dute langarik: barrutia bera da langa.
 *
 * 2. Barruti batek eserleku BAT baino gehiago badu, irabazleak DENAK hartzen ditu ("general
 *    ticket"). Hori benetako sistema bat da (AEBetako hauteskunde-kolegioa, adibidez), baina ez da
 *    FPTP: FPTP barruti uninominaletarako da. Abisu bat ematen dugu, isilean ez dezan engaina.
 */

/** Berdinketak modu deterministan hausten dira: boto gehien, gero alderdi-zerrendako ordena. */
function pickWinner(
  votes: Record<PartyId, number>,
  parties: PartyId[],
): { winner: PartyId | null; runnerUp: PartyId | null; tied: PartyId[] } {
  const ranked = parties
    .filter((p) => (votes[p] ?? 0) > 0)
    .sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0) || parties.indexOf(a) - parties.indexOf(b));

  if (ranked.length === 0) return { winner: null, runnerUp: null, tied: [] };

  const top = votes[ranked[0]] ?? 0;
  const tied = ranked.filter((p) => (votes[p] ?? 0) === top);
  return { winner: ranked[0], runnerUp: ranked[1] ?? null, tied: tied.length > 1 ? tied : [] };
}

function generalTicketWarning(districtName: string, seats: number): Warning {
  return {
    kind: 'general-ticket',
    message: `${districtName}: ${seats} eserleku ditu, baina sistema maioritarioa uninominala da. Irabazleak eserleku guztiak hartzen ditu ("general ticket"). Emaitza esanguratsua nahi baduzu, erabili eserleku bakarreko barrutiak.`,
  };
}

function assemble(
  scenario: Scenario,
  districts: DistrictAllocation[],
  warnings: Warning[],
): ElectionResult {
  const allParties = scenario.parties.map((p) => p.id);
  const seatsByDistrict: Record<string, Record<PartyId, number>> = {};
  for (const d of districts) seatsByDistrict[d.districtId] = d.seats;

  const totals: Record<PartyId, number> = {};
  const voteTotals: Record<PartyId, number> = {};
  for (const p of allParties) {
    totals[p] = scenario.districts.reduce((sum, d) => sum + (seatsByDistrict[d.id]?.[p] ?? 0), 0);
    voteTotals[p] = scenario.districts.reduce((sum, d) => sum + partyVotes(scenario, d.id, p), 0);
  }

  return {
    seatsByDistrict,
    totals,
    voteTotals,
    totalSeats: scenario.districts.reduce((sum, d) => sum + d.seats, 0),
    totalVotes: Object.values(voteTotals).reduce((a, b) => a + b, 0),
    totalValidVotes: scenario.districts.reduce(
      (sum, d) => sum + districtValidVotes(scenario, d.id, true),
      0,
    ),
    districts,
    warnings,
  };
}

export function runFPTP(scenario: Scenario): ElectionResult {
  const allParties = scenario.parties.map((p) => p.id);
  const districts: DistrictAllocation[] = [];
  const warnings: Warning[] = [];

  for (const district of scenario.districts) {
    const votes: Record<PartyId, number> = {};
    for (const p of allParties) votes[p] = partyVotes(scenario, district.id, p);
    const cast = Object.values(votes).reduce((a, b) => a + b, 0);

    const { winner, runnerUp, tied } = pickWinner(votes, allParties);
    const local: Warning[] = [];

    if (district.seats > 1) local.push(generalTicketWarning(district.name, district.seats));
    if (!winner) {
      local.push({
        kind: 'unfilled-seats',
        message: `${district.name}: botorik ez, eserlekuak bete gabe.`,
      });
    }
    if (tied.length > 1) {
      local.push({
        kind: 'tie',
        message: `${district.name}: berdinketa lehen postuan (${tied.join(', ')}). Legeak zozketa eskatuko luke.`,
      });
    }

    const seats: Record<PartyId, number> = {};
    for (const p of allParties) seats[p] = 0;
    if (winner) seats[winner] = district.seats;

    const detail: PluralityDetail = {
      kind: 'plurality',
      winner,
      votes,
      margin: winner ? (votes[winner] ?? 0) - (runnerUp ? (votes[runnerUp] ?? 0) : 0) : 0,
      winnerPercent: winner && cast > 0 ? ((votes[winner] ?? 0) / cast) * 100 : 0,
    };

    districts.push({ districtId: district.id, seats, excluded: [], detail, warnings: local });
    warnings.push(...local);
  }

  return assemble(scenario, districts, warnings);
}

export interface RunoffOptions {
  /** 'top-two' = bi onenak. 'qualify' = ehuneko bat gainditzen duten guztiak (Frantziako eredua). */
  rule: 'top-two' | 'qualify';
  /** 'qualify' erregelarako: emandako boto baliodunen zein ehuneko behar den. */
  qualifyPercent: number;
  transfers: TransferConfig;
}

export function runTwoRound(scenario: Scenario, opts: RunoffOptions): ElectionResult {
  const allParties = scenario.parties.map((p) => p.id);
  const matrix = buildTransferMatrix(scenario.parties, opts.transfers);
  const districts: DistrictAllocation[] = [];
  const warnings: Warning[] = [];

  for (const district of scenario.districts) {
    const firstRound: Record<PartyId, number> = {};
    for (const p of allParties) firstRound[p] = partyVotes(scenario, district.id, p);
    const cast = Object.values(firstRound).reduce((a, b) => a + b, 0);

    const local: Warning[] = [];
    if (district.seats > 1) local.push(generalTicketWarning(district.name, district.seats));

    const ranked = allParties
      .filter((p) => firstRound[p] > 0)
      .sort((a, b) => firstRound[b] - firstRound[a] || allParties.indexOf(a) - allParties.indexOf(b));

    let detail: RunoffDetail;

    if (ranked.length === 0) {
      local.push({
        kind: 'unfilled-seats',
        message: `${district.name}: botorik ez, eserlekuak bete gabe.`,
      });
      detail = {
        kind: 'runoff',
        decidedInFirstRound: false,
        firstRound,
        qualified: [],
        eliminated: [],
        secondRound: {},
        transfers: [],
        abstained: 0,
        winner: null,
        margin: 0,
      };
    } else if (cast > 0 && firstRound[ranked[0]] / cast > 0.5) {
      // Gehiengo absolutua lehen itzulian: ez dago bigarrenik.
      detail = {
        kind: 'runoff',
        decidedInFirstRound: true,
        firstRound,
        qualified: [ranked[0]],
        eliminated: ranked.slice(1),
        secondRound: { [ranked[0]]: firstRound[ranked[0]] },
        transfers: [],
        abstained: 0,
        winner: ranked[0],
        margin: firstRound[ranked[0]] - (ranked[1] ? firstRound[ranked[1]] : 0),
      };
    } else {
      let qualified: PartyId[];
      if (opts.rule === 'qualify') {
        qualified = ranked.filter((p) => cast > 0 && (firstRound[p] / cast) * 100 >= opts.qualifyPercent);
        // Frantziako legeak ere bi bermatzen ditu: inork ez badu ehunekoa lortzen, bi onenak pasatzen dira.
        if (qualified.length < 2) qualified = ranked.slice(0, 2);
      } else {
        qualified = ranked.slice(0, 2);
      }

      const eliminated = ranked.filter((p) => !qualified.includes(p));

      const secondRound: Record<PartyId, number> = {};
      for (const p of qualified) secondRound[p] = firstRound[p];

      const transfers: TransferFlow[] = [];
      let abstained = 0;

      for (const from of eliminated) {
        const { flows, abstained: lost } = distributeVotes(
          from,
          firstRound[from],
          qualified,
          matrix,
        );
        abstained += lost;
        for (const flow of flows) {
          secondRound[flow.to] = (secondRound[flow.to] ?? 0) + flow.votes;
          transfers.push({ from, to: flow.to, votes: flow.votes });
        }
      }

      const second = pickWinner(secondRound, qualified);
      if (second.tied.length > 1) {
        local.push({
          kind: 'tie',
          message: `${district.name}: berdinketa bigarren itzulian (${second.tied.join(', ')}).`,
        });
      }

      detail = {
        kind: 'runoff',
        decidedInFirstRound: false,
        firstRound,
        qualified,
        eliminated,
        secondRound,
        transfers,
        abstained,
        winner: second.winner,
        margin: second.winner
          ? (secondRound[second.winner] ?? 0) -
            (second.runnerUp ? (secondRound[second.runnerUp] ?? 0) : 0)
          : 0,
      };
    }

    const seats: Record<PartyId, number> = {};
    for (const p of allParties) seats[p] = 0;
    if (detail.winner) seats[detail.winner] = district.seats;

    districts.push({ districtId: district.id, seats, excluded: [], detail, warnings: local });
    warnings.push(...local);
  }

  return assemble(scenario, districts, warnings);
}
