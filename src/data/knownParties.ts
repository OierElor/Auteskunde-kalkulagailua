import { defaultColorForIndex } from '../core/palette';
import type { Scenario } from '../core/types';

/**
 * ALDERDI EZAGUNAK: izen ofizialetik → laburdura, kolorea eta ezker-eskuin posizioa.
 *
 * Zergatik behar den: CSV batek ez du kolorerik ez posiziorik garraiatzen, eta datu ofizialetan
 * izenak luzeak dira ("Euzko Alderdi Jeltzalea-Partido Nacionalista Vasco (EAJ-PNV)"). Horrek bi
 * arazo sortzen ditu — hemizikloko txartelak irakurtezinak, eta alderdiak zutabe-ordenan eserita,
 * hau da, zentzurik gabe.
 *
 * ⚠ EZKER-ESKUIN POSIZIOA IRITZI BAT DA, EZ DATU BAT.
 *
 * Ardatz ekonomiko-soziala erabiltzen du, Espainiako hemizikloetan ohikoa dena. Alderdi
 * abertzaleak ez dira ardatz horretan ondo sartzen: EAJ-PNV eta Junts zentro-eskuinekoak dira
 * ekonomian baina abertzaleak; ERC eta EH Bildu ezkerrekoak eta abertzaleak. Hurbilketa bat da,
 * eztabaidagarria, eta **aplikazioan bertan alda dezakezu** (Datuak fitxa → ezker-eskuin
 * graduatzailea). Ez du emaitzan eraginik: hemizikloaren ordena bakarrik erabakitzen du.
 *
 * ⚠ KOLOREAK MARKA-KOLOREAK DIRA, ETA HORREK MUGA BAT DAKAR.
 *
 * Paleta kategoriko on batek kolore bereizgarriak ditu, itsutasun kromatikoarekin ere. Alderdien
 * marka-koloreak, aldiz, ez ziren horretarako diseinatu: PSOE gorria da, EAJ-PNV eta Vox berdeak,
 * ERC eta CC horiak. Deuteranopia duen batek gorria eta berdea nekez bereiziko ditu — eta hori ez
 * dago konpontzerik marka-identitatea suntsitu gabe, hau da, koloreen zentzu osoa galdu gabe.
 *
 * Beraz identitatea EZ da koloreak bakarrik garraiatzen: emaitza-taula beti dago ikusgai alderdien
 * izenekin eta eserleku-kopuruekin, hemizikloko eserlekuek tooltip-a dute, eta lauza bakoitzak bere
 * etiketa du ondoan. Hori da erliebe-kanala, eta ezinbestekoa da hemen.
 *
 * Salbuespen bat: EAJ-PNV eta Vox IKUSMEN NORMALEAN ere bereiztezinak ziren (ΔE 3,7). Hori ez zen
 * errealitatea, nire akatsa baizik — ikus behean.
 */

interface KnownParty {
  abbrev: string;
  color: string;
  /** 0 = ezkerra, 100 = eskuina. Hemizikloa ordenatzeko baino ez da. */
  position: number;
  /** Datu ofizialetan agertzen diren izenak eta laburdurak (normalizatuta konparatzen dira). */
  match: string[];
}

