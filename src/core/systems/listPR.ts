import { allocate } from '../allocate';
import {
  districtValidVotes,
  eligibleParties,
  excludedParties,
  partyVotes,
} from '../threshold';
import type {
  DistrictAllocation,
  ElectionResult,
  MethodId,
  PartyId,
  Scenario,
  ThresholdConfig,
  Warning,
} from '../types';

export interface ListPROptions {
  method: MethodId;
  threshold: ThresholdConfig;
}

/**
 * Zerrenda itxiko sistema proportzionala, barruti anitzekoa.
 *
 * Barruti bakoitza bere aldetik ebazten da — hori da gakoa, eta hori da Espainiako/Euskadiko
 * sistemaren desproportzionaltasunaren iturri nagusia: 25 eserlekuko barruti batean D'Hondt-ek
 * askoz gogorrago zigortzen ditu alderdi txikiak 75 eserlekuko barruti bakar batean baino.
 */
export function runListPR(scenario: Scenario, opts: ListPROptions): ElectionResult {
  const allParties = scenario.parties.map((p) => p.id);
  const seatsByDistrict: Record<string, Record<PartyId, number>> = {};
  const districts: DistrictAllocation[] = [];
  const warnings: Warning[] = [];

  for (const district of scenario.districts) {
    const eligible = eligibleParties(scenario, district.id, opts.threshold);
    const excluded = excludedParties(scenario, district.id, opts.threshold);

    // Langa gainditu dutenen botoak baino ez dira esleipenean sartzen: kanpoan geratutakoen
    // botoak alferrik galtzen dira (eta kuota-metodoetan kuota ere ez dute puzten).
    const eligibleVotes: Record<PartyId, number> = {};
    for (const p of eligible) eligibleVotes[p] = partyVotes(scenario, district.id, p);

    const outcome = allocate(eligibleVotes, district.seats, opts.method, eligible);

    // Alderdi guztiak agertu behar dira, 0rekin bada ere: horrela UI-ak ez du hutsunerik aurkituko.
    const seats: Record<PartyId, number> = {};
    for (const p of allParties) seats[p] = outcome.seats[p] ?? 0;

    seatsByDistrict[district.id] = seats;
    districts.push({
      districtId: district.id,
      seats,
      excluded,
      detail: outcome.detail,
      warnings: outcome.warnings,
    });

    for (const w of outcome.warnings) {
      warnings.push({ ...w, message: `${district.name}: ${w.message}` });
    }
  }

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
