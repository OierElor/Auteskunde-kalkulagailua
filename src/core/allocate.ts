import { DIVISOR_METHODS, isDivisorMethod, quotient } from './divisors';
import { QUOTA_FALLBACK, QUOTA_METHODS, isQuotaMethod } from './quotas';
import type {
  AllocationDetail,
  DivisorMethodId,
  DivisorStep,
  MethodId,
  PartyId,
  QuotaMethodId,
  Warning,
} from './types';

export interface AllocationOutcome {
  seats: Record<PartyId, number>;
  detail: AllocationDetail;
  warnings: Warning[];
}

const EPS = 1e-9;

/** Zenbaki higikorren konparaketa segurua: 1,4ko zatitzaileak errore txikiak sortzen ditu. */
function nearlyEqual(a: number, b: number): boolean {
  if (a === b) return true; // Infinity === Infinity ere hemen harrapatzen da (Huntington-Hill)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Berdinketak hausteko ordena deterministikoa: boto gehien dituena lehenengo, eta boto berdinak
 * badituzte, alderdi-zerrendako ordena. Benetako hauteskundeetan zozketa egingo litzateke; guk
 * emaitza egonkorra behar dugu, baina berdinketa `warnings`-en jakinarazten dugu.
 */
function tieBreakOrder(parties: PartyId[], votes: Record<PartyId, number>): PartyId[] {
  const index = new Map(parties.map((p, i) => [p, i]));
  return [...parties].sort(
    (a, b) => (votes[b] ?? 0) - (votes[a] ?? 0) || index.get(a)! - index.get(b)!,
  );
}

function zeroed(parties: PartyId[]): Record<PartyId, number> {
  const out: Record<PartyId, number> = {};
  for (const p of parties) out[p] = 0;
  return out;
}

// --- Zatitzaile-metodoak -------------------------------------------------

function allocateDivisor(
  votes: Record<PartyId, number>,
  seats: number,
  method: DivisorMethodId,
  parties: PartyId[],
): AllocationOutcome {
  const result = zeroed(parties);
  const steps: DivisorStep[] = [];
  const warnings: Warning[] = [];
  const detail: AllocationDetail = { kind: 'divisor', method, steps };

  const contenders = tieBreakOrder(parties, votes).filter((p) => (votes[p] ?? 0) > 0);

  if (seats <= 0) return { seats: result, detail, warnings };
  if (contenders.length === 0) {
    warnings.push({
      kind: 'unfilled-seats',
      message: `${seats} eserleku bete gabe: ez dago botorik jaso duen alderdirik.`,
    });
    return { seats: result, detail, warnings };
  }
  if (method === 'huntington-hill' && contenders.length > seats) {
    warnings.push({
      kind: 'more-parties-than-seats',
      message: `Huntington-Hill-ek alderdi bakoitzari lehen eserlekua bermatzen dio, baina ${contenders.length} alderdi daude eta ${seats} eserleku baino ez. Botorik gehien dutenek hartuko dituzte.`,
    });
  }

  for (let seat = 1; seat <= seats; seat++) {
    const quotients = contenders.map((p) => quotient(votes[p] ?? 0, result[p], method));
    const best = Math.max(...quotients);
    const tied = contenders.filter((_, i) => nearlyEqual(quotients[i], best));
    const winner = tied[0]; // `contenders` berdinketa-ordenan dago jada

    // Berdinketak eserlekuen kopurua aldatzen du soilik berdinduta daudenak baino
    // eserleku gutxiago geratzen bada: bestela guztiek hartuko dute berea hurrengo txandetan.
    const remainingSeats = seats - seat + 1;
    if (tied.length > 1 && tied.length > remainingSeats) {
      warnings.push({
        kind: 'tie',
        message: `Berdinketa ${seat}. eserlekuan: ${tied.join(', ')} zatidura berberarekin (${best.toFixed(2)}). Legeak zozketa eskatuko luke; hemen boto-kopuruaren arabera erabaki da.`,
      });
    }

    steps.push({
      seatNumber: seat,
      partyId: winner,
      quotient: best,
      seatForParty: result[winner] + 1,
      tiedWith: tied.slice(1),
    });
    result[winner] += 1;
  }

  return { seats: result, detail, warnings };
}

// --- Kuota-metodoak (hondar handiena) ------------------------------------

function allocateQuota(
  votes: Record<PartyId, number>,
  seats: number,
  method: QuotaMethodId,
  parties: PartyId[],
): AllocationOutcome {
  const result = zeroed(parties);
  const warnings: Warning[] = [];
  const contenders = tieBreakOrder(parties, votes).filter((p) => (votes[p] ?? 0) > 0);
  const totalVotes = contenders.reduce((sum, p) => sum + (votes[p] ?? 0), 0);

  const emptyDetail = (): AllocationDetail => ({
    kind: 'quota',
    method,
    effectiveMethod: method,
    quota: 0,
    automatic: zeroed(parties),
    remainders: zeroed(parties),
    remainderSeats: zeroed(parties),
    tiedWith: [],
  });

  if (seats <= 0) return { seats: result, detail: emptyDetail(), warnings };
  if (totalVotes <= 0) {
    warnings.push({
      kind: 'unfilled-seats',
      message: `${seats} eserleku bete gabe: ez dago botorik jaso duen alderdirik.`,
    });
    return { seats: result, detail: emptyDetail(), warnings };
  }

  // Kuota batzuek (Imperiali, Hagenbach-Bischoff) dauden baino eserleku gehiago esleitu ditzakete.
  // Hala bada, kuota handiago batera jotzen dugu. Droop-ek eta Hare-k ezin dute gehiegi esleitu,
  // beraz katea beti amaitzen da.
  let effectiveMethod = method;
  let quota = 0;
  let automatic = zeroed(parties);
  let automaticTotal = 0;

  for (;;) {
    quota = QUOTA_METHODS[effectiveMethod].quota(totalVotes, seats);
    automatic = zeroed(parties);
    automaticTotal = 0;
    if (quota > 0 && Number.isFinite(quota)) {
      for (const p of contenders) {
        automatic[p] = Math.floor((votes[p] ?? 0) / quota);
        automaticTotal += automatic[p];
      }
    }
    if (automaticTotal <= seats) break;

    const fallback = QUOTA_FALLBACK[effectiveMethod];
    if (!fallback) break;
    warnings.push({
      kind: 'quota-fallback',
      message: `${QUOTA_METHODS[effectiveMethod].name} kuotak ${automaticTotal} eserleku esleituko lituzke, ${seats} baino ez daudenean. ${QUOTA_METHODS[fallback].name} kuota erabili da ordez.`,
    });
    effectiveMethod = fallback;
  }

  const remainders = zeroed(parties);
  for (const p of contenders) remainders[p] = (votes[p] ?? 0) - automatic[p] * quota;

  // Sarea: teorian Droop-ek eta Hare-k ezin dute gehiegi esleitu, baina koma higikorreko errore
  // batek inbariantea hautsiko luke. Halakorik gertatuz gero, hondar txikienetik kentzen dugu.
  if (automaticTotal > seats) {
    const bySmallestRemainder = [...contenders].sort(
      (a, b) => remainders[a] - remainders[b] || (votes[a] ?? 0) - (votes[b] ?? 0),
    );
    for (const p of bySmallestRemainder) {
      while (automaticTotal > seats && automatic[p] > 0) {
        automatic[p] -= 1;
        automaticTotal -= 1;
      }
      if (automaticTotal <= seats) break;
    }
  }

  for (const p of contenders) result[p] = automatic[p];

  // Gainerako eserlekuak hondar handienaren arabera, alderdi bakoitzari bat.
  const remainderSeats = zeroed(parties);
  const byRemainder = [...contenders].sort(
    (a, b) =>
      remainders[b] - remainders[a] ||
      (votes[b] ?? 0) - (votes[a] ?? 0) ||
      contenders.indexOf(a) - contenders.indexOf(b),
  );

  let remaining = seats - automaticTotal;
  let tiedWith: PartyId[] = [];
  if (remaining > 0 && remaining < byRemainder.length) {
    const cutoff = remainders[byRemainder[remaining - 1]];
    if (nearlyEqual(remainders[byRemainder[remaining]], cutoff)) {
      tiedWith = byRemainder.filter((p) => nearlyEqual(remainders[p], cutoff));
      warnings.push({
        kind: 'tie',
        message: `Hondarretan berdinketa azken eserlekurako: ${tiedWith.join(', ')}. Legeak zozketa eskatuko luke; hemen boto-kopuruaren arabera erabaki da.`,
      });
    }
  }

  // Ohiko kasuan bira bakarra egiten da. `while`-ek muturreko kasua estaltzen du (kuota oso handia,
  // alderdi baino eserleku gehiago geratzea): orduan bigarren bira bat ematen da.
  while (remaining > 0) {
    for (const p of byRemainder) {
      if (remaining === 0) break;
      result[p] += 1;
      remainderSeats[p] += 1;
      remaining -= 1;
    }
  }

  return {
    seats: result,
    detail: {
      kind: 'quota',
      method,
      effectiveMethod,
      quota,
      automatic,
      remainders,
      remainderSeats,
      tiedWith,
    },
    warnings,
  };
}

/**
 * Esleipenaren sarrera-puntu BAKARRA. Sistema elektoral guztiek hemendik pasatzen dute.
 *
 * @param votes    alderdia -> botoak (langa aplikatu ONDOREN: hemen sartzen den guztiak zilegi du eserlekua)
 * @param seats    banatu beharreko eserlekuak
 * @param method   zatitzaile- edo kuota-metodoa
 * @param parties  alderdien ordena, berdinketak modu deterministan hausteko
 */
export function allocate(
  votes: Record<PartyId, number>,
  seats: number,
  method: MethodId,
  parties: PartyId[],
): AllocationOutcome {
  if (isDivisorMethod(method)) return allocateDivisor(votes, seats, method, parties);
  if (isQuotaMethod(method)) return allocateQuota(votes, seats, method, parties);
  throw new Error(`Metodo ezezaguna: ${method}`);
}

/**
 * Zatiduren sareta osoa, "D'Hondt taula" klasikoa marrazteko: alderdi bakoitzeko lehen `columns`
 * zatidurak, eserlekua eman dutenak markatuta.
 */
export function quotientGrid(
  votes: Record<PartyId, number>,
  seats: number,
  method: DivisorMethodId,
  parties: PartyId[],
  awarded: Record<PartyId, number>,
  columns = Math.max(seats, 1),
): { partyId: PartyId; cells: { divisorIndex: number; value: number; won: boolean }[] }[] {
  return parties.map((p) => ({
    partyId: p,
    cells: Array.from({ length: columns }, (_, i) => ({
      divisorIndex: i + 1,
      value: quotient(votes[p] ?? 0, i, method),
      won: i < (awarded[p] ?? 0),
    })),
  }));
}

export const METHOD_NAMES: Record<MethodId, string> = {
  ...Object.fromEntries(Object.values(DIVISOR_METHODS).map((m) => [m.id, m.name])),
  ...Object.fromEntries(Object.values(QUOTA_METHODS).map((m) => [m.id, m.name])),
} as Record<MethodId, string>;

export const ALL_METHODS: MethodId[] = [
  ...(Object.keys(DIVISOR_METHODS) as DivisorMethodId[]),
  ...(Object.keys(QUOTA_METHODS) as QuotaMethodId[]),
];
