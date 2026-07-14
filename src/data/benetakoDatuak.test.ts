import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { csvToScenario } from '../core/csv';
import { mergeAll } from '../core/districts';
import { computeIndices } from '../core/indices';
import { runListPR } from '../core/systems/listPR';
import type { ThresholdConfig } from '../core/types';
import { applyKnownParties, findKnownParty } from './knownParties';

/**
 * ONARPEN-PROBA: benetako hauteskundeen emaitza OFIZIALA erreproduzitu.
 *
 * Hau ez da proba bat gehiago. `datuak/` karpetako CSVak iturri ofizialetatik datoz, eta hemen
 * aplikazioaren motorrak, hauteskunde bakoitzaren LEGEZKO ARAUEKIN, ofizialki aldarrikatutako
 * eserleku berberak eman behar ditu — barrutiz barruti eta alderdiz alderdi.
 *
 * Bi gauza egiaztatzen ditu aldi berean:
 *   1. Datuen erauzketa zuzena da (BOE, euskadi.eus, Nafarroako datu irekiak).
 *   2. MOTORRA zuzena da — D'Hondt, langa, boto zurien izendatzailea… dena.
 *
 * 2016tik 2024ra, 3 barrutitik 52ra, 50 eserlekutik 350era. Motorrak akatsen bat balu, hemen
 * agertuko litzateke.
 *
 * Datuak birsortzeko:  node datuak/sortu/*.mjs   (ikus datuak/README.md)
 */

interface Official {
  label: string;
  source: string;
  /** barrutia → alderdiaren izen ofiziala → eserlekuak */
  seats: Record<string, Record<string, number>>;
}

const official: Record<string, Official> = JSON.parse(
  readFileSync('datuak/emaitza-ofizialak.json', 'utf8'),
);

/** Hauteskunde bakoitzaren legezko arauak. Hauek dira "zergatik" garrantzitsua den. */
const RULES: Record<string, { threshold: ThresholdConfig; note: string }> = {
  // Eusko Legebiltzarra: %3 barrutika, boto baliodunen gainean (zuriak barne). 25 eserleku barrutiko.
  'eusko-legebiltzarra-2024.csv': {
    threshold: { percent: 3, scope: 'district', includeBlank: true },
    note: '%3 barrutika, boto zuriak izendatzailean',
  },
  'eusko-legebiltzarra-2020.csv': {
    threshold: { percent: 3, scope: 'district', includeBlank: true },
    note: '%3 barrutika, boto zuriak izendatzailean',
  },
  'eusko-legebiltzarra-2016.csv': {
    threshold: { percent: 3, scope: 'district', includeBlank: true },
    note: '%3 barrutika, boto zuriak izendatzailean',
  },
  // Espainiako Kongresua: %3 PROBINTZIAKA (ez estatu mailan) — hori da gakoa.
  'espainiako-kongresua-2023.csv': {
    threshold: { percent: 3, scope: 'district', includeBlank: true },
    note: '%3 probintziaka, boto zuriak izendatzailean',
  },
  // Nafarroa: barruti bakarra, 50 eserleku, %3.
  'nafarroako-parlamentua-2023.csv': {
    threshold: { percent: 3, scope: 'district', includeBlank: true },
    note: '%3, barruti bakarra',
  },
  // Europako Parlamentua: barruti bakarra eta LANGARIK EZ. Hori berezitasun garrantzitsua da.
  'europako-parlamentua-2024.csv': {
    threshold: { percent: 0, scope: 'district', includeBlank: true },
    note: 'langarik EZ, barruti bakarra',
  },
};

const load = (file: string) =>
  applyKnownParties(csvToScenario(readFileSync(`datuak/${file}`, 'utf8')));

describe('benetako datuak: emaitza ofiziala erreproduzitzen da', () => {
  for (const [file, meta] of Object.entries(official)) {
    const rules = RULES[file];

    it(`${meta.label} — D'Hondt, ${rules.note}`, () => {
      const scenario = load(file);
      const result = runListPR(scenario, { method: 'dhondt', threshold: rules.threshold });

      // Barrutiz barruti, alderdiz alderdi. Guztizkoak bat etortzea ez da nahikoa: barruti batean
      // gehiegi eta bestean gutxiegi izanda ere bat etor litezke.
      for (const district of scenario.districts) {
        const officialSeats = meta.seats[district.name];
        expect(officialSeats, `${district.name} ez dago emaitza ofizialean`).toBeDefined();

        for (const party of scenario.parties) {
          const got = result.seatsByDistrict[district.id]?.[party.id] ?? 0;
          const want = officialSeats[party.name] ?? 0;
          expect(got, `${district.name} / ${party.name}`).toBe(want);
        }
      }
    });
  }
});

