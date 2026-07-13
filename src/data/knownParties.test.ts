import { describe, expect, it } from 'vitest';
import { hexToOklch, hexToRgb } from '../core/color';
import { applyKnownParties, findKnownParty } from './knownParties';
import type { Scenario } from '../core/types';

/**
 * Alderdien koloreak eta izenak.
 *
 * Proba nagusia: hemizikloan batera agertzen diren alderdiek BEREIZGARRIAK izan behar dute.
 * EAJ-PNV eta Vox berde berbera zuten (ΔE 3,7 ikusmen normalean): 27 eserleku eta 1 eserleku
 * nahastuko lirateke. Proba honek ez du hori berriro gertatzen utziko.
 *
 * Ez du itsutasun kromatikoa BERMATZEN: marka-koloreak errealitatetik datoz (PSOE gorria, PNV eta
 * Vox berdeak) eta ezin dira denak seguru bihurtu identitatea suntsitu gabe. Horregatik erakusten
 * du aplikazioak beti izenak eta zenbakiak koloreen ondoan.
 */

// --- Itsutasun kromatikoaren simulazioa (Viénot/Brettel, LMS espazioan) -----

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const toHex = (r: number, g: number, b: number) =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
    .join('');

function simulate(hex: string, kind: 'protan' | 'deutan'): string {
  const [R, G, B] = hexToRgb(hex).map(linear);
  const L = 0.31399022 * R + 0.63951294 * G + 0.04649755 * B;
  const M = 0.15537241 * R + 0.75789446 * G + 0.08670142 * B;
  const S = 0.01775239 * R + 0.10944209 * G + 0.87256922 * B;

  let l = L;
  let m = M;
  if (kind === 'protan') l = 1.05118294 * M - 0.05116099 * S;
  else m = 0.9513092 * L + 0.04866992 * S;

  return toHex(
    gamma(5.47221206 * l - 4.6419601 * m + 0.16963708 * S),
    gamma(-1.1252419 * l + 2.29317094 * m - 0.1678952 * S),
    gamma(0.02980165 * l - 0.19318073 * m + 1.16364789 * S),
  );
}

/** OKLab distantzia, 100ez biderkatuta. */
function deltaE(a: string, b: string): number {
  const A = hexToOklch(a);
  const B = hexToOklch(b);
  const ax = A.c * Math.cos((A.h * Math.PI) / 180);
  const ay = A.c * Math.sin((A.h * Math.PI) / 180);
  const bx = B.c * Math.cos((B.h * Math.PI) / 180);
  const by = B.c * Math.sin((B.h * Math.PI) / 180);
  return Math.hypot(A.l - B.l, ax - bx, ay - by) * 100;
}

const color = (name: string) => findKnownParty(name)!.color;

