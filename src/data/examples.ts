import { csvToScenario } from '../core/csv';
import type { SystemConfig } from '../core/systems';
import type { Party, Scenario } from '../core/types';
import { applyKnownParties } from './knownParties';

import legebiltzarra2024 from '../../datuak/eusko-legebiltzarra-2024.csv?raw';
import legebiltzarra2020 from '../../datuak/eusko-legebiltzarra-2020.csv?raw';
import legebiltzarra2016 from '../../datuak/eusko-legebiltzarra-2016.csv?raw';
import kongresua2023 from '../../datuak/espainiako-kongresua-2023.csv?raw';
import nafarroa2023 from '../../datuak/nafarroako-parlamentua-2023.csv?raw';
import europakoa2024 from '../../datuak/europako-parlamentua-2024.csv?raw';

/**
 * DATU SINTETIKOAK. Alderdiak asmatuak dira (koloreen izenak daramatzate, nahasterik egon ez dadin)
 * eta botoak ez datoz benetako hauteskunde batetik. Zure datu errealak CSV bidez karga ditzakezu.
 *
 * Egiturak, ordea, benetakoak dira: 3 × 25 eserleku Eusko Legebiltzarrarena da.
 */

const PARTIES: Party[] = [
  { id: 'morea', name: 'Alderdi Morea', abbrev: 'MOR', color: '#4a3aa7', position: 8 },
  { id: 'berdea', name: 'Alderdi Berdea', abbrev: 'BER', color: '#008300', position: 25 },
  { id: 'urdina', name: 'Alderdi Urdina', abbrev: 'URD', color: '#2a78d6', position: 45 },
  { id: 'gorria', name: 'Alderdi Gorria', abbrev: 'GOR', color: '#e34948', position: 60 },
  { id: 'horia', name: 'Alderdi Horia', abbrev: 'HOR', color: '#eda100', position: 80 },
  { id: 'laranja', name: 'Alderdi Laranja', abbrev: 'LAR', color: '#eb6834', position: 95 },
];

/**
 * Botoak barrutika. Baturak zehatzak dira: 120.000 + 480.000 + 300.000 = 900.000 boto.
 *
 * Alderdi Laranja nahita dago ertzean: 27.000 boto guztira, hau da, alderdiei emandako botoen
 * %3,0 ZEHAZKI. Gainera Bizkaian kontzentratuta dago (%5,0) eta ia ez du ezer beste bietan.
 * Bi gauza erakusten ditu horrek — ikus behean.
 */
const ARABA = { morea: 9_000, berdea: 30_000, urdina: 36_000, gorria: 24_400, horia: 19_400, laranja: 1_200 };
const BIZKAIA = { morea: 33_600, berdea: 129_600, urdina: 158_400, gorria: 72_000, horia: 62_400, laranja: 24_000 };
const GIPUZKOA = { morea: 30_000, berdea: 105_000, urdina: 75_000, gorria: 51_200, horia: 37_000, laranja: 1_800 };

const nationalVotes = () =>
  Object.fromEntries(
    PARTIES.map((p) => [
      p.id,
      ARABA[p.id as keyof typeof ARABA] +
        BIZKAIA[p.id as keyof typeof BIZKAIA] +
        GIPUZKOA[p.id as keyof typeof GIPUZKOA],
    ]),
  ) as Record<string, number>;

/**
 * Hiru barruti, 25 eserleku bakoitza (Eusko Legebiltzarraren egitura).
 *
 * Hemen legezko langak ia ez du ezer erabakitzen, eta hori bera da ikasgaia: 25 eserlekuko
 * barruti batean D'Hondt-en BEREZKO langa ~%3,8 da (1/(25+1) inguru), legezko %3a baino altuagoa.
 * Alderdi Laranjak Bizkaian bakarrik lortzen du eserlekua (%5), inon ez %3aren azpitik egon arren.
 * Barrutiaren tamaina bera da benetako langa; legezkoa apaingarria da hemen.
 */
const hiruBarruti: Scenario = {
  name: 'Hiru barruti · 75 eserleku',
  parties: PARTIES,
  districts: [
    { id: 'araba', name: 'Araba', seats: 25 },
    { id: 'bizkaia', name: 'Bizkaia', seats: 25 },
    { id: 'gipuzkoa', name: 'Gipuzkoa', seats: 25 },
  ],
  votes: { araba: ARABA, bizkaia: BIZKAIA, gipuzkoa: GIPUZKOA },
  blankVotes: { araba: 1_500, bizkaia: 6_000, gipuzkoa: 3_500 },
};

