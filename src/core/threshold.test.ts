import { describe, expect, it } from 'vitest';
import { districtValidVotes, effectiveThreshold, eligibleParties, excludedParties } from './threshold';
import type { Scenario, ThresholdConfig } from './types';

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    name: 'proba',
    parties: [
      { id: 'handia', name: 'Handia', abbrev: 'H', color: '#2a78d6', position: 20 },
      { id: 'ertaina', name: 'Ertaina', abbrev: 'E', color: '#1baf7a', position: 50 },
      { id: 'txikia', name: 'Txikia', abbrev: 'T', color: '#eda100', position: 80 },
    ],
    districts: [{ id: 'bat', name: 'Bat', seats: 10 }],
    votes: { bat: { handia: 60_000, ertaina: 37_000, txikia: 3_000 } },
    blankVotes: { bat: 0 },
    ...overrides,
  };
}

const cfg = (o: Partial<ThresholdConfig> = {}): ThresholdConfig => ({
  percent: 3,
  scope: 'district',
  includeBlank: false,
  ...o,
});

describe('langa', () => {
  it('%3 zehazki → sartu egiten da (>= da, ez >)', () => {
    // 3.000 / 100.000 = %3,0 zehatz-zehatz.
    expect(eligibleParties(scenario(), 'bat', cfg())).toContain('txikia');
  });

  it('%3ren azpitik → kanpoan', () => {
    const s = scenario({ votes: { bat: { handia: 60_000, ertaina: 37_100, txikia: 2_900 } } });
    expect(eligibleParties(s, 'bat', cfg())).not.toContain('txikia');
    expect(excludedParties(s, 'bat', cfg())).toEqual(['txikia']);
  });

  it('langa 0 → denak sartzen dira', () => {
    const s = scenario({ votes: { bat: { handia: 60_000, ertaina: 37_000, txikia: 1 } } });
    expect(eligibleParties(s, 'bat', cfg({ percent: 0 }))).toHaveLength(3);
  });

  it('botorik gabeko alderdia ez da "kanporatua": ez zegoen lehian', () => {
    const s = scenario({ votes: { bat: { handia: 60_000, ertaina: 40_000, txikia: 0 } } });
    expect(excludedParties(s, 'bat', cfg())).toEqual([]);
    expect(eligibleParties(s, 'bat', cfg())).not.toContain('txikia');
  });
});

describe('boto zuriak', () => {
  it('boto zuriek langa altxatzen dute, alderdi txikia kanpoan utziz', () => {
    // Alderdiei emandako botoen %3,0 zehatza da txikia. Boto zuriak izendatzailean sartuz,
    // 3.000 / 105.000 = %2,86 → kanpoan. Hau da Espainiako/Euskadiko legearen jokabidea.
    const s = scenario({ blankVotes: { bat: 5_000 } });

    expect(eligibleParties(s, 'bat', cfg({ includeBlank: false }))).toContain('txikia');
    expect(eligibleParties(s, 'bat', cfg({ includeBlank: true }))).not.toContain('txikia');
  });

  it('boto baliodunetan zuriak zenbatzen dira, eskatuz gero', () => {
    const s = scenario({ blankVotes: { bat: 5_000 } });
    expect(districtValidVotes(s, 'bat', false)).toBe(100_000);
    expect(districtValidVotes(s, 'bat', true)).toBe(105_000);
  });
});

describe('langaren esparrua', () => {
  const multi = scenario({
    districts: [
      { id: 'bat', name: 'Bat', seats: 10 },
      { id: 'bi', name: 'Bi', seats: 10 },
    ],
    votes: {
      // "txikia" indartsua da 'bat'-en (%10), baina estatu mailan ahula (%1,05).
      bat: { handia: 8_000, ertaina: 1_000, txikia: 1_000 },
      bi: { handia: 50_000, ertaina: 34_900, txikia: 100 },
    },
    blankVotes: { bat: 0, bi: 0 },
  });

  it('barrutika: alderdi txiki lokala sartzen da bere barrutian', () => {
    expect(eligibleParties(multi, 'bat', cfg({ scope: 'district' }))).toContain('txikia');
    expect(eligibleParties(multi, 'bi', cfg({ scope: 'district' }))).not.toContain('txikia');
  });

  it('estatu mailan: alderdi txiki lokala barruti guztietatik kanpo geratzen da', () => {
    expect(eligibleParties(multi, 'bat', cfg({ scope: 'national' }))).not.toContain('txikia');
    expect(eligibleParties(multi, 'bi', cfg({ scope: 'national' }))).not.toContain('txikia');
  });
});

describe('barrutiaren langa propioa', () => {
  it('barrutiaren langak globala gainidazten du', () => {
    const s = scenario({ districts: [{ id: 'bat', name: 'Bat', seats: 10, threshold: 5 }] });
    expect(effectiveThreshold(s, 'bat', cfg({ percent: 3 }))).toBe(5);
    expect(eligibleParties(s, 'bat', cfg({ percent: 3 }))).not.toContain('txikia');
  });

  it('estatu mailako esparruan barrutiaren langak ez du eraginik', () => {
    const s = scenario({ districts: [{ id: 'bat', name: 'Bat', seats: 10, threshold: 5 }] });
    expect(effectiveThreshold(s, 'bat', cfg({ percent: 3, scope: 'national' }))).toBe(3);
  });
});
