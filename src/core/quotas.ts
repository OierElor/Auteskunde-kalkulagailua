import type { QuotaMethodId } from './types';

export interface QuotaMethodSpec {
  id: QuotaMethodId;
  name: string;
  formula: string;
  description: string;
  /** V = boto baliodunak (langa gainditu dutenenak), S = eserlekuak. */
  quota(totalVotes: number, seats: number): number;
}

export const QUOTA_METHODS: Record<QuotaMethodId, QuotaMethodSpec> = {
  hare: {
    id: 'hare',
    name: 'Hare (hondar handiena)',
    formula: 'V / S',
    description:
      'Kuota naturala. Metodo proportzionalena, baina "Alabamaren paradoxa" jasan dezake: eserleku bat gehitzeak alderdi bati eserleku bat kendu diezaioke.',
    quota: (v, s) => v / s,
  },
  droop: {
    id: 'droop',
    name: 'Droop',
    formula: '⌊V / (S+1)⌋ + 1',
    description:
      'Kuota txikiagoa da, beraz alderdi handiek eserleku gehiago hartzen dituzte kuota osoz. STVren oinarria ere bada.',
    quota: (v, s) => Math.floor(v / (s + 1)) + 1,
  },
  'hagenbach-bischoff': {
    id: 'hagenbach-bischoff',
    name: 'Hagenbach-Bischoff',
    formula: 'V / (S+1)',
    description: 'Droop kuota biribiltzerik gabe. Gehiegi esleitu dezake; hala bada, Droop-era itzultzen da.',
    quota: (v, s) => v / (s + 1),
  },
  'imperiali-quota': {
    id: 'imperiali-quota',
    name: 'Imperiali (kuota)',
    formula: 'V / (S+2)',
    description:
      'Kuota are txikiagoa: alderdi handien alde. Sarritan dauden baino eserleku gehiago esleitzen ditu; kasu horretan Droop-era itzultzen da.',
    quota: (v, s) => v / (s + 2),
  },
};

/**
 * Kuota batek dauden baino eserleku gehiago esleitzen baditu, kuota handiago batera jotzen da.
 * Droop-ek eta Hare-k ezin dute inoiz gehiegi esleitu, beraz katea beti amaitzen da.
 */
export const QUOTA_FALLBACK: Record<QuotaMethodId, QuotaMethodId | null> = {
  'imperiali-quota': 'droop',
  'hagenbach-bischoff': 'droop',
  droop: null,
  hare: null,
};

export function isQuotaMethod(id: string): id is QuotaMethodId {
  return id in QUOTA_METHODS;
}
