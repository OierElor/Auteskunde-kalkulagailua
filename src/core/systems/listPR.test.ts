import { describe, expect, it } from 'vitest';
import { runListPR } from './listPR';
import { ALL_METHODS } from '../allocate';
import type { Party, Scenario, ThresholdConfig } from '../types';

const PARTIES: Party[] = [
  { id: 'a', name: 'A', abbrev: 'A', color: '#2a78d6', position: 10 },
  { id: 'b', name: 'B', abbrev: 'B', color: '#1baf7a', position: 40 },
  { id: 'c', name: 'C', abbrev: 'C', color: '#eda100', position: 70 },
  { id: 'd', name: 'D', abbrev: 'D', color: '#008300', position: 90 },
];

const PER_DISTRICT = { a: 45_000, b: 35_000, c: 10_000, d: 10_000 };

/** 5 barruti × 5 eserleku: 25 eserleku guztira. */
function fragmented(): Scenario {
  const districts = Array.from({ length: 5 }, (_, i) => ({
    id: `d${i}`,
    name: `Barruti ${i + 1}`,
    seats: 5,
  }));
  const votes: Scenario['votes'] = {};
  const blankVotes: Scenario['blankVotes'] = {};
  for (const d of districts) {
    votes[d.id] = { ...PER_DISTRICT };
    blankVotes[d.id] = 0;
  }
  return { name: 'zatikatua', parties: PARTIES, districts, votes, blankVotes };
}

/** Barruti bakarra, 25 eserleku, boto berberak guztira. */
function single(): Scenario {
  return {
    name: 'bakarra',
    parties: PARTIES,
    districts: [{ id: 'bat', name: 'Estatua', seats: 25 }],
    votes: { bat: { a: 225_000, b: 175_000, c: 50_000, d: 50_000 } },
    blankVotes: { bat: 0 },
  };
}

const noThreshold: ThresholdConfig = { percent: 0, scope: 'district', includeBlank: false };

describe('barruti-magnitudearen eragina', () => {
  it('barruti txikiek alderdi txikiak ezabatzen dituzte, langarik gabe ere', () => {
    // Hau da aplikazioaren funtsezko erakustaldia: boto BERBERAK, eserleku kopuru BERBERA,
    // metodo BERBERA eta langarik EZ — baina emaitza guztiz desberdina, barrutien tamainagatik.
    const many = runListPR(fragmented(), { method: 'dhondt', threshold: noThreshold });
    const one = runListPR(single(), { method: 'dhondt', threshold: noThreshold });

    // 5 eserlekuko barrutietan %10eko alderdiak ezin du ezer: barruti bakoitzeko "benetako langa"
    // ~%17 da, inork langarik ezarri gabe.
    expect(many.totals).toEqual({ a: 15, b: 10, c: 0, d: 0 });

    // Barruti bakar batean, aldiz, ordezkaritza lortzen dute.
    expect(one.totals).toEqual({ a: 12, b: 9, c: 2, d: 2 });

    expect(many.totalSeats).toBe(25);
    expect(one.totalSeats).toBe(25);
  });
});

describe('langa barruti anitzetan', () => {
  it('kanporatutako alderdiak barrutika jasotzen dira', () => {
    const s = single();
    s.votes.bat = { a: 225_000, b: 175_000, c: 50_000, d: 8_000 };
    const result = runListPR(s, {
      method: 'dhondt',
      threshold: { percent: 3, scope: 'district', includeBlank: false },
    });
    // d-k %1,7 baino ez du (8.000 / 458.000) → langak kanpoan uzten du.
    expect(result.districts[0].excluded).toEqual(['d']);
    expect(result.totals.d).toBe(0);
  });

  it('kanporatuen botoak ez dira esleipenean sartzen', () => {
    const s = single();
    s.votes.bat = { a: 225_000, b: 175_000, c: 50_000, d: 8_000 };
    const result = runListPR(s, {
      method: 'hare',
      threshold: { percent: 3, scope: 'district', includeBlank: false },
    });
    const detail = result.districts[0].detail;
    if (detail.kind !== 'quota') throw new Error('kuota-xehetasuna espero zen');
    // Kuota langa gainditu dutenen botoen gainean kalkulatzen da: 450.000 / 25, ez 458.000 / 25.
    expect(detail.quota).toBe(450_000 / 25);
  });
});

describe('inbariantea barruti anitzetan', () => {
  it('metodo guztietan, esleitutako eserlekuak = barruti guztien eserlekuak', () => {
    for (const method of ALL_METHODS) {
      for (const s of [fragmented(), single()]) {
        const result = runListPR(s, { method, threshold: noThreshold });
        const given = Object.values(result.totals).reduce((a, b) => a + b, 0);
        expect(given, `${method} / ${s.name}`).toBe(result.totalSeats);

        for (const d of s.districts) {
          const inDistrict = Object.values(result.seatsByDistrict[d.id]).reduce((a, b) => a + b, 0);
          expect(inDistrict, `${method} / ${d.name}`).toBe(d.seats);
        }
      }
    }
  });

  it('alderdi guztiek sarrera dute emaitzan, 0 eserlekurekin ere', () => {
    const result = runListPR(fragmented(), { method: 'dhondt', threshold: noThreshold });
    expect(Object.keys(result.totals).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(result.seatsByDistrict.d0.c).toBe(0);
  });
});
