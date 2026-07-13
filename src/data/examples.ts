import type { Party, Scenario } from '../core/types';

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

export interface Example {
  id: string;
  label: string;
  hint: string;
  scenario: Scenario;
}

export const EXAMPLES: Example[] = [
  {
    id: 'hiru-barruti',
    label: 'Hiru barruti · 75 eserleku',
    hint: 'Eusko Legebiltzarraren egitura. Hemen barrutiaren tamaina da benetako langa, ez legezkoa.',
    scenario: hiruBarruti,
  },
  {
    id: 'barruti-bakarra',
    label: 'Barruti bakarra · 75 eserleku',
    hint: 'Boto berberak. Orain legezko langak BAI du eragina: probatu boto zurien etengailua.',
    scenario: barrutiBakarra,
  },
  {
    id: 'barruti-txikiak',
    label: '25 barruti txiki · 75 eserleku',
    hint: '3 eserlekuko barrutiak. Langarik jarri gabe, alderdi txikiak desagertu egiten dira.',
    scenario: barrutiTxikiak,
  },
];

export const DEFAULT_SCENARIO = hiruBarruti;
export const SINGLE_DISTRICT_SCENARIO = barrutiBakarra;
