import { allocate } from '../allocate';
import { assemble, pluralityDistricts } from './majoritarian';
import type {
  AllocationDetail,
  ElectionResult,
  ListTierResult,
  MethodId,
  PartyId,
  Scenario,
  ThresholdConfig,
  VoteMatrix,
  Warning,
} from '../types';

/**
 * SISTEMA MISTOAK: bi maila.
 *
 *   Maila nominala  → barruti uninominalak, pluralitatez (FPTP).
 *   Zerrenda-maila  → eserleku-poltsa nazional bat, proportzionalki banatua.
 *
 * Bien arteko LOTURA da dena erabakitzen duena:
 *
 *   MMM (paraleloa, Japonia): loturarik EZ. Bi mailak bereiz kalkulatu eta batu. Barrutietan
 *   irabazteak ez du zerrenda-eserlekurik kentzen → sistema desproportzionala izaten jarraitzen du.
 *
 *   MMP (konpentsatzailea, Alemania/Zeelanda Berria): zerrenda-eserlekuek OREKATU egiten dute.
 *   Alderdi bakoitzari proportzionalki dagokion guztizkoa kalkulatzen da, eta zerrenda-eserlekuak
 *   guztizko horren eta barrutietan irabazitakoaren arteko ALDEA dira. Barrutietan asko irabazteak
 *   zerrenda-eserlekuak kentzen ditu → emaitza proportzionala da.
 *
 * OVERHANG: alderdi batek dagokiona baino barruti GEHIAGO irabazten dituenean. Eserlekuak ezin
 * zaizkio kendu (barrutian irabazi ditu), beraz zerbait hautsi behar da. Hiru irtenbide, hirurak
 * benetakoak — ikus `OverhangRule`.
 */

export type OverhangRule = 'keep' | 'leveling' | 'fixed';

export interface MixedOptions {
  /** false = MMM (paraleloa), true = MMP (konpentsatzailea). */
  compensatory: boolean;
  /** Zerrenda-mailako eserleku kopurua. */
  listSeats: number;
  method: MethodId;
  threshold: ThresholdConfig;
  overhang: OverhangRule;
  /** Zerrenda-mailan zein boto erabili. */
  ballot: 'same' | 'second';
}

/** Ganbera ez dadin mugagabe hazi kasu patologikoetan. */
const MAX_CHAMBER_GROWTH = 4;

function listVoteMatrix(scenario: Scenario, ballot: MixedOptions['ballot']): VoteMatrix {
  return ballot === 'second' && scenario.secondVotes ? scenario.secondVotes : scenario.votes;
}

/** Alderdi bakoitzaren boto guztiak matrize batean. */
function nationalVotes(scenario: Scenario, matrix: VoteMatrix): Record<PartyId, number> {
  const out: Record<PartyId, number> = {};
  for (const p of scenario.parties) {
    out[p.id] = scenario.districts.reduce((sum, d) => sum + (matrix[d.id]?.[p.id] ?? 0), 0);
  }
  return out;
}

/**
 * Zerrenda-mailako langa BETI nazionala da: poltsa nazional bat banatzen ari gara, eta ez du
 * zentzurik barrutiz barruti aplikatzeak. Alemaniako %5a horrelakoa da.
 */
