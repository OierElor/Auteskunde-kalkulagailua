import type { DivisorMethodId } from './types';

export interface DivisorMethodSpec {
  id: DivisorMethodId;
  name: string;
  /** Zatitzaile-sekuentzia, UI-an erakusteko. */
  sequence: string;
  description: string;
  /** Alderdi batek `n` eserleku dituenean bere hurrengo eserlekurako zatitzailea. */
  divisor(n: number): number;
}

export const DIVISOR_METHODS: Record<DivisorMethodId, DivisorMethodSpec> = {
  dhondt: {
    id: 'dhondt',
    name: "D'Hondt",
    sequence: '1, 2, 3, 4…',
    description:
      'Alderdi handiei mesede egiten die. Espainian, Euskadin eta Europako herrialde askotan erabiltzen dena.',
    divisor: (n) => n + 1,
  },
  'sainte-lague': {
    id: 'sainte-lague',
    name: 'Sainte-Laguë',
    sequence: '1, 3, 5, 7…',
    description:
      'Proportzionalena. Alderdi txikiei D\'Hondt-ek baino mesede handiagoa egiten die. Zeelanda Berria, Alemania.',
    divisor: (n) => 2 * n + 1,
  },
  'sainte-lague-mod': {
    id: 'sainte-lague-mod',
    name: 'Sainte-Laguë aldatua',
    sequence: '1,4, 3, 5, 7…',
    description:
      'Lehen zatitzailea 1,4 da: alderdi oso txikiei lehen eserlekua eskuratzea zailtzen die. Suedia, Norvegia.',
    divisor: (n) => (n === 0 ? 1.4 : 2 * n + 1),
  },
  'imperiali-div': {
    id: 'imperiali-div',
    name: 'Imperiali (zatitzailea)',
    sequence: '2, 3, 4, 5…',
    description:
      "D'Hondt baino ere gehiago faboratzen ditu alderdi handiak. Belgikako udal-hauteskundeetan.",
    divisor: (n) => n + 2,
  },
  danish: {
    id: 'danish',
    name: 'Daniarra',
    sequence: '1, 4, 7, 10…',
    description:
      'Oso zatitzaile-jauzi handiak: alderdi txikien alde egiten du nabarmen. Danimarkako maila lokalean.',
    divisor: (n) => 3 * n + 1,
  },
  'huntington-hill': {
    id: 'huntington-hill',
    name: 'Huntington-Hill',
    sequence: '0, √2, √6, √12…',
    description:
      'Batez besteko geometrikoa: √(n·(n+1)). Alderdi bakoitzak lehen eserlekua hartzen du beste inork bigarrena hartu aurretik. AEBetako Kongresuan estatuen artean.',
    divisor: (n) => Math.sqrt(n * (n + 1)),
  },
};

/**
 * Alderdi batek `n` eserleku dituenean, hurrengo eserlekurako duen zatidura.
 *
 * Bi kasu berezi:
 *  - Botorik gabeko alderdiak inoiz ez du eserlekurik hartzen (0 itzultzen da, ez NaN).
 *  - Huntington-Hill-en zatitzailea 0 da n=0 denean, beraz zatidura Infinity da. Hori ez da
 *    akats bat: horrela alderdi guztiek lehen eserlekua hartzen dute inork bigarrena hartu aurretik.
 */
export function quotient(votes: number, seatsHeld: number, method: DivisorMethodId): number {
  if (votes <= 0) return 0;
  return votes / DIVISOR_METHODS[method].divisor(seatsHeld);
}

export function isDivisorMethod(id: string): id is DivisorMethodId {
  return id in DIVISOR_METHODS;
}
