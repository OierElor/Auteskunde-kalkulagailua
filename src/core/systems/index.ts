import { runListPR } from './listPR';
import type { ElectionResult, MethodId, Scenario, ThresholdConfig } from '../types';

/**
 * Sistema elektoralen erregistroa. 1. fasean zerrenda-PR bakarrik dago inplementatuta; hurrengo
 * faseek kasu berriak gehitzen dituzte `runSystem`-en, datu-eredua aldatu gabe.
 */
export type SystemId = 'list-pr' | 'fptp' | 'two-round' | 'mmm' | 'mmp' | 'stv';

export interface SystemSpec {
  id: SystemId;
  name: string;
  description: string;
  /** Zein fasetan inplementatzen den. `available: false` bada, UI-ak grisean erakusten du. */
  available: boolean;
}

export const SYSTEMS: SystemSpec[] = [
  {
    id: 'list-pr',
    name: 'Zerrenda proportzionala',
    description:
      'Zerrenda itxiak, barrutika. Alderdi bakoitzak jasotako botoen arabera hartzen ditu eserlekuak, aukeratutako metodoaren bidez.',
    available: true,
  },
  {
    id: 'fptp',
    name: 'Maioritarioa (FPTP)',
    description: 'Barruti uninominalak: boto gehien duenak eserlekua hartzen du.',
    available: false,
  },
  {
    id: 'two-round',
    name: 'Bi itzuli',
    description: 'Inork %50 lortu ezean, bigarren itzulia transferentzia-matrizearekin.',
    available: false,
  },
  {
    id: 'mmm',
    name: 'Mistoa paraleloa (MMM)',
    description: 'Barruti uninominalak + zerrenda-eserlekuak, bereiz kalkulatuta.',
    available: false,
  },
  {
    id: 'mmp',
    name: 'Mistoa konpentsatzailea (MMP)',
    description: 'Zerrenda-eserlekuek proportzionaltasuna orekatzen dute; overhang-a maneiatzen da.',
    available: false,
  },
  {
    id: 'stv',
    name: 'Boto ordenatua (STV/IRV)',
    description: 'Droop kuota eta soberakinen transferentzia frakzionala.',
    available: false,
  },
];

export interface SystemConfig {
  system: SystemId;
  method: MethodId;
  threshold: ThresholdConfig;
}

export function runSystem(scenario: Scenario, config: SystemConfig): ElectionResult {
  switch (config.system) {
    case 'list-pr':
      return runListPR(scenario, { method: config.method, threshold: config.threshold });
    default:
      throw new Error(`Sistema hau oraindik ez dago inplementatuta: ${config.system}`);
  }
}

export { runListPR };
