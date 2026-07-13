import { runListPR } from './listPR';
import { runFPTP, runTwoRound } from './majoritarian';
import type { RunoffOptions } from './majoritarian';
import { runMixed } from './mixed';
import type { MixedOptions, OverhangRule } from './mixed';
import { runStv } from './stv';
import { DEFAULT_TRANSFER_CONFIG } from '../transfers';
import type { TransferConfig } from '../transfers';
import { DEFAULT_CANDIDATE_CONFIG } from '../candidates';
import type { CandidateConfig } from '../candidates';
import type { ElectionResult, MethodId, Scenario, ThresholdConfig } from '../types';

/**
 * Sistema elektoralen erregistroa. Faseka hazten da; datu-eredua ez da aldatzen.
 * Barruti uninominal bat `seats: 1` duen barruti arrunta da — horregatik ez du sistema
 * maioritarioak datu-egitura berririk behar.
 */
export type SystemId = 'list-pr' | 'fptp' | 'two-round' | 'mmm' | 'mmp' | 'stv';

export interface SystemSpec {
  id: SystemId;
  name: string;
  description: string;
  available: boolean;
  /**
   * Banaketa-metodoa (D'Hondt…) eta legezko langa erabiltzen dituen.
   *
   * Maioritarioek ez dute bat ere: barrutia bera da langa. STVk ere ez: Droop kuota DA langa, eta
   * hautagaiak ordenatzen ditu, ez alderdiak. Horregatik bi horiek `false` dute, oso desberdinak
   * izan arren — bandera honek "metodoa eta langa erakutsi?" bakarrik esan nahi du.
   */
  proportional: boolean;
  /** Bi maila ditu: barruti uninominalak + zerrenda-poltsa. */
  mixed?: boolean;
  /** Boto ordenatuak: hautagai-mailakoa da, ez alderdi-mailakoa. */
  ranked?: boolean;
}

export const SYSTEMS: SystemSpec[] = [
  {
    id: 'list-pr',
    name: 'Zerrenda proportzionala',
    description:
      'Zerrenda itxiak, barrutika. Alderdi bakoitzak jasotako botoen arabera hartzen ditu eserlekuak, aukeratutako metodoaren bidez.',
    available: true,
    proportional: true,
  },
  {
    id: 'fptp',
    name: 'Maioritarioa (FPTP)',
    description:
      'Boto gehien dituenak barrutia irabazten du, gehiengorik gabe ere. Langak ez du zentzurik hemen. Erresuma Batua, Kanada.',
    available: true,
    proportional: false,
  },
  {
    id: 'two-round',
    name: 'Bi itzuli',
    description:
      'Inork %50 gainditu ezean, bigarren itzulia. Bigarren itzuliko botoak ez daudenez, transferentzia-matrizetik ondorioztatzen dira. Frantzia.',
    available: true,
    proportional: false,
  },
  {
    id: 'mmm',
    name: 'Mistoa paraleloa (MMM)',
    description:
      'Barruti uninominalak + zerrenda-poltsa, BEREIZ kalkulatuta. Barrutietan irabazteak ez du zerrenda-eserlekurik kentzen: desproportzionala izaten jarraitzen du. Japonia.',
    available: true,
    proportional: true,
    mixed: true,
  },
  {
    id: 'mmp',
    name: 'Mistoa konpentsatzailea (MMP)',
    description:
      'Zerrenda-eserlekuek OREKATU egiten dute: alderdi bakoitzari dagokion guztizkoa kalkulatzen da, eta barrutietan irabazitakoa kentzen zaio. Alemania, Zeelanda Berria.',
    available: true,
    proportional: true,
    mixed: true,
  },
  {
    id: 'stv',
    name: 'Boto ordenatua (STV / IRV)',
    description:
      'Hautagaiak lehiatzen dira, ez alderdiak. Droop kuota eta Gregory-ren soberakin-transferentzia. Eserleku bakarreko barrutietan IRV da. Irlanda, Malta, Australia.',
    available: true,
    proportional: false,
    ranked: true,
  },
];

export const systemSpec = (id: SystemId) => SYSTEMS.find((s) => s.id === id)!;

export interface SystemConfig {
  system: SystemId;
  method: MethodId;
  threshold: ThresholdConfig;
  runoff: { rule: RunoffOptions['rule']; qualifyPercent: number };
  transfers: TransferConfig;
  mixed: { listSeats: number; overhang: OverhangRule; ballot: MixedOptions['ballot'] };
  candidates: CandidateConfig;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  system: 'list-pr',
  method: 'dhondt',
  threshold: { percent: 3, scope: 'district', includeBlank: true },
  runoff: { rule: 'top-two', qualifyPercent: 12.5 },
  transfers: DEFAULT_TRANSFER_CONFIG,
  mixed: { listSeats: 25, overhang: 'keep', ballot: 'same' },
  candidates: DEFAULT_CANDIDATE_CONFIG,
};

export function runSystem(scenario: Scenario, config: SystemConfig): ElectionResult {
  switch (config.system) {
    case 'list-pr':
      return runListPR(scenario, { method: config.method, threshold: config.threshold });
    case 'fptp':
      return runFPTP(scenario);
    case 'two-round':
      return runTwoRound(scenario, { ...config.runoff, transfers: config.transfers });
    case 'mmm':
    case 'mmp':
      return runMixed(scenario, {
        ...config.mixed,
        compensatory: config.system === 'mmp',
        method: config.method,
        threshold: config.threshold,
      });
    case 'stv':
      return runStv(scenario, {
        transfers: config.transfers,
        candidates: config.candidates,
      });
    default:
      throw new Error(`Sistema hau oraindik ez dago inplementatuta: ${config.system}`);
  }
}

export { runListPR, runFPTP, runTwoRound, runMixed, runStv };
export type { RunoffOptions, MixedOptions, OverhangRule };