describe('datuen osotasuna', () => {
  for (const [file, meta] of Object.entries(official)) {
    it(`${meta.label} — eserlekuak, botoak eta zuriak koherenteak dira`, () => {
      const scenario = load(file);

      // Eserleku ofizialen batura = barrutien eserlekuen batura.
      const declared = scenario.districts.reduce((sum, d) => sum + d.seats, 0);
      const officialTotal = Object.values(meta.seats)
        .flatMap((row) => Object.values(row))
        .reduce((a, b) => a + b, 0);
      expect(officialTotal).toBe(declared);

      // Botorik gabeko hautagaitzarik ez: hala balitz, erauzketak zutabe bat galdu du.
      for (const party of scenario.parties) {
        const total = scenario.districts.reduce(
          (sum, d) => sum + (scenario.votes[d.id]?.[party.id] ?? 0),
          0,
        );
        expect(total, `${party.name}: boto guztiak zero`).toBeGreaterThan(0);
      }

      // Boto zuriak beti daude, eta ez dira negatiboak.
      for (const district of scenario.districts) {
        expect(scenario.blankVotes[district.id], district.name).toBeGreaterThan(0);
      }
    });
  }
});

describe('alderdi ezagunak', () => {
  it('eserlekua lortzen duten alderdi guztiek laburdura eta posizio propioa dute', () => {
    // Posiziorik gabe hemizikloa zutabe-ordenan marraztuko litzateke: zentzugabea.
    // (Eserlekurik lortzen ez dutenak ez dira hemizikloan agertzen, beraz ez dute axola.)
    for (const [file, meta] of Object.entries(official)) {
      const winners = new Set(
        Object.values(meta.seats).flatMap((row) =>
          Object.entries(row)
            .filter(([, seats]) => seats > 0)
            .map(([name]) => name),
        ),
      );

      for (const name of winners) {
        expect(findKnownParty(name), `${file}: "${name}" ez dago knownParties.ts-en`).toBeDefined();
      }
    }
  });
});

describe('zer erakusten duten datu hauek', () => {
  const dhondt = (file: string, percent: number) => {
    const scenario = load(file);
    const result = runListPR(scenario, {
      method: 'dhondt',
      threshold: { percent, scope: 'district', includeBlank: true },
    });
    return { scenario, result, indices: computeIndices(scenario, result) };
  };

  it('boto galduak: neurri NAZIONALAK barruti txikien kostua ezkutatzen du', () => {
    const { indices } = dhondt('espainiako-kongresua-2023.csv', 3);

    // Estatu mailan hautagaitza gutxik galtzen dute dena (%2,5): alderdi handiek nonbait lortzen dute
    // eserlekuren bat. Baina BARRUTIKA begiratuta, hiru aldiz gehiago (%7,9): boto asko probintzia
    // batean galtzen dira, alderdiak beste batean eserlekua lortu arren.
    //
    // Hori da 52 barrutien benetako kostua, eta horregatik daude bi neurriak motorrean.
    expect(indices.wastedVotesPercent).toBeCloseTo(2.5, 0);
    expect(indices.wastedVotesByDistrictPercent).toBeCloseTo(7.9, 0);
    expect(indices.wastedVotesByDistrictPercent).toBeGreaterThan(indices.wastedVotesPercent * 2);
  });

  it('Kongresua barruti bakarrean: boto berberak, legebiltzar oso bestelakoa', () => {
    const { scenario, result } = dhondt('espainiako-kongresua-2023.csv', 3);

    // `mergeAll` erabiltzen dugu — aplikazioan botoi bat da orain, eta hemen bere kontratua
    // (botoak batu, ezer ez galdu) benetako datuen kontra probatzen da.
    const single = mergeAll(scenario);
    const nationwide = runListPR(single, {
      method: 'dhondt',
      threshold: { percent: 3, scope: 'district', includeBlank: true },
    });

    const seats = (r: typeof result, abbrev: string) => {
      const party = scenario.parties.find((p) => p.abbrev === abbrev)!;
      return r.totals[party.id] ?? 0;
    };

    // Vox eta Sumar dira barruti txikien biktima nagusiak: botoak Espainia osoan barreiatuta
    // dituzte, eta probintzia txikietan ez dute inon nahikoa metatzen. Barruti bakarrean ia
    // eserlekuak BIKOIZTU egingo lituzkete.
    expect(seats(result, 'Vox')).toBe(33);
    expect(seats(nationwide, 'Vox')).toBe(48);
    expect(seats(result, 'Sumar')).toBe(31);
    expect(seats(nationwide, 'Sumar')).toBe(48);

    // Eta alderdi handiek galdu egingo lukete: barruti txikiek haiei egiten diete mesede.
    expect(seats(nationwide, 'PP')).toBeLessThan(seats(result, 'PP'));

    expect(computeIndices(single, nationwide).gallagher).toBeLessThan(
      computeIndices(scenario, result).gallagher,
    );
  });

  it('Europako Parlamentuak ez du langarik: %3 ezarrita, alderdiak desagertuko lirateke', () => {
    const withoutThreshold = dhondt('europako-parlamentua-2024.csv', 0);
    const withThreshold = dhondt('europako-parlamentua-2024.csv', 3);

    const count = ({ scenario, result }: typeof withoutThreshold) =>
      scenario.parties.filter((p) => (result.totals[p.id] ?? 0) > 0).length;

    // Errealitatean 9 hautagaitzak lortu zuten eserlekua, langarik ez dagoelako.
    expect(count(withoutThreshold)).toBe(9);
    expect(count(withThreshold)).toBeLessThan(9);
  });
});
