import { describe, expect, it } from 'vitest';
import { heroLayout, heroTextExtent, layoutHemicycle } from './hemicycle';

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

describe('erdiko zenbakia ez da eserlekuen gainera ateratzen', () => {
  // Hau akats erreal bat izan zen: "75" barruko errenkada estaltzen zuen. Neurriak eskuz jarrita
  // zeuden; orain zuloaren proportzio gisa kalkulatzen dira, eta proba honek zaintzen du.

  it('testua zuloaren barruan geratzen da, ganbera edozein dela ere', () => {
    // Eserleku 1eko ganberak bolatxo erraldoi bakarra du eta zuloa jaten dio: hor hasi zen akatsa.
    for (const seats of [1, 2, 5, 9, 25, 75, 100, 123, 150, 350, 400, 751, 1000]) {
      const { innerRadius, seatRadius } = layoutHemicycle(seats);
      const digits = String(seats).length;
      const hero = heroLayout(innerRadius, seatRadius, digits);

      // Etiketarik luzeenarekin neurtzen dugu beti ("koalizioan"), letra-tamainak jauzirik egin ez dezan.
      const extent = heroTextExtent(hero, digits, 10);

      // Barruko eserlekuak `innerRadius` erradioan daude eta `seatRadius` lodi dira: beraz zirkuluen
      // barruko ertza `innerRadius - seatRadius`-en dago. Testuak hor sartu behar du.
      const limit = innerRadius - seatRadius;
      expect(
        extent,
        `${seats} eserleku: testua ${extent.toFixed(1)}, muga ${limit.toFixed(1)}`,
      ).toBeLessThanOrEqual(limit);
    }
  });

  it('koalizio bat hautatzeak ez du letra-tamaina aldatzen', () => {
    // Koalizioaren zenbakia beti da guztizkoa baino txikiagoa, beraz digitu berdinak edo gutxiago
    // ditu: neurria guztizkoarekin kalkulatuta, egonkorra da.
    const { innerRadius, seatRadius } = layoutHemicycle(75);
    const hero = heroLayout(innerRadius, seatRadius, 2);
    expect(heroTextExtent(hero, 1, 10)).toBeLessThanOrEqual(heroTextExtent(hero, 2, 10));
  });

  it('bolatxoak ez dira neurriz kanpo hazten ganbera txikietan', () => {
    // Muga hau gabe, eserleku 1eko ganberak 21,8ko erradioa zuen (75ekoak 5,5 duen bitartean):
    // bolatxo erraldoi bakar batek zuloa jaten zuen.
    for (const seats of [1, 2, 5, 9]) {
      expect(layoutHemicycle(seats).seatRadius, `${seats}`).toBeLessThanOrEqual(12);
    }
    // Ganbera normaletan mugak ez du eraginik: tarteak berak zehazten du tamaina.
    expect(layoutHemicycle(75).seatRadius).toBeLessThan(8);
  });
});
