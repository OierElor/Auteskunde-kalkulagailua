import { describe, expect, it } from 'vitest';
import { runMixed } from './mixed';
import type { MixedOptions } from './mixed';
import { SINGLE_MEMBER_SCENARIO } from '../../data/examples';
import type { Party, Scenario, ThresholdConfig } from '../types';

const PARTIES: Party[] = [
  { id: 'a', name: 'A', abbrev: 'A', color: '#2a78d6', position: 20 },
  { id: 'b', name: 'B', abbrev: 'B', color: '#1baf7a', position: 50 },
  { id: 'c', name: 'C', abbrev: 'C', color: '#eda100', position: 80 },
];

const noThreshold: ThresholdConfig = { percent: 0, scope: 'national', includeBlank: false };

const opts = (o: Partial<MixedOptions> = {}): MixedOptions => ({
  compensatory: true,
  listSeats: 10,
  method: 'dhondt',
  threshold: noThreshold,
  overhang: 'keep',
  ballot: 'same',
  ...o,
});

/** `wins` barruti uninominal, bakoitzean emandako alderdiak irabazten duelarik. */
function districts(wins: { winner: string; votes: Record<string, number> }[]): Scenario {
  return {
    name: 'proba',
    parties: PARTIES,
    districts: wins.map((_, i) => ({ id: `d${i}`, name: `D${i}`, seats: 1 })),
    votes: Object.fromEntries(wins.map((w, i) => [`d${i}`, w.votes])),
    blankVotes: Object.fromEntries(wins.map((_, i) => [`d${i}`, 0])),
  };
}

/** A-k barruti guztiak irabazten ditu botoen erdiarekin: overhang sortzeko egoera. */
function overhangScenario(): Scenario {
  // 10 barruti, A-k denak irabazten ditu (%40), baina B eta C-k boto gehiago dituzte guztira.
  return districts(
    Array.from({ length: 10 }, () => ({
      winner: 'a',
      votes: { a: 40, b: 35, c: 25 },
    })),
  );
}

describe('MMM (paraleloa)', () => {
  it('bi mailak bereiz kalkulatzen dira eta batu egiten dira', () => {
    const s = overhangScenario();
    const r = runMixed(s, opts({ compensatory: false, listSeats: 10 }));

    // Maila nominala: A-k 10 barruti.
    expect(r.listTier!.districtWins).toEqual({ a: 10, b: 0, c: 0 });

    // Zerrenda-maila: 10 eserleku proportzionalki (%40/%35/%25), barrutiak KONTUAN HARTU GABE.
    expect(r.listTier!.listSeats).toEqual({ a: 4, b: 4, c: 2 });

    // Guztizkoa: batura hutsa. A-k %40 boto eta eserlekuen %70.
    expect(r.totals).toEqual({ a: 14, b: 4, c: 2 });
    expect(r.totalSeats).toBe(20);
  });

  it('MMM-k EZ du desproportzionaltasuna zuzentzen', () => {
    const s = overhangScenario();
    const mmm = runMixed(s, opts({ compensatory: false }));
    const mmp = runMixed(s, opts({ compensatory: true, overhang: 'fixed' }));

    // Boto berberak, maila berberak — baina lotura egoteak dena aldatzen du.
    expect(mmm.totals.a).toBeGreaterThan(mmp.totals.a);
  });
});