function listEligibleParties(
  scenario: Scenario,
  votes: Record<PartyId, number>,
  threshold: ThresholdConfig,
): { eligible: PartyId[]; excluded: PartyId[] } {
  const partyTotal = Object.values(votes).reduce((a, b) => a + b, 0);
  const blanks = threshold.includeBlank
    ? scenario.districts.reduce((sum, d) => sum + (scenario.blankVotes[d.id] ?? 0), 0)
    : 0;
  const denominator = partyTotal + blanks;

  const eligible: PartyId[] = [];
  const excluded: PartyId[] = [];

  for (const p of scenario.parties) {
    if ((votes[p.id] ?? 0) <= 0) continue;
    const share = denominator > 0 ? ((votes[p.id] ?? 0) / denominator) * 100 : 0;
    if (threshold.percent <= 0 || share >= threshold.percent) eligible.push(p.id);
    else excluded.push(p.id);
  }

  return { eligible, excluded };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function runMixed(scenario: Scenario, opts: MixedOptions): ElectionResult {
  const allParties = scenario.parties.map((p) => p.id);
  const nominal = pluralityDistricts(scenario);
  const warnings: Warning[] = [...nominal.warnings];

  // 1. maila: barrutietan irabazitakoa.
  const districtWins: Record<PartyId, number> = {};
  for (const p of allParties) {
    districtWins[p] = nominal.districts.reduce((s, d) => s + (d.seats[p] ?? 0), 0);
  }
  const districtSeats = scenario.districts.reduce((s, d) => s + d.seats, 0);

  const matrix = listVoteMatrix(scenario, opts.ballot);
  if (opts.ballot === 'second' && !scenario.secondVotes) {
    warnings.push({
      kind: 'no-second-vote',
      message:
        'Bigarren boto bereizirik ez dago: lehen botoa erabili da zerrenda-mailan ere. Sortu bigarren botoa Datuak fitxan.',
    });
  }

  const votes = nationalVotes(scenario, matrix);
  const { eligible, excluded } = listEligibleParties(scenario, votes, opts.threshold);
  const eligibleVotes: Record<PartyId, number> = {};
  for (const p of eligible) eligibleVotes[p] = votes[p];

  const listSeats: Record<PartyId, number> = {};
  const entitlement: Record<PartyId, number> = {};
  const overhang: Record<PartyId, number> = {};
  for (const p of allParties) {
    listSeats[p] = 0;
    entitlement[p] = 0;
    overhang[p] = 0;
  }

  const nominalSize = districtSeats + opts.listSeats;
  let chamberSize = nominalSize;
  let levelingSeats = 0;
  let detail: AllocationDetail;

  if (!opts.compensatory) {
    // --- MMM: bi mailak bereiz. Zerrenda-poltsa proportzionalki banatzen da, barrutietan
    // irabazitakoa kontuan hartu GABE. Horregatik ez du desproportzionaltasuna zuzentzen.
    const outcome = allocate(eligibleVotes, opts.listSeats, opts.method, eligible);
    for (const p of eligible) listSeats[p] = outcome.seats[p] ?? 0;
    detail = outcome.detail;
    warnings.push(...outcome.warnings);
  } else {
    // --- MMP: zerrenda-eserlekuek orekatzen dute.
    //
    // Langa gainditu ez duten alderdiek barrutietan irabazitakoa MANTENTZEN dute (barrutian
    // irabazi dute; ezin zaie kendu), baina ez dute zerrenda-eserlekurik. Beren eserlekuak
    // poltsatik kentzen dira.
    const reserved = sum(excluded.map((p) => districtWins[p]));

    /** Poltsan dauden alderdien artean `seats` banatu. */
    const entitlementFor = (seats: number, pool: PartyId[]) => {
      const poolVotes: Record<PartyId, number> = {};
      for (const p of pool) poolVotes[p] = votes[p];
      return allocate(poolVotes, Math.max(0, seats), opts.method, pool);
    };

    if (opts.overhang === 'leveling') {
      // AUSGLEICHSMANDATE: ganbera handitzen dugu alderdi BAKAR batek ere dagokiona baino
      // barruti gehiago izan ez arte. Proportzionaltasuna erabatekoa da; prezioa ganbera haztea.
      const limit = nominalSize * MAX_CHAMBER_GROWTH;
      let size = nominalSize;
      let outcome = entitlementFor(size - reserved, eligible);

      while (
        size < limit &&
        eligible.some((p) => districtWins[p] > (outcome.seats[p] ?? 0))
      ) {
        size += 1;
        outcome = entitlementFor(size - reserved, eligible);
      }

      chamberSize = size;
      levelingSeats = size - nominalSize;
      for (const p of eligible) {
        entitlement[p] = outcome.seats[p] ?? 0;
        listSeats[p] = Math.max(0, entitlement[p] - districtWins[p]);
      }
      detail = outcome.detail;
      warnings.push(...outcome.warnings);

      if (levelingSeats > 0) {
        warnings.push({
          kind: 'overhang',
          message: `Proportzionaltasuna berreskuratzeko ${levelingSeats} orekatze-eserleku gehitu dira: ganbera ${nominalSize}etik ${size}era hazi da.`,
        });
      }
    } else if (opts.overhang === 'keep') {
      // Overhang-a mantendu: soberakina duenak eserlekuak gordetzen ditu eta ganbera hazi egiten da.
      const outcome = entitlementFor(nominalSize - reserved, eligible);
      for (const p of eligible) {
        entitlement[p] = outcome.seats[p] ?? 0;
        overhang[p] = Math.max(0, districtWins[p] - entitlement[p]);
        listSeats[p] = Math.max(0, entitlement[p] - districtWins[p]);
      }
      const total = sum(allParties.map((p) => districtWins[p] + listSeats[p]));
      chamberSize = total;
      detail = outcome.detail;
      warnings.push(...outcome.warnings);

      const totalOverhang = sum(allParties.map((p) => overhang[p]));
      if (totalOverhang > 0) {
        warnings.push({
          kind: 'overhang',
          message: `${totalOverhang} overhang eserleku: ganbera ${nominalSize}etik ${chamberSize}era hazi da. Ganbera handitzen da, baina proportzionaltasuna ez da erabatekoa.`,
        });
      }
    } else {
      // FINKOA: ganberak ezin du hazi. Soberakina duen alderdia poltsatik ATERATZEN dugu (bere
      // barrutiekin), eta gainerakoen artean berriro banatzen dugu. Errepikatu soberakinik gabe
      // geratu arte. Horrela guztizkoa zehazki nominala da, eta metodo guztiekin funtzionatzen du.
      let pool = [...eligible];
      const locked: PartyId[] = [];
      let outcome = entitlementFor(nominalSize - reserved, pool);

      for (let guard = 0; guard < allParties.length + 1; guard++) {
        const over = pool.filter((p) => districtWins[p] > (outcome.seats[p] ?? 0));
        if (over.length === 0) break;

        locked.push(...over);
        pool = pool.filter((p) => !over.includes(p));

        const lockedSeats = sum(locked.map((p) => districtWins[p]));
        outcome = entitlementFor(nominalSize - reserved - lockedSeats, pool);
      }

      for (const p of locked) {
        entitlement[p] = districtWins[p];
        overhang[p] = 0; // Ez dago overhang-ik: ganbera ez da hazi. Beste batzuek ordaindu dute.
        listSeats[p] = 0;
      }
      for (const p of pool) {
        entitlement[p] = outcome.seats[p] ?? 0;
        listSeats[p] = Math.max(0, entitlement[p] - districtWins[p]);
      }

      chamberSize = nominalSize;
      detail = outcome.detail;
      warnings.push(...outcome.warnings);

      if (locked.length > 0) {
        warnings.push({
          kind: 'overhang',
          message: `${locked.length} alderdik dagokiena baino barruti gehiago irabazi dituzte. Ganbera finkoa denez, ez dute zerrenda-eserlekurik jaso eta gainerakoek konpentsazio gutxiago dute: emaitza EZ da guztiz proportzionala.`,
        });
      }
    }
  }

  // Bi mailak batu: barrutiko eserlekuak jada `nominal.districts`-en daude; zerrenda-eserlekuak
  // ez dira barruti batekoak, beraz guztizkoetan bakarrik agertzen dira.
  const base = assemble(scenario, nominal.districts, warnings);
  const totals: Record<PartyId, number> = {};
  for (const p of allParties) totals[p] = districtWins[p] + listSeats[p];

  const listTier: ListTierResult = {
    compensatory: opts.compensatory,
    districtWins,
    listSeats,
    entitlement,
    overhang,
    levelingSeats,
    chamberSize,
    nominalSize,
    excluded,
    detail,
  };

  return {
    ...base,
    totals,
    totalSeats: sum(allParties.map((p) => totals[p])),
    listTier,
  };
}
