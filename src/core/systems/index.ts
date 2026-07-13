import { runListPR } from './listPR';
import { runFPTP, runTwoRound } from './majoritarian';
import type { RunoffOptions } from './majoritarian';
import { runMixed } from './mixed';
import type { MixedOptions, OverhangRule } from './mixed';
import { DEFAULT_TRANSFER_CONFIG } from '../transfers';
import type { TransferConfig } from '../transfers';
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
  /** Banaketa-metodoa (D'Hondt…) eta langa erabiltzen dituen. Maioritarioek ez dute ez bata ez bestea. */
  proportional: boolean;
  /** Bi maila ditu: barruti uninominalak + zerrenda-poltsa. */
  mixed?: boolean;
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
    name: 'Boto ordenatua (STV/IRV)',
    description: 'Droop kuota eta soberakinen transferentzia frakzionala.',
    available: false,
    proportional: true,
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
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  system: 'list-pr',
  method: 'dhondt',
  threshold: { percent: 3, scope: 'district', includeBlank: true },
  runoff: { rule: 'top-two', qualifyPercent: 12.5 },
  transfers: DEFAULT_TRANSFER_CONFIG,
  mixed: { listSeats: 25, overhang: 'keep', ballot: 'same' },
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
    default:
      throw new Error(`Sistema hau oraindik ez dago inplementatuta: ${config.system}`);
  }
}

export { runListPR, runFPTP, runTwoRound, runMixed };
export type { RunoffOptions, MixedOptions, OverhangRule };