describe('MMP (konpentsatzailea)', () => {
  it('zerrenda-eserlekuek barrutietan irabazitakoa orekatzen dute', () => {
    // 4 barruti bakarrik irabazten ditu A-k; 20ko ganberan %40 = 8 dagokio → 4 zerrenda-eserleku.
    const s = districts([
      ...Array.from({ length: 4 }, () => ({ winner: 'a', votes: { a: 60, b: 25, c: 15 } })),
      ...Array.from({ length: 6 }, () => ({ winner: 'b', votes: { a: 27, b: 42, c: 31 } })),
    ]);
    const r = runMixed(s, opts({ listSeats: 10, overhang: 'keep' }));

    expect(r.listTier!.districtWins).toEqual({ a: 4, b: 6, c: 0 });

    // Guztizkoa proportzionala da: dagokiona jaso du bakoitzak.
    for (const p of PARTIES) {
      expect(r.totals[p.id]).toBe(r.listTier!.entitlement[p.id]);
    }
    expect(r.totalSeats).toBe(20);
    expect(r.listTier!.overhang).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('C-k barrutirik irabazi gabe ere ordezkaritza lortzen du (MMPren funtsa)', () => {
    const s = overhangScenario();
    const r = runMixed(s, opts({ overhang: 'leveling' }));
    expect(r.listTier!.districtWins.c).toBe(0);
    expect(r.totals.c).toBeGreaterThan(0);
  });
});

describe('overhang: hiru irtenbideak', () => {
  // A-k 10 barrutiak irabazten ditu (%40 botoekin). 20ko ganberan %40 = 8 dagokio.
  // Baina 10 irabazi ditu → 2 overhang. Zerbait hautsi behar da.

  it('KEEP: A-k 10 mantentzen ditu eta ganbera hazi egiten da', () => {
    const r = runMixed(overhangScenario(), opts({ overhang: 'keep', listSeats: 10 }));
    const tier = r.listTier!;

    expect(tier.entitlement.a).toBe(8);
    expect(tier.overhang.a).toBe(2);
    expect(tier.listSeats.a).toBe(0);
    expect(r.totals.a).toBe(10);

    // Besteek dagokiena jasotzen dute; ganbera 20tik 22ra hazi da.
    expect(r.totals.b).toBe(tier.entitlement.b);
    expect(r.totalSeats).toBe(22);
    expect(tier.nominalSize).toBe(20);
  });

  it('LEVELING: orekatze-eserlekuak gehitzen dira A-ren %40 errespetatu arte', () => {
    const r = runMixed(overhangScenario(), opts({ overhang: 'leveling', listSeats: 10 }));
    const tier = r.listTier!;

    // Ganbera hazten da A-ri gutxienez 10 dagokion arte. %40rekin, 25eko ganbera behar da.
    expect(tier.entitlement.a).toBeGreaterThanOrEqual(tier.districtWins.a);
    expect(tier.levelingSeats).toBeGreaterThan(0);
    expect(r.totalSeats).toBe(tier.chamberSize);

    // Emaitza PROPORTZIONALA da: A-k eserlekuen ~%40 du, ez %50.
    const share = (r.totals.a / r.totalSeats) * 100;
    expect(share).toBeGreaterThan(36);
    expect(share).toBeLessThan(44);
  });

  it('FIXED: ganberak ez du hazten; besteek konpentsazio gutxiago dute', () => {
    const r = runMixed(overhangScenario(), opts({ overhang: 'fixed', listSeats: 10 }));
    const tier = r.listTier!;

    // Ganbera zehazki nominala da — hau da erregelaren muina.
    expect(r.totalSeats).toBe(20);
    expect(tier.chamberSize).toBe(20);

    // A-k bere 10 barrutiak mantentzen ditu, zerrenda-eserlekurik gabe.
    expect(r.totals.a).toBe(10);
    expect(tier.listSeats.a).toBe(0);

    // Gainerako 10 eserlekuak B eta C-ren artean banatzen dira.
    expect(r.totals.b + r.totals.c).toBe(10);
  });

  it('hiru erregelek A-ren barrutiak errespetatzen dituzte: irabazitakoa ez da kentzen', () => {
    for (const overhang of ['keep', 'leveling', 'fixed'] as const) {
      const r = runMixed(overhangScenario(), opts({ overhang }));
      expect(r.totals.a, overhang).toBeGreaterThanOrEqual(r.listTier!.districtWins.a);
    }
  });

  it('proportzionaltasuna: leveling > keep > fixed', () => {
    // Hau da hiru erregelen arteko benetako aldea, zenbakitan.
    const share = (rule: 'keep' | 'leveling' | 'fixed') => {
      const r = runMixed(overhangScenario(), opts({ overhang: rule }));
      return (r.totals.a / r.totalSeats) * 100; // A-k botoen %40 du
    };
    expect(share('leveling')).toBeLessThan(share('keep'));
    expect(share('keep')).toBeLessThanOrEqual(share('fixed'));
  });
});

describe('langa zerrenda-mailan', () => {
  it('langa nazionala da, ez barrutikoa', () => {
    const s = overhangScenario();
    const r = runMixed(s, opts({ threshold: { percent: 30, scope: 'district', includeBlank: false } }));
    // C-k %25 du nazionalki → %30eko langatik kanpo, barrutika ez balitz ere.
    expect(r.listTier!.excluded).toContain('c');
    expect(r.listTier!.listSeats.c).toBe(0);
  });

  it('langatik kanpo geratu arren, irabazitako barrutiak MANTENTZEN dira', () => {
    // C-k barruti bat irabazten du, baina nazionalki langaren azpitik dago.
    const s = districts([
      ...Array.from({ length: 9 }, () => ({ winner: 'a', votes: { a: 50, b: 45, c: 1 } })),
      { winner: 'c', votes: { a: 10, b: 10, c: 30 } },
    ]);
    const r = runMixed(s, opts({ threshold: { percent: 10, scope: 'national', includeBlank: false }, overhang: 'fixed' }));

    expect(r.listTier!.excluded).toContain('c');
    expect(r.listTier!.districtWins.c).toBe(1);
    expect(r.totals.c).toBe(1); // Barrutia gordetzen du, zerrenda-eserlekurik gabe.
    expect(r.totalSeats).toBe(20);
  });
});

describe('inbarianteak', () => {
  it('FIXED: guztizkoa beti da barrutiak + zerrenda-poltsa', () => {
    for (const listSeats of [0, 1, 5, 25, 75, 150]) {
      const r = runMixed(SINGLE_MEMBER_SCENARIO, opts({ overhang: 'fixed', listSeats }));
      expect(r.totalSeats, `${listSeats}`).toBe(75 + listSeats);
    }
  });

  it('MMM: guztizkoa beti da barrutiak + zerrenda-poltsa', () => {
    for (const listSeats of [0, 10, 75, 200]) {
      const r = runMixed(SINGLE_MEMBER_SCENARIO, opts({ compensatory: false, listSeats }));
      expect(r.totalSeats, `${listSeats}`).toBe(75 + listSeats);
    }
  });

  it('KEEP eta LEVELING: ganbera ez da inoiz nominala baino txikiagoa', () => {
    for (const overhang of ['keep', 'leveling'] as const) {
      for (const listSeats of [5, 25, 75]) {
        const r = runMixed(SINGLE_MEMBER_SCENARIO, opts({ overhang, listSeats }));
        expect(r.totalSeats, `${overhang}/${listSeats}`).toBeGreaterThanOrEqual(75 + listSeats);
      }
    }
  });

  it('metodo guztiekin funtzionatzen du eta eserlekuak ez dira galtzen', () => {
    for (const method of ['dhondt', 'sainte-lague', 'hare', 'droop'] as const) {
      const r = runMixed(SINGLE_MEMBER_SCENARIO, opts({ method, overhang: 'fixed', listSeats: 25 }));
      const given = Object.values(r.totals).reduce((a, b) => a + b, 0);
      expect(given, method).toBe(100);
    }
  });
});

describe('bigarren botoa', () => {
  it('bigarren botoa erabiltzen du zerrenda-mailan, lehen botoa barrutietan', () => {
    const s = overhangScenario();
    // Boto banatua: barrutietan A bozkatzen dute, zerrendan C.
    s.secondVotes = Object.fromEntries(
      s.districts.map((d) => [d.id, { a: 10, b: 30, c: 60 }]),
    );

    const r = runMixed(s, opts({ ballot: 'second', compensatory: false, listSeats: 10 }));

    // Barrutiak lehen botoarekin: A-k denak.
    expect(r.listTier!.districtWins.a).toBe(10);
    // Zerrenda bigarren botoarekin: C nagusi.
    expect(r.listTier!.listSeats.c).toBeGreaterThan(r.listTier!.listSeats.a);
  });

  it('bigarren botorik ez badago, lehen botoa erabiltzen du eta abisatzen du', () => {
    const r = runMixed(overhangScenario(), opts({ ballot: 'second' }));
    expect(r.warnings.map((w) => w.kind)).toContain('no-second-vote');
  });
});