/**
 * Boto berberak, barruti bakarrean (75 eserleku).
 *
 * Orain berezko langa ~%1,3ra jaisten da, eta legezko %3ak BAI erabakitzen du. Hemen ikusten da
 * boto zurien araua: Alderdi Laranjak alderdiei emandako botoen %3,0 zehatza du, eta legez langa
 * gainditzen du... boto zuriak kontatzen ez badira. Zuriak izendatzailean sartuta (Espainiako eta
 * Euskadiko legeak hala agintzen du) %2,96ra jaisten da eta BI ESERLEKU galtzen ditu.
 *
 * Aktibatu eta desaktibatu "Boto zuriak izendatzailean sartu" etengailua eszenatoki honetan.
 */
const barrutiBakarra: Scenario = {
  name: 'Barruti bakarra · 75 eserleku',
  parties: PARTIES,
  districts: [{ id: 'estatua', name: 'Barruti bakarra', seats: 75 }],
  votes: { estatua: nationalVotes() },
  blankVotes: { estatua: 11_000 },
};

/**
 * Boto berberak berriro, 25 barruti txikitan (3 eserleku bakoitza).
 *
 * Erakustaldirik gogorrena: langa BERBERA, metodo BERBERA eta boto BERBERAK, baina 3 eserlekuko
 * barrutietan berezko langa %25 ingurukoa da inork ezarri gabe, eta alderdi txikiak erabat
 * desagertzen dira. Barrutien tamaina tresna politiko bat da, langa bezainbeste.
 */
const barrutiTxikiak: Scenario = (() => {
  const national = nationalVotes();
  const districts = Array.from({ length: 25 }, (_, i) => ({
    id: `b${i + 1}`,
    name: `${i + 1}. barrutia`,
    seats: 3,
  }));
  const votes: Scenario['votes'] = {};
  const blankVotes: Scenario['blankVotes'] = {};
  for (const d of districts) {
    votes[d.id] = Object.fromEntries(
      PARTIES.map((p) => [p.id, Math.round(national[p.id] / 25)]),
    ) as Record<string, number>;
    blankVotes[d.id] = 440;
  }
  return { name: '25 barruti txiki · 75 eserleku', parties: PARTIES, districts, votes, blankVotes };
})();

/** Hazi finkoko zorizko sorgailua: emaitza beti berbera da, eta beraz probagarria. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 75 barruti uninominal (eserleku bat bakoitzean) — FPTP eta bi itzuli probatzeko.
 *
 * Barruti bakoitzak bere "joera" du ezker-eskuin ardatzean, eta joera horretatik hurbil dauden
 * alderdiek boto gehiago jasotzen dituzte bertan. Aldakuntza sintetikoa da, hazi finko batekin
 * sortua (beti berbera).
 *
 * GAKOA: botoak berriro eskalatzen dira alderdi bakoitzaren GUZTIZKO NAZIONALA aurreko
 * eszenatokien berbera izan dadin (900.000 boto, banaketa berbera). Beraz konparaketa zehatza da:
 * boto berberak, eserleku kopuru berbera, baina barruti uninominalak. FPTP-k gehiengoak nola
 * fabrikatzen dituen ikusteko modurik garbiena.
 */
const barrutiUninominalak: Scenario = (() => {
  const national = nationalVotes();
  const nationalTotal = Object.values(national).reduce((a, b) => a + b, 0);
  const random = seededRandom(20260713);
  const COUNT = 75;
  const SIGMA = 26; // Zenbat eta txikiagoa, orduan eta polarizatuagoak barrutiak.

  const districts = Array.from({ length: COUNT }, (_, i) => ({
    id: `u${i + 1}`,
    name: `${i + 1}. barrutia`,
    seats: 1,
  }));

  // 1) Barruti bakoitzeko botoak, joeraren arabera.
  const raw: Record<string, Record<string, number>> = {};
  for (let i = 0; i < COUNT; i++) {
    const lean = 12 + 76 * (i / (COUNT - 1)) + (random() - 0.5) * 26;
    const turnout = 10_000 + random() * 4_000;

    const weights = PARTIES.map(
      (p) => (national[p.id] / nationalTotal) * Math.exp(-Math.abs(p.position - lean) / SIGMA),
    );
    const weightSum = weights.reduce((a, b) => a + b, 0);

    raw[districts[i].id] = Object.fromEntries(
      PARTIES.map((p, k) => [p.id, (weights[k] / weightSum) * turnout]),
    );
  }

  // 2) Alderdi bakoitza berreskalatu bere guztizko nazionala zehatz-zehatz berreskuratzeko,
  //    eta hondarra hondar handienaren arabera banatu (botorik ez galtzeko, ez asmatzeko).
  const votes: Scenario['votes'] = {};
  for (const d of districts) votes[d.id] = {};

  for (const p of PARTIES) {
    const rawTotal = districts.reduce((sum, d) => sum + raw[d.id][p.id], 0);
    const scaled = districts.map((d) => (raw[d.id][p.id] / rawTotal) * national[p.id]);
    const floors = scaled.map(Math.floor);

    let remaining = national[p.id] - floors.reduce((a, b) => a + b, 0);
    const byRemainder = scaled
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);

    for (let k = 0; k < remaining; k++) floors[byRemainder[k % COUNT].i] += 1;
    districts.forEach((d, i) => {
      votes[d.id][p.id] = floors[i];
    });
  }

  const blankVotes: Scenario['blankVotes'] = {};
  for (const d of districts) blankVotes[d.id] = 147;

  return { name: '75 barruti uninominal · FPTP', parties: PARTIES, districts, votes, blankVotes };
})();

