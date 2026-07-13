import { describe, expect, it } from 'vitest';
import { layoutHemicycle } from './hemicycle';

describe('hemizikloaren geometria', () => {
  it('eserleku guztiak kokatzen ditu, kopurua edozein dela ere', () => {
    for (const n of [1, 2, 3, 5, 9, 25, 35, 49, 50, 75, 100, 135, 176, 350, 600, 751]) {
      expect(layoutHemicycle(n).seats, `${n} eserleku`).toHaveLength(n);
    }
  });

  it('0 eserleku → hutsik, erroririk gabe', () => {
    expect(layoutHemicycle(0).seats).toHaveLength(0);
    expect(layoutHemicycle(-5).seats).toHaveLength(0);
  });

  it('eserlekuak ezkerretik eskuinera datoz ordenatuta', () => {
    const { seats } = layoutHemicycle(75);
    for (let i = 1; i < seats.length; i++) {
      expect(seats[i].angle).toBeLessThanOrEqual(seats[i - 1].angle);
    }
    // Lehena ezkerrean (x negatiboa), azkena eskuinean (x positiboa).
    expect(seats[0].x).toBeLessThan(0);
    expect(seats[seats.length - 1].x).toBeGreaterThan(0);
  });

  it('eserleku guztiak goiko erdian daude (hemizikloa, ez zirkulua)', () => {
    const { seats, outerRadius, innerRadius } = layoutHemicycle(120);
    for (const s of seats) {
      expect(s.y).toBeLessThanOrEqual(0);
      const r = Math.hypot(s.x, s.y);
      expect(r).toBeGreaterThanOrEqual(innerRadius - 0.001);
      expect(r).toBeLessThanOrEqual(outerRadius + 0.001);
    }
  });

  it('bolatxoak ez dira gainjartzen: hutsunea uzten dute', () => {
    const { seats, seatRadius } = layoutHemicycle(75);
    let closest = Infinity;
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        closest = Math.min(closest, Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y));
      }
    }
    expect(closest).toBeGreaterThan(2 * seatRadius);
  });

  it('eserleku gehiagok errenkada gehiago dakartza', () => {
    expect(layoutHemicycle(9).rows).toBeLessThan(layoutHemicycle(350).rows);
  });
});
