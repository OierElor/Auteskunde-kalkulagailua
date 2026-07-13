import { describe, expect, it } from 'vitest';
import { coalitionSeats, majorityThreshold, minimalWinningCoalitions } from './coalitions';

describe('gehiengo absolutua', () => {
  it('bakoitiak: erdia gora biribilduta', () => {
    expect(majorityThreshold(75)).toBe(38); // Eusko Legebiltzarra
    expect(majorityThreshold(1)).toBe(1);
  });

  it('bikoitiak: erdia + 1 (berdinketak ez du balio)', () => {
    expect(majorityThreshold(350)).toBe(176); // Espainiako Kongresua
    expect(majorityThreshold(50)).toBe(26);
  });
});

describe('koalizioak', () => {
  const totals = { a: 30, b: 20, c: 15, d: 8, e: 2 }; // 75 eserleku, gehiengoa 38

  it('koalizio baten eserlekuak batzen dira', () => {
    expect(coalitionSeats(['a', 'b'], totals)).toBe(50);
    expect(coalitionSeats([], totals)).toBe(0);
  });

  it('gutxieneko koalizio irabazleak: kide guztiak ezinbestekoak dira', () => {
    const found = minimalWinningCoalitions(totals, ['a', 'b', 'c', 'd', 'e']);
    for (const coalition of found) {
      expect(coalition.seats).toBeGreaterThanOrEqual(38);
      for (const p of coalition.parties) {
        // Kide bat kenduta, gehiengoa galdu behar da: bestela ez litzateke minimoa izango.
        expect(coalition.seats - totals[p as keyof typeof totals]).toBeLessThan(38);
      }
    }
  });

  it('gehiegizko kidea duen koalizioa ez da zerrendatzen', () => {
    const found = minimalWinningCoalitions(totals, ['a', 'b', 'c', 'd', 'e']);
    const keys = found.map((c) => c.parties.join('+'));
    // a+b = 50 ≥ 38 eta minimoa da (a gabe 20, b gabe 30 → biak beharrezkoak).
    expect(keys).toContain('a+b');
    // a+b+c = 65: c soberan dago, a+b-k bakarrik gehiengoa baitu.
    expect(keys).not.toContain('a+b+c');
  });

  it('kide gutxien dituztenak lehenengo datoz', () => {
    const found = minimalWinningCoalitions(totals, ['a', 'b', 'c', 'd', 'e']);
    const sizes = found.map((c) => c.parties.length);
    expect(sizes).toEqual([...sizes].sort((x, y) => x - y));
  });

  it('alderdi bakar batek gehiengoa badu, bera da koalizio bakarra', () => {
    const found = minimalWinningCoalitions({ a: 40, b: 30, c: 5 }, ['a', 'b', 'c']);
    expect(found[0]).toEqual({ parties: ['a'], seats: 40 });
  });

  it('eserlekurik gabeko alderdiak ez dira kontuan hartzen', () => {
    const found = minimalWinningCoalitions({ a: 30, b: 20, c: 0 }, ['a', 'b', 'c']);
    expect(found.every((coalition) => !coalition.parties.includes('c'))).toBe(true);
  });
});
