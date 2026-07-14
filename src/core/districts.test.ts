import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { csvToScenario } from './csv';
import {
  districtVoteTotal,
  mergeAll,
  mergeByGroup,
  mergeDistricts,
  moveDistrict,
  removeDistricts,
} from './districts';
import { computeIndices } from './indices';
import { runListPR } from './systems/listPR';
import { PROVINCE_TO_REGION, matchesSpanishProvinces, regionOf } from '../data/erkidegoak';
import { DEFAULT_SCENARIO, SINGLE_MEMBER_SCENARIO } from '../data/examples';
import type { Party, Scenario, ThresholdConfig } from './types';

const PARTIES: Party[] = [
  { id: 'a', name: 'A', abbrev: 'A', color: '#2a78d6', position: 20 },
  { id: 'b', name: 'B', abbrev: 'B', color: '#e34948', position: 60 },
  { id: 'c', name: 'C', abbrev: 'C', color: '#eda100', position: 90 },
];

const scenario = (): Scenario => ({
  name: 'proba',
  parties: PARTIES,
  districts: [
    { id: 'bat', name: 'Bat', seats: 5 },
    { id: 'bi', name: 'Bi', seats: 7 },
    { id: 'hiru', name: 'Hiru', seats: 3 },
  ],
  votes: {
    bat: { a: 1000, b: 600, c: 400 },
    bi: { a: 1500, b: 900, c: 300 },
    hiru: { a: 200, b: 700, c: 100 },
  },
  blankVotes: { bat: 50, bi: 80, hiru: 20 },
});

/** Guztizkoak: hauek dira aldatu behar EZ direnak. */
const totals = (s: Scenario) => ({
  seats: s.districts.reduce((sum, d) => sum + d.seats, 0),
  blank: s.districts.reduce((sum, d) => sum + (s.blankVotes[d.id] ?? 0), 0),
  votes: Object.fromEntries(
    s.parties.map((p) => [
      p.id,
      s.districts.reduce((sum, d) => sum + (s.votes[d.id]?.[p.id] ?? 0), 0),
    ]),
  ),
});

describe('INBARIANTEA: bateratzeak ez du ezer sortzen ez galtzen', () => {
  // Hau da funtzio hauen kontratu osoa. Hausten bada, datuak faltsutzen ari gara.

  it('botoak, eserlekuak eta boto zuriak berdinak dira aurretik eta ondoren', () => {
    const before = scenario();
    const combinations = [
      ['bat', 'bi'],
      ['bi', 'hiru'],
      ['bat', 'hiru'],
      ['bat', 'bi', 'hiru'],
    ];

    for (const ids of combinations) {
      const after = mergeDistricts(before, ids);
      expect(totals(after), ids.join('+')).toEqual(totals(before));
    }
  });

  it('benetako datuekin ere: Kongresua bateratuta ez da boto bakar bat galtzen', () => {
    const congress = csvToScenario(
      readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'),
    );
    const merged = mergeAll(congress);

    expect(totals(merged)).toEqual(totals(congress));
    expect(merged.districts).toHaveLength(1);
    expect(merged.districts[0].seats).toBe(350);
  });

  it('erkidegoka bateratuta ere berdin', () => {
    const congress = csvToScenario(
      readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'),
    );
    const byRegion = mergeByGroup(congress, (d) => regionOf(d.name));

    expect(totals(byRegion)).toEqual(totals(congress));
    expect(byRegion.districts).toHaveLength(19);
  });
});