describe('alderdien koloreak', () => {
  it('EAJ-PNV eta Vox bereizgarriak dira — akats hau ez da errepikatuko', () => {
    // Biak berde generikoak ziren: ΔE 3,7. Hemizikloan EAJ-PNVren 27 eserleku eta Voxen 1
    // ezin ziren bereizi. EAJ-PNVren berde ILUNAK konpontzen du (hedabideek egiten duten bezala).
    expect(deltaE(color('EAJ-PNV'), color('Vox'))).toBeGreaterThan(15);
  });

  it('hiru berdeak bereizgarriak dira (EAJ-PNV, EH Bildu, Vox)', () => {
    // Euskal politikak hiru alderdi berde ditu. Argitasunak bereizten ditu: EAJ-PNV iluna,
    // Vox ertaina, EH Bildu argia.
    const greens = ['EAJ-PNV', 'EH Bildu', 'Vox'].map(color);
    const lightness = greens.map((c) => hexToOklch(c).l);

    expect(deltaE(greens[0], greens[1])).toBeGreaterThan(15);
    expect(deltaE(greens[0], greens[2])).toBeGreaterThan(15);

    // EH Bildu eta Vox hemizikloaren MUTUR banatan daude (16 vs 92): ez dira inoiz alboan egoten.
    // Hala ere, argitasunean bereizten dira.
    expect(Math.abs(lightness[1] - lightness[2])).toBeGreaterThan(0.08);
  });

  it('bloke handiek elkarren artean argi bereizten dute (PP, PSOE, Vox, Sumar)', () => {
    const main = ['PP', 'PSOE', 'Vox', 'Sumar'].map(color);
    for (let i = 0; i < main.length; i++) {
      for (let j = i + 1; j < main.length; j++) {
        expect(deltaE(main[i], main[j]), `${main[i]} vs ${main[j]}`).toBeGreaterThan(12);
      }
    }
  });

  it('itsutasun kromatikoa: gorria eta berdea nahasten dira — eta hori dokumentatuta dago', () => {
    // Proba hau EZ da baieztapen bat: errealitatearen NEURKETA bat da. PSOE gorria eta EAJ-PNV
    // berdea deuteranopian ia berdinak dira. Ezin da konpondu marka-koloreak errespetatuz.
    //
    // Horregatik EZ da kolorea identitatearen kanal bakarra aplikazioan: emaitza-taula beti dago
    // ikusgai izenekin eta zenbakiekin. Proba honek muga hori bizirik mantentzen du kodean.
    const deutan = deltaE(simulate(color('PSOE'), 'deutan'), simulate(color('EAJ-PNV'), 'deutan'));
    expect(deutan).toBeLessThan(12);
  });
});

describe('izenak eta laburdurak', () => {
  const scenario = (...names: string[]): Scenario => ({
    name: 'proba',
    parties: names.map((n, i) => ({
      id: `p${i}`,
      name: n,
      abbrev: n,
      color: '#000000',
      position: 0,
    })),
    districts: [{ id: 'd', name: 'D', seats: 1 }],
    votes: { d: {} },
    blankVotes: { d: 0 },
  });

  it('izen ofizial luzeak laburdura irakurgarri bihurtzen dira', () => {
    const out = applyKnownParties(
      scenario(
        'Euzko Alderdi Jeltzalea-Partido Nacionalista Vasco (EAJ-PNV)',
        'Partido Socialista Obrero Español (PSOE)',
        'Partit dels Socialistes de Catalunya (PSC-PSOE) (PSC)',
        'Geroa Bai (GBAI).',
      ),
    );
    expect(out.parties.map((p) => p.abbrev)).toEqual(['EAJ-PNV', 'PSOE', 'PSC', 'Geroa Bai']);
  });

  it('laburdurarik gabeko izenak ere ezagutzen ditu (Europako Parlamentuko formatua)', () => {
    const out = applyKnownParties(
      scenario('Partido Socialista Obrero Español', 'Partido Popular', 'PODEMOS'),
    );
    expect(out.parties.map((p) => p.abbrev)).toEqual(['PSOE', 'PP', 'Podemos']);
  });

  it('alderdi ezezagunak ez dira galtzen: parentesiko laburdura hartzen dute', () => {
    const out = applyKnownParties(scenario('Zamora Sí (Zsi)', 'Soria ¡Ya! (SY)'));
    expect(out.parties.map((p) => p.abbrev)).toEqual(['Zsi', 'SY']);
    // Eta paletako kolore bat, ez beltza.
    expect(out.parties[0].color).not.toBe('#000000');
  });

  it('urte desberdinetako izenak alderdi berera eramaten ditu', () => {
    // 2016: "PODEMOS/AHAL DUGU-IU", 2020: "PODEMOS-AHALDUGU/EZKER AN", 2024: "PODEMOS-AHAL DUGU - ALIANZA VERDE"
    for (const name of [
      'PODEMOS/AHAL DUGU-IU',
      'PODEMOS-AHALDUGU/EZKER AN',
      'PODEMOS-AHAL DUGU - ALIANZA VERDE',
    ]) {
      expect(findKnownParty(name)?.abbrev, name).toBe('Podemos');
    }
  });
});
