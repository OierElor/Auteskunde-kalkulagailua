import type { District, DistrictId, PartyId, Scenario, VoteMatrix } from './types';

/**
 * BARRUTIEN ERAGIKETAK.
 *
 * Bateratzea ez da funtzio bat gehiago: aplikazioaren ikasgai nagusia interaktibo bihurtzen du.
 * Kongresu erreala kargatu, 52 probintziak bat egin, eta Vox 33tik 48ra igotzen ikusi — boto
 * berberekin. Barrutien tamaina bera da tresna politiko bat, eta hemen uki daiteke.
 *
 * INBARIANTE NAGUSIA: bateratzeak EZ du botorik, eserlekurik ez boto zuririk sortzen edo galtzen.
 * Guztizkoak berdinak dira aurretik eta ondoren. Funtzio hauek batu besterik ez dute egiten.
 */

/** Talderik gabeko barrutien gako berezia: ez dira ukitzen. */
const SOLO = '#bakarrik:';

/** Izen batetik id egonkorra. */
function slugify(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

/** "Araba + Bizkaia + Gipuzkoa". Asko badira, laburtu: izenak luzeegiak ez izateko. */
export function mergedName(names: string[]): string {
  if (names.length === 0) return 'Barruti bateratua';
  if (names.length <= 3) return names.join(' + ');
  return `${names.slice(0, 2).join(' + ')} + … (${names.length} barruti)`;
}

/**
 * Barruti bat bateratuak biltzen dituen bakar batean.
 *
 * Langa propioa: bateratutako GUZTIEK berbera badute, mantendu; bestela garbitu (langa globala
 * erabiliko da). Ezin da bestela egin — bi langa desberdin ezin dira batu.
 */
function combine(
  scenario: Scenario,
  group: District[],
  taken: Set<string>,
  name?: string,
): { district: District; votes: Record<PartyId, number>; second: Record<PartyId, number>; blank: number } {
  const label = name ?? mergedName(group.map((d) => d.name));

  const thresholds = group.map((d) => d.threshold ?? null);
  const sameThreshold = thresholds.every((t) => t === thresholds[0]);

  const votes: Record<PartyId, number> = {};
  const second: Record<PartyId, number> = {};
  for (const party of scenario.parties) {
    votes[party.id] = group.reduce((sum, d) => sum + (scenario.votes[d.id]?.[party.id] ?? 0), 0);
    second[party.id] = group.reduce(
      (sum, d) => sum + (scenario.secondVotes?.[d.id]?.[party.id] ?? 0),
      0,
    );
  }

  return {
    district: {
      id: uniqueId(slugify(label, 'barruti-bateratua'), taken),
      name: label,
      seats: group.reduce((sum, d) => sum + d.seats, 0),
      threshold: sameThreshold ? thresholds[0] : null,
    },
    votes,
    second,
    blank: group.reduce((sum, d) => sum + (scenario.blankVotes[d.id] ?? 0), 0),
  };
}

/**
 * Barrutiak taldeka bateratu. `groupOf`-ek talde bakoitzari gako bat ematen dio; gako bera duten
 * barrutiak bat egiten dute. `null` itzuliz gero, barrutia bere horretan geratzen da.
 *
 * Talde bakoitza LEHEN kidearen postuan geratzen da: ordena esanguratsua da (alfabetikoa,
 * geografikoa…) eta ez da nahastu behar.
 */
export function mergeByGroup(
  scenario: Scenario,
  groupOf: (district: District) => string | null,
  nameOf?: (key: string, group: District[]) => string,
): Scenario {
  const keys: string[] = [];
  const groups = new Map<string, District[]>();

  for (const district of scenario.districts) {
    // Talderik gabekoak beren gako bakarra dute: bakarrik geratzen dira.
    const key = groupOf(district) ?? `${SOLO}${district.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      keys.push(key);
    }
    groups.get(key)!.push(district);
  }

  const taken = new Set<string>();
  const districts: District[] = [];
  const votes: VoteMatrix = {};
  const secondVotes: VoteMatrix = {};
  const blankVotes: Record<DistrictId, number> = {};

  for (const key of keys) {
    const group = groups.get(key)!;

    // TALDERIK GABEKOA (`groupOf` → null): ez ukitu. IDa eta izena mantentzen ditu, eta horrek
    // beste erreferentziak (hautatutako barrutia, adibidez) bizirik uzten ditu.
    //
    // Talde erreal bat kide BAKARREKOA bada, ordea, bateratu egiten da: taldearen izena hartzen du.
    // Bestela erkidegoka taldekatuta "Madrid" (probintzia) eta "Andaluzia" (erkidegoa) nahastuta
    // geratuko lirateke zerrenda berean.
    if (key.startsWith(SOLO)) {
      const district = group[0];
      taken.add(district.id);
      districts.push(district);
      votes[district.id] = { ...(scenario.votes[district.id] ?? {}) };
      if (scenario.secondVotes) {
        secondVotes[district.id] = { ...(scenario.secondVotes[district.id] ?? {}) };
      }
      blankVotes[district.id] = scenario.blankVotes[district.id] ?? 0;
      continue;
    }

    // Taldearen GAKOA da izen naturala: erkidegoka taldekatuz gero "Andaluzia" izan behar da,
    // ez "Almería + Cádiz + Córdoba + …". `nameOf`-ek gainidatz dezake (mergeDistricts-ek egiten du).
    const label = nameOf ? nameOf(key, group) : key;
    const merged = combine(scenario, group, taken, label);

    districts.push(merged.district);
    votes[merged.district.id] = merged.votes;
    if (scenario.secondVotes) secondVotes[merged.district.id] = merged.second;
    blankVotes[merged.district.id] = merged.blank;
  }

  return {
    ...scenario,
    districts,
    votes,
    blankVotes,
    ...(scenario.secondVotes ? { secondVotes } : {}),
  };
}

/** Hautatutako barrutiak bakar batean bateratu. Bi baino gutxiago badira, ez du ezer aldatzen. */
export function mergeDistricts(scenario: Scenario, ids: DistrictId[], name?: string): Scenario {
  const set = new Set(ids);
  if (set.size < 2) return scenario;

  return mergeByGroup(
    scenario,
    (d) => (set.has(d.id) ? 'bateratua' : null),
    () => name ?? mergedName(scenario.districts.filter((d) => set.has(d.id)).map((d) => d.name)),
  );
}

/** Barruti guztiak bakar batean. */
export function mergeAll(scenario: Scenario, name = 'Barruti bakarra'): Scenario {
  return mergeDistricts(
    scenario,
    scenario.districts.map((d) => d.id),
    name,
  );
}

/**
 * Hainbat barruti ezabatu. GUTXIENEZ BAT geratu behar da: barrutirik gabe ez dago hauteskunderik,
 * eta motorrak eserleku gabeko ganbera bat itzuliko luke.
 */
export function removeDistricts(scenario: Scenario, ids: DistrictId[]): Scenario {
  const set = new Set(ids);
  const remaining = scenario.districts.filter((d) => !set.has(d.id));
  if (remaining.length === 0) return scenario;

  const votes: VoteMatrix = {};
  const secondVotes: VoteMatrix = {};
  const blankVotes: Record<DistrictId, number> = {};

  for (const district of remaining) {
    votes[district.id] = scenario.votes[district.id] ?? {};
    if (scenario.secondVotes) secondVotes[district.id] = scenario.secondVotes[district.id] ?? {};
    blankVotes[district.id] = scenario.blankVotes[district.id] ?? 0;
  }

  return {
    ...scenario,
    districts: remaining,
    votes,
    blankVotes,
    ...(scenario.secondVotes ? { secondVotes } : {}),
  };
}

/** Barruti bat gora (-1) edo behera (+1) mugitu zerrendan. Muturretan, ez du ezer egiten. */
export function moveDistrict(scenario: Scenario, id: DistrictId, delta: -1 | 1): Scenario {
  const index = scenario.districts.findIndex((d) => d.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= scenario.districts.length) return scenario;

  const districts = [...scenario.districts];
  [districts[index], districts[target]] = [districts[target], districts[index]];
  return { ...scenario, districts };
}

/** Barruti bateko boto guztiak (alderdiei emandakoak, zuriak kanpo). */
export function districtVoteTotal(scenario: Scenario, id: DistrictId): number {
  const row = scenario.votes[id] ?? {};
  return scenario.parties.reduce((sum, p) => sum + (row[p.id] ?? 0), 0);
}
