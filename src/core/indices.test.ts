import { describe, expect, it } from 'vitest';
import { computeIndices } from './indices';
import { runListPR } from './systems/listPR';
import type { Party, Scenario, ThresholdConfig } from './types';

const PARTIES: Party[] = [
  { id: 'a', name: 'A', abbrev: 'A', color: '#2a78d6', position: 20 },
  { id: 'b', name: 'B', abbrev: 'B', color: '#1baf7a', position: 50 },
  { id: 'c', name: 'C', abbrev: 'C', color: '#eda100', position: 80 },
];

function build(votes: Record<string, number>, seats: number): Scenario {
  return {
    name: 'proba',
    parties: PARTIES,
    districts: [{ id: 'bat', name: 'Bat', seats }],
    votes: { bat: votes },
    blankVotes: { bat: 0 },
  };
}

const noThreshold: ThresholdConfig = { percent: 0, scope: 'district', includeBlank: false };
const run = (s: Scenario) => runListPR(s, { method: 'dhondt', threshold: noThreshold });

describe('proportzionaltasun-indizeak', () => {
  it('banaketa perfektua → Gallagher 0', () => {
    // 50/30/20 botoak eta 5/3/2 eserlekuak: boto-ehunekoak eta eserleku-ehunekoak berdinak.
    const s = build({ a: 50, b: 30, c: 20 }, 10);
    const idx = computeIndices(s, run(s));
    expect(idx.gallagher).toBeCloseTo(0, 6);
    expect(idx.loosemoreHanby).toBeCloseTo(0, 6);
  });

  it('desproportzionaltasunak Gallagher igotzen du', () => {
    const s = build({ a: 40, b: 35, c: 25 }, 3);
    const result = run(s);
    // D'Hondt-ek 3 eserleku bakarrik ditu: %33,3 bakoitza, botoak %40/%35/%25 direnean.
    expect(result.totals).toEqual({ a: 1, b: 1, c: 1 });
    const idx = computeIndices(s, result);
    expect(idx.gallagher).toBeGreaterThan(0);
    // Eskuz: desbideratzeak -6,67 / -1,67 / +8,33 → sqrt(0,5·(44,4+2,8+69,4)) = 7,65
    expect(idx.gallagher).toBeCloseTo(7.64, 1);
  });

  it('abantaila-ratioa: >1 = mesede egiten dio sistemak', () => {
    const s = build({ a: 55, b: 35, c: 10 }, 5);
    const result = run(s);
    const idx = computeIndices(s, result);
    const a = idx.parties.find((p) => p.partyId === 'a')!;
    const c = idx.parties.find((p) => p.partyId === 'c')!;
    expect(result.totals).toEqual({ a: 3, b: 2, c: 0 });
    // a: botoen %55, eserlekuen %60 → 1,09
    expect(a.advantage!).toBeCloseTo(60 / 55, 6);
    expect(c.advantage!).toBe(0);
  });

  it('alferrik galdutako botoak: eserlekurik gabeko alderdienak', () => {
    const s = build({ a: 55, b: 35, c: 10 }, 5);
    const idx = computeIndices(s, run(s));
    expect(idx.wastedVotes).toBe(10);
    expect(idx.wastedVotesPercent).toBeCloseTo(10, 6);
  });

  it('barrutika galdutako botoak handiagoak dira: barruti txikien benetako kostua', () => {
    const districts = Array.from({ length: 3 }, (_, i) => ({
      id: `d${i}`,
      name: `B${i}`,
      seats: 3,
    }));
    const votes: Scenario['votes'] = {};
    const blankVotes: Scenario['blankVotes'] = {};
    for (const d of districts) {
      votes[d.id] = { a: 50, b: 30, c: 20 };
      blankVotes[d.id] = 0;
    }
    const s: Scenario = { name: 'x', parties: PARTIES, districts, votes, blankVotes };
    const result = run(s);
    const idx = computeIndices(s, result);

    // c-k ez du eserlekurik lortzen inon → bere boto guztiak galdu dira, bi neurrietan.
    expect(result.totals.c).toBe(0);
    expect(idx.wastedVotes).toBe(60);
    // Barrutika ere 60 dira hemen (c bakarrik geratu da hutsik barruti guztietan).
    expect(idx.wastedVotesByDistrict).toBe(60);
  });

  it('alderdi eraginkorren kopurua', () => {
    // Bi alderdi berdin → 2,0 zehatz.
    const s = build({ a: 50, b: 50, c: 0 }, 10);
    const idx = computeIndices(s, run(s));
    expect(idx.enpVotes).toBeCloseTo(2, 6);
    expect(idx.enpSeats).toBeCloseTo(2, 6);
  });
});
