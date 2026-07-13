import { describe, expect, it } from 'vitest';
import { adaptForDark, adaptForLight, contrastRatio, hexToOklch, readableInkOn } from './color';

const LIGHT_SURFACE = '#fcfcfb';
const DARK_SURFACE = '#1a1a19';

describe('OKLCH bihurketa', () => {
  it('joan-etorria kolorea mantentzen du', () => {
    for (const hex of ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#ffffff', '#000000']) {
      // Bandaren barruan dagoen kolorea ez da ukitzen.
      const o = hexToOklch(hex);
      expect(o.l).toBeGreaterThanOrEqual(0);
      expect(o.l).toBeLessThanOrEqual(1);
    }
  });

  it('laburdura hamaseitarra onartzen du', () => {
    expect(hexToOklch('#fff').l).toBeCloseTo(hexToOklch('#ffffff').l, 6);
  });
});

describe('gaira egokitzea', () => {
  // 8 biteko hexadezimalera biribiltzeak ~0,003ko errorea sartzen du OKLCH argitasunean.
  const QUANTIZATION = 0.005;

  it('gai ilunean, kolore ilunegia argitu egiten da', () => {
    const adapted = adaptForDark('#0d1b2a'); // ia beltza den nabyа
    expect(hexToOklch(adapted).l).toBeGreaterThanOrEqual(0.48 - QUANTIZATION);
    expect(hexToOklch(adapted).l).toBeGreaterThan(hexToOklch('#0d1b2a').l);
  });

  it('gai argian, kolore argiegia ilundu egiten da', () => {
    const adapted = adaptForLight('#fff8b0');
    expect(hexToOklch(adapted).l).toBeLessThanOrEqual(0.77 + QUANTIZATION);
  });

  it('ñabardura mantentzen du argitasuna doitzean', () => {
    const before = hexToOklch('#0d1b2a');
    const after = hexToOklch(adaptForDark('#0d1b2a'));
    expect(Math.abs(after.h - before.h)).toBeLessThan(6);
  });

  it('kolore AKROMATIKOAK 3:1 lortu arte bultzatzen dira, bi gaietan', () => {
    // Hau da funtsezko bermea. Kolore hauek ez dute ñabardurarik: argitasuna da kanal bakarra,
    // eta argitasun-bandak berak EZ luke 3:1 lortuko (beltzak 2,6:1 emango luke gai ilunean).
    for (const hex of ['#000000', '#0a0a0a', '#333333', '#888888', '#eeeeee', '#ffffff']) {
      expect(contrastRatio(adaptForDark(hex), DARK_SURFACE), `iluna ${hex}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(adaptForLight(hex), LIGHT_SURFACE), `argia ${hex}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('paleta lehenetsiak balio baliozkotuak erabiltzen ditu gai ilunean', () => {
    expect(adaptForDark('#2a78d6')).toBe('#3987e5');
    expect(adaptForDark('#e87ba4')).toBe('#d55181');
  });

  it('banda barruko kolorea ukitu gabe uzten du gai argian', () => {
    expect(adaptForLight('#2a78d6')).toBe('#2a78d6');
  });
});

describe('tinta irakurgarria', () => {
  it('atzealde argian tinta iluna', () => {
    expect(readableInkOn('#eda100')).toBe('#0b0b0b');
    expect(readableInkOn('#ffffff')).toBe('#0b0b0b');
  });

  it('atzealde ilunean tinta zuria', () => {
    expect(readableInkOn('#4a3aa7')).toBe('#ffffff');
    expect(readableInkOn('#000000')).toBe('#ffffff');
  });

  it('paleta osoan 3:1 gainditzen du (etiketa lodien AA maila)', () => {
    // 3:1 da testu lodi/handiaren muga (WCAG AA large). Alderdien txartelek laburdura lodia
    // daramate, ez testu arrunta: hori da aplikatzen zaien maila.
    for (const hex of ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']) {
      expect(contrastRatio(hex, readableInkOn(hex)), hex).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('kontraste-ratioa', () => {
  it('zuria eta beltza 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('kolore bera 1:1', () => {
    expect(contrastRatio(LIGHT_SURFACE, LIGHT_SURFACE)).toBeCloseTo(1, 6);
  });
});
