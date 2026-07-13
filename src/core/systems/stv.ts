import { generateCandidates } from '../candidates';
import type { Candidate, CandidateConfig } from '../candidates';
import { buildTransferMatrix } from '../transfers';
import type { TransferConfig, TransferMatrix } from '../transfers';
import { assemble } from './majoritarian';
import type {
  DistrictAllocation,
  ElectionResult,
  PartyId,
  Scenario,
  StvDetail,
  StvRound,
  Warning,
} from '../types';

/**
 * STV (Single Transferable Vote) eta IRV.
 *
 * Hemen ez dira alderdiak lehiatzen: HAUTAGAIAK dira. Hautesleak ordenatu egiten ditu (1., 2., 3.),
 * eta botoa transferitu egiten da kuota lortzen denean edo hautagaia kanporatzen denean.
 *
 * DATU-ARAZOA, berriro: boto-txartel ordenatuak ez daude. Milioika txartel eskuz sartzea ezinezkoa
 * da. Konponbidea: 2. faseko TRANSFERENTZIA-MATRIZE BERBERA erabiltzen dugu txartelak sortzeko.
 * Alderdi baten hautesleak sortak ("bundles") dira: bakoitzak bere alderdiaren hautagaiak jartzen
 * ditu lehenengo, eta gero matrizeak dioen alderdira jotzen du. Abstentzio-tasak "plumper" txartelak
 * sortzen ditu: beren alderdia bakarrik zerrendatzen dutenak, gero botoa agortuz.
 *
 * Hipotesi bat da, eta hala aurkezten dugu.
 */

export interface StvOptions {
  transfers: TransferConfig;
  candidates: CandidateConfig;
}

/** Boto-txartel sorta bat: ordena bera duten txartel guztiak, kopuruarekin. */
interface Parcel {
  ranking: string[];
  /** Uneko balioa. Gregory-ren transferentziak murrizten du (frakzionala izan daiteke). */
  value: number;
  /** Ranking-eko posizioa: hemendik aurrera bilatzen da hautagai jarraitzailea. */
  position: number;
}

const EPS = 1e-9;

/**
 * Barruti bateko boto-txartelak sortzen ditu transferentzia-matrizetik.
 *
 * Alderdi bakoitzeko botoak sortatan banatzen dira: matrizeak dioen proportzioan alderdi bakoitzera,
 * gehi "plumper" sorta bat (abstentzio-tasa) beste lehentasunik adierazten ez duena.
 */
export function generateBallots(
  scenario: Scenario,
  districtId: string,
  candidates: Candidate[],
  matrix: TransferMatrix,
): Parcel[] {
  const inDistrict = candidates.filter((c) => c.districtId === districtId);
  const byParty = (partyId: PartyId) =>
    inDistrict
      .filter((c) => c.partyId === partyId)
      .sort((a, b) => a.listOrder - b.listOrder)
      .map((c) => c.id);

  const parcels: Parcel[] = [];

  for (const party of scenario.parties) {
    const votes = scenario.votes[districtId]?.[party.id] ?? 0;
    if (votes <= 0) continue;

    const own = byParty(party.id);
    const abstention = (matrix.abstention[party.id] ?? 0) / 100;
    const row = matrix.weights[party.id] ?? {};

    // Beste alderdiak afinitatearen arabera ordenatuta: hirugarren, laugarren… lehentasunak.
    const others = scenario.parties
      .filter((p) => p.id !== party.id)
      .sort((a, b) => (row[b.id] ?? 0) - (row[a.id] ?? 0));

    const bundles: { count: number; ranking: string[] }[] = [];

    // "Plumper"-ak: beren alderdia bakarrik zerrendatzen dute. Botoa agortu egiten da gero.
    const plumpers = votes * abstention;
    if (plumpers > 0) bundles.push({ count: plumpers, ranking: own });

    // Gainerakoak: bigarren lehentasuna matrizeak dio; hortik aurrera afinitate-ordenan.
    for (const second of others) {
      const share = (row[second.id] ?? 0) / 100;
      if (share <= 0) continue;
      const rest = others.filter((p) => p.id !== second.id);
      bundles.push({
        count: votes * (1 - abstention) * share,
        ranking: [...own, ...byParty(second.id), ...rest.flatMap((p) => byParty(p.id))],
      });
    }

    // Osotara biribildu, botorik sortu edo galdu gabe.
    const rounded = bundles.map((b) => Math.round(b.count));
    const drift = votes - rounded.reduce((a, b) => a + b, 0);
    if (rounded.length > 0) {
      const biggest = rounded.indexOf(Math.max(...rounded));
      rounded[biggest] += drift;
    }

    bundles.forEach((b, i) => {
      if (rounded[i] > 0) parcels.push({ ranking: b.ranking, value: rounded[i], position: 0 });
    });
  }

  return parcels;
}