// --- Hauteskunde errealak --------------------------------------------------
//
// `datuak/` karpetako CSV OFIZIALAK, aplikazioan bertan. Ez dago parseatzaile berririk: lehendik
// dauden `csvToScenario` eta `applyKnownParties` erabiltzen dira, CSV fitxatik kargatzean bezalaxe.
// 32 KB dira guztira.

const realScenario = (csv: string, name: string): Scenario => ({
  ...applyKnownParties(csvToScenario(csv)),
  name,
});

/** Espainiako eta Euskadiko lege orokorra: D'Hondt, %3 barrutika, boto zuriak izendatzailean. */
const SPANISH_RULES: Partial<SystemConfig> = {
  system: 'list-pr',
  method: 'dhondt',
  threshold: { percent: 3, scope: 'district', includeBlank: true },
};

export type ExampleGroup = 'benetakoa' | 'magnitudea';

export interface Example {
  id: string;
  label: string;
  /** Bigarren lerroa zerrendan: "350 eserleku · 52 barruti". */
  summary: string;
  /** Zer erakusten duen. ORAIN BAI: hautatzailean erakusten da. */
  hint: string;
  group: ExampleGroup;
  scenario: Scenario;
  /**
   * Hauteskundearen ARAU LEGALAK. Eszenatokiarekin batera aplikatzen dira: bestela Eusko
   * Legebiltzarra kargatuta zure uneko langarekin kalkulatuko luke, eta emaitza ez litzateke
   * ofiziala — jakin gabe zergatik.
   */
  config: Partial<SystemConfig>;
  /** Datu errealetarako: iturri ofiziala. */
  source?: string;
}

