import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANDIDATE_CONFIG,
  candidateId,
  electedCandidates,
  generateCandidates,
} from './candidates';
import type { CandidateConfig } from './candidates';
import { runListPR } from './systems/listPR';
import type { Party, Scenario, ThresholdConfig } from './types';

const PARTIES: Party[] = [
  { id: 'a', name: 'A', abbrev: 'A', color: '#2a78d6', position: 30 },
  { id: 'b', name: 'B', abbrev: 'B', color: '#e34948', position: 70 },
];

const SCENARIO: Scenario = {
  name: 'proba',
  parties: PARTIES,
  districts: [{ id: 'bat', name: 'Bat', seats: 5 }],
  votes: { bat: { a: 6000, b: 4000 } },
  blankVotes: { bat: 0 },
};

const noThreshold: ThresholdConfig = { percent: 0, scope: 'district', includeBlank: false };
const RESULT = runListPR(SCENARIO, { method: 'dhondt', threshold: noThreshold });

const cfg = (o: Partial<CandidateConfig> = {}): CandidateConfig => ({
  ...DEFAULT_CANDIDATE_CONFIG,
  ...o,
});

describe('hautagaien sorrera', () => {
  it('alderdi bakoitzak barrutiko eserleku adina hautagai ditu', () => {
    const candidates = generateCandidates(SCENARIO, cfg());
    expect(candidates).toHaveLength(2 * 5);
    expect(candidates.filter((c) => c.partyId === 'a')).toHaveLength(5);
  });

  it('deterministikoa da: bi deik emaitza berbera ematen dute', () => {
    const first = generateCandidates(SCENARIO, cfg());
    const second = generateCandidates(SCENARIO, cfg());
    expect(first).toEqual(second);
  });

  it('lehentasun-botoen batura alderdiaren botoak dira', () => {
    const candidates = generateCandidates(SCENARIO, cfg());
    const total = candidates
      .filter((c) => c.partyId === 'a')
      .reduce((sum, c) => sum + c.preferenceVotes, 0);
    // Biribiltzeagatik ±hautagai kopurua.
    expect(Math.abs(total - 6000)).toBeLessThanOrEqual(5);
  });

  it('erabiltzailearen gainidazketak sortutakoa ordezkatzen du', () => {
    const id = candidateId('bat', 'a', 4);
    const candidates = generateCandidates(SCENARIO, cfg({ preferences: { [id]: 99_999 } }));
    expect(candidates.find((c) => c.id === id)!.preferenceVotes).toBe(99_999);
  });
});

describe('zerrenda-motak', () => {
  it('ITXIA: zerrendako ordena hutsa — alderdiak erabakitzen du', () => {
    const candidates = generateCandidates(SCENARIO, cfg({ listMode: 'closed' }));
    const elected = electedCandidates(SCENARIO, RESULT, candidates, cfg({ listMode: 'closed' }));

    const aElected = elected.bat.filter((e) => e.candidate.partyId === 'a');
    expect(aElected.map((e) => e.candidate.listOrder)).toEqual([1, 2, 3]);
    expect(aElected.every((e) => e.wouldBeElectedClosed)).toBe(true);
  });

  it('IREKIA: lehentasun-boto gehien dutenak — hautesleak erabakitzen du', () => {
    // Zerrendako azkena (5.) lehentasun-boto gehien dituenarekin: aurreratu behar du.
    const preferences = {
      [candidateId('bat', 'a', 1)]: 100,
      [candidateId('bat', 'a', 2)]: 200,
      [candidateId('bat', 'a', 3)]: 300,
      [candidateId('bat', 'a', 4)]: 400,
      [candidateId('bat', 'a', 5)]: 5000,
    };
    const c = cfg({ listMode: 'open', preferences });
    const elected = electedCandidates(SCENARIO, RESULT, generateCandidates(SCENARIO, c), c);

    const aOrders = elected.bat
      .filter((e) => e.candidate.partyId === 'a')
      .map((e) => e.candidate.listOrder)
      .sort((x, y) => x - y);

    // A-k 3 eserleku ditu: 5., 4. eta 3. hautagaiak (boto gehienekoak), ez 1. eta 2.
    expect(aOrders).toEqual([3, 4, 5]);

    // 5.a zerrenda itxiarekin EZ litzateke hautatua izango: hor ikusten da mekanismoa.
    const fifth = elected.bat.find((e) => e.candidate.listOrder === 5 && e.candidate.partyId === 'a');
    expect(fifth!.wouldBeElectedClosed).toBe(false);
  });

  it('MALGUA: kuota gainditzen dutenak aurreratzen dira, gainerakoak ordenaz', () => {
    // A-k 6000 boto, 5 eserleku → kuota = 6000/5 × 25% = 300.
    // 5. hautagaiak 5000 ditu (kuota gainditzen du) → aurreratzen da.
    // 4.ak 50 baino ez → ez du aurreratzen, eta ordenaz sartzen da.
    const preferences = {
      [candidateId('bat', 'a', 1)]: 10,
      [candidateId('bat', 'a', 2)]: 10,
      [candidateId('bat', 'a', 3)]: 10,
      [candidateId('bat', 'a', 4)]: 50,
      [candidateId('bat', 'a', 5)]: 5000,
    };
    const c = cfg({ listMode: 'flexible', flexibleQuota: 25, preferences });
    const elected = electedCandidates(SCENARIO, RESULT, generateCandidates(SCENARIO, c), c);

    const aOrders = elected.bat
      .filter((e) => e.candidate.partyId === 'a')
      .map((e) => e.candidate.listOrder);

    // 5.a lehenengo (kuota gainditu du), gero 1. eta 2. zerrendako ordenaz.
    expect(aOrders).toEqual([5, 1, 2]);
  });

  it('zerrenda-motak ez du alderdiaren eserleku KOPURUA aldatzen — hori da funtsa', () => {
    // Geruza hau edozein sistema proportzionalen GAINEAN doa: nor aldatzen du, ez zenbat.
    const counts = (['closed', 'open', 'flexible'] as const).map((listMode) => {
      const c = cfg({ listMode });
      const elected = electedCandidates(SCENARIO, RESULT, generateCandidates(SCENARIO, c), c);
      return elected.bat.filter((e) => e.candidate.partyId === 'a').length;
    });

    expect(counts).toEqual([RESULT.totals.a, RESULT.totals.a, RESULT.totals.a]);
  });

  it('eserlekurik gabeko alderdiak ez du hautagairik hautatuta', () => {
    const c = cfg();
    const elected = electedCandidates(
      SCENARIO,
      { ...RESULT, seatsByDistrict: { bat: { a: 5, b: 0 } } },
      generateCandidates(SCENARIO, c),
      c,
    );
    expect(elected.bat.filter((e) => e.candidate.partyId === 'b')).toHaveLength(0);
    expect(elected.bat).toHaveLength(5);
  });
});
