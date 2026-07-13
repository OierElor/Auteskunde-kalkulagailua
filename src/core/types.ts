/**
 * Datu-eredu partekatua. Motor osoa (core/) UI-rik gabeko TypeScript hutsa da:
 * funtzio puruak, alboko efekturik gabe, guztiz probagarriak.
 */

export type PartyId = string;
export type DistrictId = string;

export interface Party {
  id: PartyId;
  name: string;
  abbrev: string;
  color: string;
  /** Ezker-eskuin ardatza (0 = ezkerra, 100 = eskuina). Hemizikloa ordenatzeko baino ez da. */
  position: number;
}

export interface District {
  id: DistrictId;
  name: string;
  seats: number;
  /** Langa propioa ehunekotan. Zehaztuz gero, konfigurazio globala gainidazten du. */
  threshold?: number | null;
}

/** barrutia -> alderdia -> botoak */
export type VoteMatrix = Record<DistrictId, Record<PartyId, number>>;

export interface Scenario {
  name: string;
  parties: Party[];
  districts: District[];
  votes: VoteMatrix;
  /**
   * Boto zuriak barrutika. Espainiako/Euskadiko legean boto zuriak boto baliodunak dira,
   * beraz langaren izendatzailean sartzen dira eta alderdi txikiak kanpoan uzten dituzte.
   */
  blankVotes: Record<DistrictId, number>;
}

// --- Esleipen-metodoak ---------------------------------------------------

export type DivisorMethodId =
  | 'dhondt'
  | 'sainte-lague'
  | 'sainte-lague-mod'
  | 'imperiali-div'
  | 'danish'
  | 'huntington-hill';

export type QuotaMethodId = 'hare' | 'droop' | 'hagenbach-bischoff' | 'imperiali-quota';

export type MethodId = DivisorMethodId | QuotaMethodId;

// --- Langa ---------------------------------------------------------------

export interface ThresholdConfig {
  /** Ehunekotan: 3 = %3. */
  percent: number;
  /** Barruti bakoitzean aplikatu, ala estatu mailako botoen gainean. */
  scope: 'district' | 'national';
  /** Boto zuriak izendatzailean sartu (Espainiako/Euskadiko legeak bai). */
  includeBlank: boolean;
}

// --- Emaitzak ------------------------------------------------------------

/** Zatitzaile-metodoetan eserleku bakoitza nola eman den. */
export interface DivisorStep {
  /** Barrutiko esleipen-ordena (1-etik hasita). */
  seatNumber: number;
  partyId: PartyId;
  quotient: number;
  /** Alderdi horrek eskuratzen duen zenbatgarren eserlekua den (1-etik hasita). */
  seatForParty: number;
  /** Zatidura berbera zuten beste alderdiak — berdinketa bat egon da. */
  tiedWith: PartyId[];
}

export interface DivisorDetail {
  kind: 'divisor';
  method: DivisorMethodId;
  steps: DivisorStep[];
}

export interface QuotaDetail {
  kind: 'quota';
  /** Erabiltzaileak eskatutako metodoa. */
  method: QuotaMethodId;
  /** Benetan erabilitakoa: kuotak gehiegi esleitzen bazuen, fallback-a aplikatzen da. */
  effectiveMethod: QuotaMethodId;
  quota: number;
  /** Kuota osoen bidez zuzenean lortutako eserlekuak. */
  automatic: Record<PartyId, number>;
  /** Hondarra (botoak - automatikoak * kuota). */
  remainders: Record<PartyId, number>;
  /** Hondar handienaren bidez emandako eserlekuak. */
  remainderSeats: Record<PartyId, number>;
  /** Hondarrean berdinketa izan duten alderdiak. */
  tiedWith: PartyId[];
}

/** Sistema maioritarioa: boto gehien dituenak barrutia irabazten du. */
export interface PluralityDetail {
  kind: 'plurality';
  winner: PartyId | null;
  votes: Record<PartyId, number>;
  /** Bigarren geratu denarekiko aldea, botoetan. Txikia bada, barrutia "eztabaidatua" da. */
  margin: number;
  winnerPercent: number;
}

export interface TransferFlow {
  from: PartyId;
  to: PartyId;
  votes: number;
}

/** Bi itzuliko sistema. Bigarren itzuliko botoak transferentzia-matrizetik ondorioztatzen dira. */
export interface RunoffDetail {
  kind: 'runoff';
  /** Norbaitek %50 gainditu du lehen itzulian: ez da bigarrenik egon. */
  decidedInFirstRound: boolean;
  firstRound: Record<PartyId, number>;
  qualified: PartyId[];
  eliminated: PartyId[];
  secondRound: Record<PartyId, number>;
  transfers: TransferFlow[];
  /** Bigarren itzulian etxean geratu diren botoak. */
  abstained: number;
  winner: PartyId | null;
  margin: number;
}

export type AllocationDetail = DivisorDetail | QuotaDetail | PluralityDetail | RunoffDetail;

/** Barruti bakarreko esleipen baten emaitza. */
export interface DistrictAllocation {
  districtId: DistrictId;
  seats: Record<PartyId, number>;
  /** Langak kanpoan utzitako alderdiak. */
  excluded: PartyId[];
  detail: AllocationDetail;
  /** Berdinketak eta bestelako abisuak (adib. kuotaren fallback-a). */
  warnings: Warning[];
}

export interface Warning {
  kind:
    | 'tie'
    | 'quota-fallback'
    | 'unfilled-seats'
    | 'more-parties-than-seats'
    /** Sistema maioritarioa eserleku bat baino gehiagoko barrutian: irabazleak denak hartzen ditu. */
    | 'general-ticket';
  message: string;
}

export interface ElectionResult {
  /** barrutia -> alderdia -> eserlekuak */
  seatsByDistrict: Record<DistrictId, Record<PartyId, number>>;
  /** alderdia -> eserleku guztiak */
  totals: Record<PartyId, number>;
  /** alderdia -> boto guztiak (barruti guztietan) */
  voteTotals: Record<PartyId, number>;
  totalSeats: number;
  totalVotes: number;
  /** Boto zuriak barne, baina hautagaitzarik gabekoak kanpo. */
  totalValidVotes: number;
  districts: DistrictAllocation[];
  warnings: Warning[];
}