const KNOWN: KnownParty[] = [
  // --- Ezkerra
  {
    abbrev: 'Podemos',
    color: '#692b7c',
    position: 8,
    match: [
      'podemos',
      'podemos-ahal dugu - alianza verde',
      'podemos-ahaldugu/ezker an',
      'podemos/ahal dugu-iu',
      'elkarrekin podemos',
    ],
  },
  { abbrev: 'Contigo', color: '#7b3f98', position: 10, match: ['contigo-zurekin'] },
  { abbrev: 'CUP', color: '#ffe500', position: 12, match: ['cup-pr'] },
  {
    abbrev: 'EH Bildu',
    color: '#b5cf18',
    position: 16,
    match: ['eh bildu', 'ehbildu'],
  },
  {
    abbrev: 'A. Repúbliques',
    color: '#a3c940',
    position: 17,
    match: ['ahora republicas (erc-eh bildu- bng-ara mes)', 'ahora republicas'],
  },
  { abbrev: 'BNG', color: '#7cb0dd', position: 18, match: ['bng'] },
  { abbrev: 'Sumar', color: '#e5007d', position: 21, match: ['sumar'] },
  { abbrev: 'ERC', color: '#ffb232', position: 30, match: ['erc'] },
  { abbrev: 'Geroa Bai', color: '#6ebe44', position: 34, match: ['geroa bai', 'gbai'] },

  // --- Sozialistak
  {
    abbrev: 'PSOE',
    color: '#e30613',
    position: 38,
    match: ['psoe', 'partido socialista obrero espanol'],
  },
  { abbrev: 'PSC', color: '#e63f52', position: 38, match: ['psc', 'psc-psoe'] },
  { abbrev: 'PSE-EE', color: '#e30613', position: 38, match: ['pse-ee/psoe', 'pse-ee'] },
  { abbrev: 'PSN', color: '#e30613', position: 38, match: ['psn-psoe', 'psn'] },

  // --- Abertzale kontserbadoreak (ardatz ekonomikoan zentro-eskuina)
  //
  // EAJ-PNVren berdea ILUNA da nahita. Berde argi bat erabiliz gero (#4cb847), Voxen berdetik
  // ezin da bereizi: ΔE 3,7 ikusmen normalean — praktikoki kolore bera. EAJ-PNVren 27 eserleku
  // eta Voxen 1 nahastuko lirateke. Berde ilunak 19,2ra igotzen du aldea.
  //
  // Ez da lizentzia bat: hedabideek (El País, RTVE) berde iluna erabiltzen dute EAJ-PNVrentzat
  // arrazoi berberagatik, Voxek berde argia hartu zuenetik.
  { abbrev: 'EAJ-PNV', color: '#008542', position: 55, match: ['eaj-pnv', 'eaj', 'pnv'] },
  { abbrev: 'CC', color: '#ffd700', position: 58, match: ['cca', 'cc'] },
  {
    abbrev: 'Junts',
    color: '#00c3b2',
    position: 62,
    match: ['junts', 'junts ue', 'junts i lliures per europa', 'pdecat-e-ciu'],
  },
  { abbrev: 'CEUS', color: '#5ec5e8', position: 60, match: ['coalicion por una europa solidaria', 'ceus'] },

  // --- Eskuina
  { abbrev: 'PP', color: '#0056a3', position: 72, match: ['pp', 'partido popular'] },
  { abbrev: 'PPN', color: '#0b6bb5', position: 73, match: ['ppn'] },
  { abbrev: 'PP+Cs', color: '#1d84ce', position: 70, match: ['pp+cs'] },
  { abbrev: 'Cs', color: '#eb6109', position: 66, match: ['cs', "c's", 'ciudadanos'] },
  { abbrev: 'UPN', color: '#0b4ea2', position: 76, match: ['upn'] },
  {
    abbrev: 'SALF',
    color: '#00b3a4',
    position: 86,
    match: ['se acabo la fiesta', 'salf', 'agrupacion de electores se acabo la fiesta'],
  },
  { abbrev: 'Vox', color: '#63be21', position: 92, match: ['vox'] },
];

/** Azentuak, letra larriak eta puntuazioa kendu, konparaketa egonkorra izan dadin. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[«»"'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Izen ofizialaren amaierako parentesitik laburdura ateratzen du:
 *   "Partido Popular (PP)"                       → "PP"
 *   "Partit dels Socialistes... (PSC-PSOE) (PSC)" → "PSC"
 */
function abbrevFromName(name: string): string | null {
  const match = /\(([^()]{1,20})\)\s*\.?\s*$/.exec(name.trim());
  return match ? match[1].trim() : null;
}

/** Izena laburdurarik gabe: "Partido Popular (PP)" → "Partido Popular". */
function bareName(name: string): string {
  return name.replace(/\s*\([^()]*\)\s*\.?\s*$/, '').trim();
}

const INDEX = new Map<string, KnownParty>();
for (const party of KNOWN) {
  for (const key of party.match) INDEX.set(normalize(key), party);
  INDEX.set(normalize(party.abbrev), party);
}

/** Alderdi ezaguna aurkitu, izenetik edo laburduratik. */
export function findKnownParty(name: string): KnownParty | undefined {
  const abbrev = abbrevFromName(name);
  return (
    (abbrev ? INDEX.get(normalize(abbrev)) : undefined) ??
    INDEX.get(normalize(bareName(name))) ??
    INDEX.get(normalize(name))
  );
}

/**
 * Eszenatoki inportatu bati alderdi ezagunen laburdura, kolorea eta posizioa aplikatzen dio.
 *
 * Ezezagunak diren alderdiek paletako kolore bat eta zentroko posizioa hartzen dute. Ez da arazoa:
 * eserlekurik lortzen ez dutenak ez dira hemizikloan agertzen, eta erabiltzaileak edonoiz alda
 * ditzake balio horiek.
 */
export function applyKnownParties(scenario: Scenario): Scenario {
  return {
    ...scenario,
    parties: scenario.parties.map((party, index) => {
      const known = findKnownParty(party.name);
      if (known) {
        return {
          ...party,
          abbrev: known.abbrev,
          color: known.color,
          position: known.position,
        };
      }
      return {
        ...party,
        // Laburdurarik ez badago, gutxienez izen laburra erabili txarteletan.
        abbrev: abbrevFromName(party.name) ?? party.abbrev,
        color: defaultColorForIndex(index),
        position: 50,
      };
    }),
  };
}