export interface StvOutcome {
  elected: string[];
  detail: StvDetail;
}

/**
 * Barruti bateko STV. Eserleku bakarrarekin, IRV da (kanporaketa mailakatua).
 *
 * Gregory frakzionala: hautagai bat kuota gaindituta hautatzen denean, SOBERAKINA bakarrik
 * transferitzen da — bere txartel guztiak `soberakina / guztira` faktorez biderkatuta. Emaitza
 * deterministikoa da (ez dago txartelen zozketarik, benetako STV zaharretan bezala).
 *
 * Erronda bakoitzean ekintza BAT: norbait hautatu, edo norbait kanporatu. Horrek bistaratzea
 * irakurgarri egiten du.
 */
export function runStvDistrict(
  candidateIds: string[],
  parcels: Parcel[],
  seats: number,
): StvOutcome {
  const totalVotes = parcels.reduce((sum, p) => sum + p.value, 0);
  const quota = seats > 0 ? Math.floor(totalVotes / (seats + 1)) + 1 : 0;

  const continuing = new Set(candidateIds);
  const elected: string[] = [];
  const rounds: StvRound[] = [];
  let exhausted = 0;
  let live = parcels.map((p) => ({ ...p }));

  const empty: StvDetail = {
    kind: 'stv',
    quota,
    totalVotes,
    rounds,
    elected,
    exhausted,
  };
  if (seats <= 0 || candidateIds.length === 0 || totalVotes <= 0) return { elected, detail: empty };

  /** Txartel bakoitza bere lehen hautagai JARRAITZAILEARI esleitu. Agortutakoak kentzen dira. */
  const distribute = (): Map<string, Parcel[]> => {
    const holding = new Map<string, Parcel[]>();
    const surviving: Parcel[] = [];

    for (const parcel of live) {
      while (
        parcel.position < parcel.ranking.length &&
        !continuing.has(parcel.ranking[parcel.position])
      ) {
        parcel.position += 1;
      }
      if (parcel.position >= parcel.ranking.length) {
        exhausted += parcel.value; // Lehentasun gehiagorik ez: botoa galdu egiten da.
        continue;
      }
      if (parcel.value <= EPS) continue; // Balioa agortuta: jada norbait hautatzen lagundu du.

      const holder = parcel.ranking[parcel.position];
      if (!holding.has(holder)) holding.set(holder, []);
      holding.get(holder)!.push(parcel);
      surviving.push(parcel);
    }

    live = surviving;
    return holding;
  };

  const guard = candidateIds.length * 2 + seats + 10;

  for (let round = 1; round <= guard && elected.length < seats; round++) {
    const holding = distribute();

    const counts: Record<string, number> = {};
    for (const id of continuing) {
      counts[id] = (holding.get(id) ?? []).reduce((sum, p) => sum + p.value, 0);
    }

    // Geratzen diren hautagaiak eserlekuak beste badira, denak hautatuta daude: lehia amaitu da.
    if (continuing.size <= seats - elected.length) {
      const rest = [...continuing].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
      for (const id of rest) {
        elected.push(id);
        continuing.delete(id);
      }
      rounds.push({
        round,
        counts,
        elected: null,
        eliminated: null,
        transfers: [],
        exhausted,
      });
      break;
    }

    const ranked = [...continuing].sort(
      (a, b) =>
        (counts[b] ?? 0) - (counts[a] ?? 0) || candidateIds.indexOf(a) - candidateIds.indexOf(b),
    );

    const top = ranked[0];
    const transfers: { from: string; to: string; votes: number }[] = [];

    if ((counts[top] ?? 0) >= quota) {
      // --- HAUTATUA: soberakina bakarrik transferitzen da.
      elected.push(top);
      continuing.delete(top);

      const total = counts[top] ?? 0;
      const surplus = total - quota;
      const parcelsOf = holding.get(top) ?? [];

      if (surplus > EPS && elected.length < seats) {
        const transferValue = surplus / total;
        for (const parcel of parcelsOf) {
          const moved = parcel.value * transferValue;
          parcel.value = moved;
          parcel.position += 1;

          // Nora doan jakiteko: hurrengo hautagai jarraitzailea.
          let k = parcel.position;
          while (k < parcel.ranking.length && !continuing.has(parcel.ranking[k])) k += 1;
          if (k < parcel.ranking.length) {
            transfers.push({ from: top, to: parcel.ranking[k], votes: moved });
          }
        }
      } else {
        // Soberakinik ez: txartelek erabat lagundu dute hautatzen, ez dute balio gehiagorik.
        for (const parcel of parcelsOf) parcel.value = 0;
      }

      rounds.push({ round, counts, elected: top, eliminated: null, transfers, exhausted });
    } else {
      // --- KANPORAKETA: inork ez du kuota. Azkenak bere txartel guztiak transferitzen ditu.
      const last = ranked[ranked.length - 1];
      continuing.delete(last);

      for (const parcel of holding.get(last) ?? []) {
        parcel.position += 1;
        let k = parcel.position;
        while (k < parcel.ranking.length && !continuing.has(parcel.ranking[k])) k += 1;
        if (k < parcel.ranking.length) {
          transfers.push({ from: last, to: parcel.ranking[k], votes: parcel.value });
        }
      }

      rounds.push({ round, counts, elected: null, eliminated: last, transfers, exhausted });
    }
  }

  return {
    elected,
    detail: { kind: 'stv', quota, totalVotes, rounds, elected, exhausted },
  };
}