describe('bateratzea', () => {
  it('eserlekuak eta botoak batzen ditu', () => {
    const merged = mergeDistricts(scenario(), ['bat', 'bi']);
    const district = merged.districts.find((d) => d.name === 'Bat + Bi')!;

    expect(district.seats).toBe(12);
    expect(merged.votes[district.id]).toEqual({ a: 2500, b: 1500, c: 700 });
    expect(merged.blankVotes[district.id]).toBe(130);
  });

  it('bateratu gabekoak ukitu gabe geratzen dira, IDa barne', () => {
    const merged = mergeDistricts(scenario(), ['bat', 'bi']);

    expect(merged.districts.map((d) => d.name)).toEqual(['Bat + Bi', 'Hiru']);
    // "Hiru"-ren IDa mantentzen da: hautatutako barrutiaren erreferentziak ez dira hausten.
    expect(merged.districts[1].id).toBe('hiru');
    expect(merged.votes.hiru).toEqual({ a: 200, b: 700, c: 100 });
  });

  it('bateratutakoa lehen kidearen postuan geratzen da', () => {
    // Ordena esanguratsua da (alfabetikoa, geografikoa…): ez da nahastu behar.
    const merged = mergeDistricts(scenario(), ['bi', 'hiru']);
    expect(merged.districts.map((d) => d.name)).toEqual(['Bat', 'Bi + Hiru']);
  });

  it('izena eman daiteke; bestela izenak kateatzen dira', () => {
    expect(mergeDistricts(scenario(), ['bat', 'bi']).districts[0].name).toBe('Bat + Bi');
    expect(mergeDistricts(scenario(), ['bat', 'bi'], 'Euskadi').districts[0].name).toBe('Euskadi');
  });

  it('izen asko badira, laburtu egiten da', () => {
    // 75 barruti: izenak ezin dira denak kateatu. Izenik eman gabe bateratuta, laburtu egiten da.
    const merged = mergeDistricts(
      SINGLE_MEMBER_SCENARIO,
      SINGLE_MEMBER_SCENARIO.districts.map((d) => d.id),
    );
    expect(merged.districts[0].name).toMatch(/\(75 barruti\)$/);
  });

  it('barruti bakarra "bateratzeak" ez du ezer aldatzen', () => {
    const before = scenario();
    expect(mergeDistricts(before, ['bat'])).toEqual(before);
    expect(mergeDistricts(before, [])).toEqual(before);
  });

  it('langa propioa: berdina bada mantendu, desberdina bada garbitu', () => {
    const s = scenario();
    s.districts[0].threshold = 5;
    s.districts[1].threshold = 5;
    s.districts[2].threshold = 10;

    // Biek %5 dute → mantendu.
    expect(mergeDistricts(s, ['bat', 'bi']).districts[0].threshold).toBe(5);
    // %5 eta %10 → ezin dira batu. Garbitu, eta langa globala erabiliko da.
    expect(mergeDistricts(s, ['bi', 'hiru']).districts[1].threshold).toBe(null);
  });

  it('bigarren botoa ere batzen du (sistema mistoak)', () => {
    const s = scenario();
    s.secondVotes = {
      bat: { a: 10, b: 20, c: 30 },
      bi: { a: 40, b: 50, c: 60 },
      hiru: { a: 1, b: 2, c: 3 },
    };
    const merged = mergeDistricts(s, ['bat', 'bi']);
    expect(merged.secondVotes![merged.districts[0].id]).toEqual({ a: 50, b: 70, c: 90 });
  });
});

describe('ezabatzea eta berrordenatzea', () => {
  it('hainbat barruti batera ezabatzen ditu', () => {
    const merged = removeDistricts(scenario(), ['bat', 'hiru']);
    expect(merged.districts.map((d) => d.id)).toEqual(['bi']);
    expect(merged.votes.bat).toBeUndefined();
    expect(merged.blankVotes.bat).toBeUndefined();
  });

  it('GUTXIENEZ BAT geratu behar da: dena ezabatzea ez da onartzen', () => {
    // Barrutirik gabe ez dago hauteskunderik: motorrak eserlekurik gabeko ganbera itzuliko luke.
    const before = scenario();
    expect(removeDistricts(before, ['bat', 'bi', 'hiru'])).toEqual(before);
  });

  it('gora eta behera mugitzen ditu, muturretan gelditzen dela', () => {
    const before = scenario();
    expect(moveDistrict(before, 'bi', -1).districts.map((d) => d.id)).toEqual(['bi', 'bat', 'hiru']);
    expect(moveDistrict(before, 'bi', 1).districts.map((d) => d.id)).toEqual(['bat', 'hiru', 'bi']);

    // Muturretan ez du ezer egiten.
    expect(moveDistrict(before, 'bat', -1)).toEqual(before);
    expect(moveDistrict(before, 'hiru', 1)).toEqual(before);
  });
});

