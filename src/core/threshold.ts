import type { DistrictId, PartyId, Scenario, ThresholdConfig } from './types';

/**
 * Barruti bateko boto baliodunak.
 *
 * `includeBlank` aktibo dagoenean boto zuriak izendatzailean sartzen dira. Ez da xehetasun hutsala:
 * Espainiako eta Euskadiko legean boto zuriak boto baliodunak dira, eta horrek langa altxatzen du
 * alderdi txikientzat, boto bakar bat ere jaso ez arren.
 */
export function districtValidVotes(
  scenario: Scenario,
  districtId: DistrictId,
  includeBlank: boolean,
): number {
  const row = scenario.votes[districtId] ?? {};
  const partyVotes = scenario.parties.reduce((sum, p) => sum + (row[p.id] ?? 0), 0);
  const blank = includeBlank ? (scenario.blankVotes[districtId] ?? 0) : 0;
  return partyVotes + blank;
}

export function nationalValidVotes(scenario: Scenario, includeBlank: boolean): number {
  return scenario.districts.reduce(
    (sum, d) => sum + districtValidVotes(scenario, d.id, includeBlank),
    0,
  );
}

/** Barruti batean alderdi batek jasotako botoak. */
export function partyVotes(scenario: Scenario, districtId: DistrictId, partyId: PartyId): number {
  return scenario.votes[districtId]?.[partyId] ?? 0;
}

/** Alderdi batek barruti guztietan jasotako botoak. */
export function partyVotesTotal(scenario: Scenario, partyId: PartyId): number {
  return scenario.districts.reduce((sum, d) => sum + partyVotes(scenario, d.id, partyId), 0);
}

/**
 * Barruti batean zein alderdik gainditzen duten langa.
 *
 * `scope: 'district'` denean barrutiaren langa propioa (baldin badu) lehenesten da; bestela globala.
 * `scope: 'national'` denean langa bakarra aplikatzen da estatu mailako botoen gainean, eta
 * barrutiko gainidazketak ez du eraginik.
 */
export function eligibleParties(
  scenario: Scenario,
  districtId: DistrictId,
  cfg: ThresholdConfig,
): PartyId[] {
  return scenario.parties
    .filter((p) => partyVotes(scenario, districtId, p.id) > 0)
    .filter((p) => passesThreshold(scenario, districtId, p.id, cfg))
    .map((p) => p.id);
}

/** Barruti batean langak kanpoan utzitako alderdiak (botoak jaso dituztenak, baina nahikoa ez). */
export function excludedParties(
  scenario: Scenario,
  districtId: DistrictId,
  cfg: ThresholdConfig,
): PartyId[] {
  return scenario.parties
    .filter((p) => partyVotes(scenario, districtId, p.id) > 0)
    .filter((p) => !passesThreshold(scenario, districtId, p.id, cfg))
    .map((p) => p.id);
}

export function passesThreshold(
  scenario: Scenario,
  districtId: DistrictId,
  partyId: PartyId,
  cfg: ThresholdConfig,
): boolean {
  const percent = effectiveThreshold(scenario, districtId, cfg);
  if (percent <= 0) return true;

  if (cfg.scope === 'national') {
    const total = nationalValidVotes(scenario, cfg.includeBlank);
    if (total <= 0) return false;
    return (partyVotesTotal(scenario, partyId) / total) * 100 >= percent;
  }

  const total = districtValidVotes(scenario, districtId, cfg.includeBlank);
  if (total <= 0) return false;
  return (partyVotes(scenario, districtId, partyId) / total) * 100 >= percent;
}

/** Barruti honi benetan aplikatzen zaion langa (ehunekotan). */
export function effectiveThreshold(
  scenario: Scenario,
  districtId: DistrictId,
  cfg: ThresholdConfig,
): number {
  if (cfg.scope === 'national') return cfg.percent;
  const district = scenario.districts.find((d) => d.id === districtId);
  const override = district?.threshold;
  return override === null || override === undefined ? cfg.percent : override;
}
