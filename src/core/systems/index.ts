import { runListPR } from './listPR';
import { runFPTP, runTwoRound } from './majoritarian';
import type { RunoffOptions } from './majoritarian';
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
    description: 'Barruti uninominalak + zerrenda-eserlekuak, bereiz kalkulatuta.',
    available: false,
    proportional: true,
  },
  {
    id: 'mmp',
    name: 'Mistoa konpentsatzailea (MMP)',
    description: 'Zerrenda-eserlekuek proportzionaltasuna orekatzen dute; overhang-a maneiatzen da.',
    available: false,
    proportional: true,
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
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  system: 'list-pr',
  method: 'dhondt',
  threshold: { percent: 3, scope: 'district', includeBlank: true },
  runoff: { rule: 'top-two', qualifyPercent: 12.5 },
  transfers: DEFAULT_TRANSFER_CONFIG,
};

export function runSystem(scenario: Scenario, config: SystemConfig): ElectionResult {
  switch (config.system) {
    case 'list-pr':
      return runListPR(scenario, { method: config.method, threshold: config.threshold });
    case 'fptp':
      return runFPTP(scenario);
    case 'two-round':
      return runTwoRound(scenario, { ...config.runoff, transfers: config.transfers });
    default:
      throw new Error(`Sistema hau oraindik ez dago inplementatuta: ${config.system}`);
  }
}

export { runListPR, runFPTP, runTwoRound };
export type { RunoffOptions };