describe('autonomia erkidegoen mapa', () => {
  it('Kongresuko 52 probintziak mapatuta daude, bat ere ez falta', () => {
    const congress = csvToScenario(readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'));

    expect(congress.districts).toHaveLength(52);
    for (const district of congress.districts) {
      expect(regionOf(district.name), `${district.name} ez dago mapan`).not.toBeNull();
    }
    // Mapan ez dago soberako sarrerarik.
    expect(Object.keys(PROVINCE_TO_REGION)).toHaveLength(52);
  });

  it('19 talde dira: 17 erkidego + Ceuta + Melilla, 350 eserleku', () => {
    const congress = csvToScenario(readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'));
    const byRegion = mergeByGroup(congress, (d) => regionOf(d.name));

    expect(byRegion.districts).toHaveLength(19);
    expect(byRegion.districts.reduce((sum, d) => sum + d.seats, 0)).toBe(350);

    // Ezagunak diren zenbaki batzuk, mapak zuzen taldekatzen duela egiaztatzeko.
    const seats = (name: string) => byRegion.districts.find((d) => d.name === name)!.seats;
    expect(seats('Andaluzia')).toBe(61); // 8 probintzia
    expect(seats('Katalunia')).toBe(48); // Barcelona 32 + Girona 6 + Lleida 4 + Tarragona 6
    expect(seats('Madril')).toBe(37); // probintzia bakarra
    expect(seats('Euskadi')).toBe(18); // Araba 4 + Bizkaia 8 + Gipuzkoa 6
  });

  it('eszenatokia Kongresua den bakarrik antzematen du', () => {
    const congress = csvToScenario(readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'));
    expect(matchesSpanishProvinces(congress)).toBe(true);
    expect(matchesSpanishProvinces(DEFAULT_SCENARIO)).toBe(false);

    // Barruti bat berrizendatuta, jada ez dator bat — eta hori zuzena da.
    const renamed = { ...congress, districts: [{ ...congress.districts[0], name: 'X' }, ...congress.districts.slice(1)] };
    expect(matchesSpanishProvinces(renamed)).toBe(false);
  });
});

describe('zertarako den hau guztia', () => {
  const rules: ThresholdConfig = { percent: 3, scope: 'district', includeBlank: true };
  const run = (s: Scenario) => runListPR(s, { method: 'dhondt', threshold: rules });
  const gallagher = (s: Scenario) => computeIndices(s, run(s)).gallagher;

  it('Kongresua bateratuta: Vox 33 → 48, Sumar 31 → 48', () => {
    // HAU DA FUNTZIO HAUEN ARRAZOIA. Boto berberak, eserleku berberak (350), metodo eta langa
    // berberak. BARRUTIEN TAMAINA da aldatzen den gauza bakarra — eta Vox eta Sumarrek eserlekuak
    // ia bikoizten dituzte. Bien botoak Espainia osoan barreiatuta daude, eta probintzia txikietan
    // ez dute inon nahikoa metatzen.
    const congress = csvToScenario(readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'));
    const single = mergeAll(congress);

    const seats = (s: Scenario, name: string) => {
      const party = s.parties.find((p) => p.name.includes(name))!;
      return run(s).totals[party.id];
    };

    expect(seats(congress, 'VOX')).toBe(33);
    expect(seats(single, 'VOX')).toBe(48);
    expect(seats(congress, 'Sumar')).toBe(31);
    expect(seats(single, 'Sumar')).toBe(48);
  });

  it('barruti bakarrak alderdi ESKUALDEKO guztiak ezabatzen ditu — 28 eserleku', () => {
    // Emaitza hau ez nuen espero, eta hori da interesgarriena.
    //
    // Barruti bakar batean %3ko langa NAZIONALA bihurtzen da, eta alderdi eskualdekoak denak daude
    // azpitik (%0,21etik %1,90era). Beren probintzietan indartsuak izan arren, desagertu egiten
    // dira. Barruti bakarra EZ da "proportzionalagoa" besterik gabe: barrutien tamainaren
    // desproportzionaltasuna LANGAREN bazterketagatik trukatzen du.
    const congress = csvToScenario(readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'));
    const single = mergeAll(congress);

    const seats = (s: Scenario, match: string) => {
      const party = s.parties.find((p) => p.name.includes(match))!;
      return run(s).totals[party.id] ?? 0;
    };

    const regionalists = ['ERC', 'JUNTS', 'EH Bildu', 'EAJ-PNV', 'BNG', 'CCa', 'UPN'];
    const before = regionalists.reduce((sum, p) => sum + seats(congress, p), 0);
    const after = regionalists.reduce((sum, p) => sum + seats(single, p), 0);

    expect(before).toBe(28);
    expect(after).toBe(0);

    // Bost alderdi bakarrik geratzen dira ganberan (PP, PSOE, PSC, Vox, Sumar).
    const withSeats = (s: Scenario) => s.parties.filter((p) => (run(s).totals[p.id] ?? 0) > 0).length;
    expect(withSeats(congress)).toBe(12);
    expect(withSeats(single)).toBe(5);
  });

  it('ERKIDEGOKA da onena: barruti handiak ETA ordezkaritza territoriala', () => {
    // Eta hemen dago ondorio politiko erreala. Erkidegoek bi munduetatik onena hartzen dute:
    // barruti nahikoa handiak proportzionalak izateko, baina alderdi eskualdekoek beren
    // erkidegoan %3a gainditzen dute eta ez dira desagertzen.
    const congress = csvToScenario(readFileSync('datuak/espainiako-kongresua-2023.csv', 'utf8'));

    const provinces = gallagher(congress); // 5,58
    const regions = gallagher(mergeByGroup(congress, (d) => regionOf(d.name))); // 2,64
    const single = gallagher(mergeAll(congress)); // 4,36

    expect(regions).toBeLessThan(provinces);
    expect(regions).toBeLessThan(single);

    // Erkidegoek 12 alderdi mantentzen dituzte, barruti bakarrak bost bezala.
    const byRegion = mergeByGroup(congress, (d) => regionOf(d.name));
    const withSeats = byRegion.parties.filter((p) => (run(byRegion).totals[p.id] ?? 0) > 0);
    expect(withSeats).toHaveLength(12);
  });

  it('bateratzeak legezko langa PIZTU egiten du: alderdi txiki bat gal daiteke', () => {
    // Eusko Legebiltzarraren adibidean, Alderdi Laranjak eserleku bat du 3 barrutirekin (Bizkaian
    // %5 du). Bateratuta, %3,0 nazionala bakarrik du — eta boto zuriak izendatzailean sartuta,
    // %2,96. Langak kanpoan uzten du.
    //
    // Bateratzea ez da beti "hobea": barruti handiagoek berezko langa jaisten dute, baina LEGEZKO
    // langa bizitu egiten dute.
    const merged = mergeAll(DEFAULT_SCENARIO);
    expect(merged.districts).toHaveLength(1);
    expect(merged.districts[0].seats).toBe(75);

    const laranja = DEFAULT_SCENARIO.parties.find((p) => p.abbrev === 'LAR')!;
    expect(run(DEFAULT_SCENARIO).totals[laranja.id]).toBe(1);
    expect(run(merged).totals[laranja.id]).toBe(0);
  });
});

describe('lagungarriak', () => {
  it('barruti bateko botoak batzen ditu (zuriak kanpo)', () => {
    expect(districtVoteTotal(scenario(), 'bat')).toBe(2000);
  });
});
