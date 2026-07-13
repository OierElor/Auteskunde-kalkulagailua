import { describe, expect, it } from 'vitest';
import { ALL_METHODS, allocate } from './allocate';
import type { MethodId, PartyId } from './types';

/**
 * Adibide kanonikoa (Wikipediako D'Hondt/Sainte-Laguë konparazio-taula): lau alderdi, 8 eserleku.
 * Datu berberak metodo guztietan erabiltzen ditugu, emaitzen arteko aldea agerian gera dadin.
 */
const VOTES = { a: 100_000, b: 80_000, c: 30_000, d: 20_000 };
const PARTIES: PartyId[] = ['a', 'b', 'c', 'd'];

describe('zatitzaile-metodoak', () => {
  it("D'Hondt: alderdi handiei mesede", () => {
    const { seats } = allocate(VOTES, 8, 'dhondt', PARTIES);
    expect(seats).toEqual({ a: 4, b: 3, c: 1, d: 0 });
  });

  it('Sainte-Laguë: alderdi txiki bat sartzen da', () => {
    const { seats } = allocate(VOTES, 8, 'sainte-lague', PARTIES);
    expect(seats).toEqual({ a: 3, b: 3, c: 1, d: 1 });
  });

  it('Huntington-Hill: alderdi bakoitzak lehen eserlekua hartzen du inork bigarrena hartu aurretik', () => {
    const { seats } = allocate({ a: 100, b: 10, c: 1 }, 3, 'huntington-hill', ['a', 'b', 'c']);
    expect(seats).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('Huntington-Hill: alderdi baino eserleku gutxiago badago, abisua ematen du', () => {
    const { warnings } = allocate({ a: 100, b: 10, c: 1 }, 2, 'huntington-hill', ['a', 'b', 'c']);
    expect(warnings.map((w) => w.kind)).toContain('more-parties-than-seats');
  });

  it('zatidurak eserlekuen ordena zuzenean gordetzen ditu', () => {
    const { detail } = allocate(VOTES, 3, 'dhondt', PARTIES);
    if (detail.kind !== 'divisor') throw new Error('zatitzaile-xehetasuna espero zen');
    expect(detail.steps.map((s) => s.partyId)).toEqual(['a', 'b', 'a']);
    expect(detail.steps[2].quotient).toBe(50_000);
    expect(detail.steps[2].seatForParty).toBe(2);
  });
});

describe('kuota-metodoak (hondar handiena)', () => {
  it('Hare: Sainte-Laguëren emaitza berbera datu hauekin', () => {
    const { seats } = allocate(VOTES, 8, 'hare', PARTIES);
    expect(seats).toEqual({ a: 3, b: 3, c: 1, d: 1 });
  });

  it("Droop: kuota txikiagoa, D'Hondt-en emaitza berbera datu hauekin", () => {
    const { seats } = allocate(VOTES, 8, 'droop', PARTIES);
    expect(seats).toEqual({ a: 4, b: 3, c: 1, d: 0 });
  });

  it('Hare kuota zuzen kalkulatzen da', () => {
    const { detail } = allocate(VOTES, 8, 'hare', PARTIES);
    if (detail.kind !== 'quota') throw new Error('kuota-xehetasuna espero zen');
    expect(detail.quota).toBe(230_000 / 8);
    expect(detail.automatic).toEqual({ a: 3, b: 2, c: 1, d: 0 });
    expect(detail.remainderSeats).toEqual({ a: 0, b: 1, c: 0, d: 1 });
  });

  it('Imperiali kuotak gehiegi esleitzen duenean, Droop-era itzultzen da', () => {
    // V=100, S=3 → Imperiali kuota = 100/5 = 20 → 2+1+1 = 4 eserleku, 3 baino ez daudenean.
    const { seats, detail, warnings } = allocate(
      { a: 50, b: 30, c: 20 },
      3,
      'imperiali-quota',
      ['a', 'b', 'c'],
    );
    if (detail.kind !== 'quota') throw new Error('kuota-xehetasuna espero zen');
    expect(detail.effectiveMethod).toBe('droop');
    expect(warnings.map((w) => w.kind)).toContain('quota-fallback');
    expect(seats.a + seats.b + seats.c).toBe(3);
  });
});

describe('berdinketak', () => {
  it('emaitza aldatzen duen berdinketa abisatzen da', () => {
    // Bi alderdi berdin-berdinak, eserleku bakarra: bietako batek galdu behar du.
    const { warnings } = allocate({ a: 100, b: 100 }, 1, 'dhondt', ['a', 'b']);
    expect(warnings.map((w) => w.kind)).toContain('tie');
  });

  it('emaitza aldatzen EZ duen berdinketa ez da abisatzen', () => {
    // Berdinduta daude, baina biek hartzen dute eserlekua: ordena hutsala da.
    const { seats, warnings } = allocate({ a: 100, b: 100 }, 2, 'dhondt', ['a', 'b']);
    expect(seats).toEqual({ a: 1, b: 1 });
    expect(warnings.filter((w) => w.kind === 'tie')).toHaveLength(0);
  });

  it('zatidura berdinduta, boto gehien dituenak irabazten du', () => {
    // b-k zatidura berbera du (200/2 = 100) baina boto gehiago: berak hartzen du eserlekua.
    const { seats } = allocate({ a: 100, b: 200 }, 2, 'dhondt', ['a', 'b']);
    expect(seats).toEqual({ a: 0, b: 2 });
  });

  it('boto berdinekin, alderdi-zerrendako ordenak erabakitzen du (emaitza egonkorra)', () => {
    const { seats } = allocate({ lehena: 100, bigarrena: 100 }, 1, 'dhondt', ['lehena', 'bigarrena']);
    expect(seats).toEqual({ lehena: 1, bigarrena: 0 });
  });
});

describe('inbariantea: esleitutako eserlekuak beti bat datoz eskuragarriekin', () => {
  const cases: { votes: Record<PartyId, number>; seats: number }[] = [
    { votes: VOTES, seats: 8 },
    { votes: VOTES, seats: 1 },
    { votes: VOTES, seats: 75 },
    { votes: { a: 1 }, seats: 25 },
    { votes: { a: 1, b: 1, c: 1, d: 1 }, seats: 7 },
    { votes: { a: 999_983, b: 7, c: 3, d: 1 }, seats: 25 },
    { votes: { a: 33, b: 33, c: 33, d: 1 }, seats: 9 },
  ];

  for (const method of ALL_METHODS as MethodId[]) {
    it(`${method}`, () => {
      for (const { votes, seats } of cases) {
        const parties = Object.keys(votes);
        const out = allocate(votes, seats, method, parties);
        const given = Object.values(out.seats).reduce((a, b) => a + b, 0);
        expect(given, `${method}, ${seats} eserleku, ${JSON.stringify(votes)}`).toBe(seats);
        for (const p of parties) expect(out.seats[p]).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe('muturreko kasuak', () => {
  it('0 eserleku → esleipenik ez', () => {
    for (const method of ALL_METHODS) {
      const { seats } = allocate(VOTES, 0, method, PARTIES);
      expect(Object.values(seats).every((s) => s === 0)).toBe(true);
    }
  });

  it('botorik ez → eserlekuak bete gabe, abisuarekin', () => {
    for (const method of ALL_METHODS) {
      const { seats, warnings } = allocate({ a: 0, b: 0 }, 5, method, ['a', 'b']);
      expect(seats).toEqual({ a: 0, b: 0 });
      expect(warnings.map((w) => w.kind)).toContain('unfilled-seats');
    }
  });

  it('botorik gabeko alderdiak ez du inoiz eserlekurik hartzen', () => {
    for (const method of ALL_METHODS) {
      const { seats } = allocate({ a: 100, b: 0 }, 5, method, ['a', 'b']);
      expect(seats.b, method).toBe(0);
      expect(seats.a, method).toBe(5);
    }
  });
});