export function runStv(scenario: Scenario, opts: StvOptions): ElectionResult {
  const allParties = scenario.parties.map((p) => p.id);
  const candidates = generateCandidates(scenario, opts.candidates);
  const matrix = buildTransferMatrix(scenario.parties, opts.transfers);

  const districts: DistrictAllocation[] = [];
  const warnings: Warning[] = [];

  for (const district of scenario.districts) {
    const inDistrict = candidates.filter((c) => c.districtId === district.id);
    const parcels = generateBallots(scenario, district.id, candidates, matrix);
    const outcome = runStvDistrict(
      inDistrict.map((c) => c.id),
      parcels,
      district.seats,
    );

    const seats: Record<PartyId, number> = {};
    for (const p of allParties) seats[p] = 0;
    for (const id of outcome.elected) {
      const candidate = inDistrict.find((c) => c.id === id);
      if (candidate) seats[candidate.partyId] += 1;
    }

    const filled = outcome.elected.length;
    if (filled < district.seats) {
      warnings.push({
        kind: 'unfilled-seats',
        message: `${district.name}: ${district.seats - filled} eserleku bete gabe (botoak agortu dira).`,
      });
    }

    districts.push({
      districtId: district.id,
      seats,
      excluded: [],
      detail: outcome.detail,
      warnings: [],
    });
  }

  return assemble(scenario, districts, warnings);
}