export const EXAMPLES: Example[] = [
  // --- Benetako hauteskundeak ---------------------------------------------
  {
    id: 'legebiltzarra-2024',
    label: 'Eusko Legebiltzarra 2024',
    summary: '75 eserleku · 3 barruti',
    hint: 'Emaitza ofiziala: EAJ-PNV 27, EH Bildu 27, PSE-EE 12, PP 7, Sumar 1, Vox 1. Probatu langa %5era igotzen, edo Sainte-Laguë metodora aldatzen.',
    group: 'benetakoa',
    scenario: realScenario(legebiltzarra2024, 'Eusko Legebiltzarra 2024'),
    config: SPANISH_RULES,
    source: 'Eusko Jaurlaritza — datu ofizialak',
  },
  {
    id: 'legebiltzarra-2020',
    label: 'Eusko Legebiltzarra 2020',
    summary: '75 eserleku · 3 barruti',
    hint: 'Emaitza ofiziala: EAJ-PNV 31, EH Bildu 21, PSE-EE 10, Elkarrekin Podemos 6, PP+Cs 6, Vox 1.',
    group: 'benetakoa',
    scenario: realScenario(legebiltzarra2020, 'Eusko Legebiltzarra 2020'),
    config: SPANISH_RULES,
    source: 'Eusko Jaurlaritza — datu ofizialak',
  },
  {
    id: 'legebiltzarra-2016',
    label: 'Eusko Legebiltzarra 2016',
    summary: '75 eserleku · 3 barruti',
    hint: 'Emaitza ofiziala: EAJ-PNV 28, EH Bildu 18, Podemos 11, PSE-EE 9, PP 9.',
    group: 'benetakoa',
    scenario: realScenario(legebiltzarra2016, 'Eusko Legebiltzarra 2016'),
    config: SPANISH_RULES,
    source: 'Eusko Jaurlaritza — datu ofizialak',
  },
  {
    id: 'kongresua-2023',
    label: 'Espainiako Kongresua 2023',
    summary: '350 eserleku · 52 barruti',
    hint: 'Hemen ikusten da barruti txikien eragina: Voxek 33 eserleku ditu eta Sumarrek 31. Boto berberekin BARRUTI BAKAR batean, 48 eta 48 lituzkete. Ez da langa — barrutien tamaina da.',
    group: 'benetakoa',
    scenario: realScenario(kongresua2023, 'Espainiako Kongresua 2023'),
    config: SPANISH_RULES,
    source: 'BOE — Junta Electoral Central',
  },
  {
    id: 'nafarroa-2023',
    label: 'Nafarroako Parlamentua 2023',
    summary: '50 eserleku · barruti bakarra',
    hint: 'Barruti bakarra denez, sistema oso proportzionala da (Gallagher 1,8). Konparatu Kongresuarekin (5,6): egitura bakarrik aldatzen da.',
    group: 'benetakoa',
    scenario: realScenario(nafarroa2023, 'Nafarroako Parlamentua 2023'),
    config: SPANISH_RULES,
    source: 'Nafarroako Gobernua — datu irekiak',
  },
  {
    id: 'europakoa-2024',
    label: 'Europako Parlamentua 2024',
    summary: '61 eserleku · langarik EZ',
    hint: 'Espainiak barruti bakarra du eta LANGARIK EZ: bederatzi hautagaitzak lortu zuten eserlekua. Igo langa %3ra eta ikusi zenbat desagertzen diren.',
    group: 'benetakoa',
    scenario: realScenario(europakoa2024, 'Europako Parlamentua 2024'),
    config: {
      system: 'list-pr',
      method: 'dhondt',
      threshold: { percent: 0, scope: 'district', includeBlank: true },
    },
    source: 'BOE — Junta Electoral Central',
  },

  // --- Barrutien tamainaren eragina ---------------------------------------
  //
  // LAU HAUEK ESPERIMENTU BAKARRA DIRA. Boto berberak, 75 eserleku, D'Hondt eta %3ko langa
  // berberak. BARRUTI-EGITURA da aldatzen den GAUZA BAKARRA. Konfigurazio berbera daramate
  // nahita: bestela ez litzateke esperimentu kontrolatu bat.
  {
    id: 'hiru-barruti',
    label: '3 barruti × 25 eserleku',
    summary: 'Eusko Legebiltzarraren egitura',
    hint: 'Abiapuntua. Hemen legezko %3ko langak ia ez du ezer erabakitzen: 25 eserlekuko barruti batean D\'Hondt-en BEREZKO langa ~%3,8 da, altuagoa. Barrutiaren tamaina da benetako langa.',
    group: 'magnitudea',
    scenario: hiruBarruti,
    config: SPANISH_RULES,
  },
  {
    id: 'barruti-bakarra',
    label: '1 barruti × 75 eserleku',
    summary: 'Barruti bakarra',
    hint: 'Berezko langa ~%1,3ra jaisten da, eta orain legezko %3ak BAI du eragina. Probatu "boto zuriak izendatzailean" etengailua: Alderdi Laranjak bi eserleku galtzen ditu.',
    group: 'magnitudea',
    scenario: barrutiBakarra,
    config: SPANISH_RULES,
  },
  {
    id: 'barruti-txikiak',
    label: '25 barruti × 3 eserleku',
    summary: 'Barruti oso txikiak',
    hint: 'Berezko langa ~%25era igotzen da inork ezarri gabe. Hiru alderdik DENA hartzen dute; beste hiruk zero. Gallagher 2,2tik 16,8ra.',
    group: 'magnitudea',
    scenario: barrutiTxikiak,
    config: SPANISH_RULES,
  },
  {
    id: 'uninominalak',
    label: '75 barruti × 1 eserleku',
    summary: 'Barruti uninominalak',
    hint: 'Muturra: eserleku bakarra barrutiko. Hemendik abiatu sistema maioritarioak (FPTP, bi itzuli), mistoak (MMM, MMP) eta STV probatzeko — denek barruti uninominalak behar dituzte.',
    group: 'magnitudea',
    scenario: barrutiUninominalak,
    config: SPANISH_RULES,
  },
];

export const GROUPS: { id: ExampleGroup; label: string; note?: string }[] = [
  { id: 'benetakoa', label: 'Benetako hauteskundeak' },
  {
    id: 'magnitudea',
    label: 'Barrutien tamainaren eragina',
    // Hau da lau eszenatokiak zentzuz betetzen dituen esaldia — falta zena.
    note: 'Boto BERBERAK, 75 eserleku, D\'Hondt eta %3ko langa. Barruti-egitura da aldatzen den gauza bakarra.',
  },
];

export const DEFAULT_SCENARIO = hiruBarruti;
export const SINGLE_DISTRICT_SCENARIO = barrutiBakarra;
export const SINGLE_MEMBER_SCENARIO = barrutiUninominalak;
