import type { Party, PartyId } from './types';

/**
 * Boto-transferentziak.
 *
 * ARAZOA: bigarren itzuli baten emaitza kalkulatzeko, bigarren itzuliko botoak behar dira. Ez dira
 * existitzen. Lehen itzuliko boto-kopuruetatik ezin da ondorioztatu alderdi bat kanporatzean bere
 * hautesleak nora joango diren — hori ez dago datuetan.
 *
 * ERANTZUNA: ez dugu asmatzen. Transferentzia-matrize BAT ESKATZEN DUGU, erabiltzaileak editagarria:
 * alderdi bakoitza kanporatzean, bere botoen zein zati doan beste bakoitzera, eta zein zati
 * geratzen den etxean. Lehenetsia hurbiltasun ideologikoan oinarritzen da (ezker-eskuin ardatza),
 * baina hipotesi bat besterik ez da, eta hala aurkezten diogu erabiltzaileari.
 *
 * Matrize berbera erabiliko du STVk 4. fasean.
 */

export interface TransferConfig {
  /** Hurbiltasun ideologikoaren zorroztasuna. Txikiagoa = boto gehiago alderdi hurbilenari. */
  affinity: number;
  /** Abstentzio-tasa lehenetsia (0..100): kanporatutako alderdi baten hautesleen zein zati geratzen den etxean. */
  abstention: number;
  /** Erabiltzaileak eskuz aldatutako gelaxkak: "nondik>nora" → pisua (0..100). */
  cells: Record<string, number>;
  /** Erabiltzaileak eskuz aldatutako abstentzioak: alderdia → 0..100. */
  abstentions: Record<PartyId, number>;
}

export const DEFAULT_TRANSFER_CONFIG: TransferConfig = {
  affinity: 20,
  abstention: 30,
  cells: {},
  abstentions: {},
};

export const cellKey = (from: PartyId, to: PartyId) => `${from}>${to}`;

export interface TransferMatrix {
  /** nondik → nora → ehunekoa. Errenkadaren batura 100 da (abstentzioa aparte doa). */
  weights: Record<PartyId, Record<PartyId, number>>;
  /** nondik → abstentzio-ehunekoa (0..100). */
  abstention: Record<PartyId, number>;
}

/**
 * Matrizea eraikitzen du: lehenetsiak hurbiltasunetik, gero erabiltzailearen gainidazketak.
 * Errenkadak 100era normalizatzen dira, erabiltzaileak edozer idatzi arren.
 */
export function buildTransferMatrix(parties: Party[], cfg: TransferConfig): TransferMatrix {
  const weights: Record<PartyId, Record<PartyId, number>> = {};
  const abstention: Record<PartyId, number> = {};
  const lambda = Math.max(1, cfg.affinity);

  for (const from of parties) {
    const others = parties.filter((p) => p.id !== from.id);

    const raw: Record<PartyId, number> = {};
    for (const to of others) {
      const override = cfg.cells[cellKey(from.id, to.id)];
      raw[to.id] =
        override !== undefined
          ? Math.max(0, override)
          : Math.exp(-Math.abs(from.position - to.position) / lambda);
    }

    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    weights[from.id] = {};
    for (const to of others) {
      weights[from.id][to.id] = sum > 0 ? (raw[to.id] / sum) * 100 : 0;
    }

    const a = cfg.abstentions[from.id];
    abstention[from.id] = Math.min(100, Math.max(0, a !== undefined ? a : cfg.abstention));
  }

  return { weights, abstention };
}

/**
 * Kanporatutako alderdi baten botoak bizirik dirautenen artean banatzen ditu.
 *
 * Bi urrats: (1) abstentzio-tasak zehazten du zenbat boto galtzen diren; (2) gainerakoak
 * biziraunleen artean banatzen dira, matrizeko pisuen arabera BERRINORMALIZATUTA — hautesle batek
 * bere bigarren aukera ere kanporatuta ikusten badu, geratzen direnen artean aukeratzen du, ez du
 * botoa besterik gabe galtzen.
 *
 * Biziraun duen batekin ere afinitaterik ez badu, dena abstentziora doa.
 */
export function distributeVotes(
  from: PartyId,
  votes: number,
  survivors: PartyId[],
  matrix: TransferMatrix,
): { flows: { to: PartyId; votes: number }[]; abstained: number } {
  if (votes <= 0 || survivors.length === 0) {
    return { flows: [], abstained: Math.max(0, votes) };
  }

  const transferable = votes * (1 - (matrix.abstention[from] ?? 0) / 100);
  const row = matrix.weights[from] ?? {};
  const total = survivors.reduce((sum, to) => sum + (row[to] ?? 0), 0);

  if (total <= 0) return { flows: [], abstained: votes };

  const flows = survivors
    .map((to) => ({ to, votes: (transferable * (row[to] ?? 0)) / total }))
    .filter((f) => f.votes > 0);

  return { flows, abstained: votes - transferable };
}
