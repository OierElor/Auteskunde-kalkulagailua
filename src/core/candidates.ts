import type { DistrictId, ElectionResult, PartyId, Scenario } from './types';

/**
 * HAUTAGAIAK.
 *
 * Orain arte alderdiak izan dira unitatea. Zerrenda irekiek eta STVk hautagai-mailako datuak behar
 * dituzte: zerrenda irekiek alderdiaren eserleku KOPURUA ez dute aldatzen —hautagaien ORDENA
 * baizik—, eta STVk hautagaiak ordenatzen ditu, ez alderdiak.
 *
 * Hautagaiak ez dira eszenatokian gordetzen: eszenatokitik ONDORIOZTATZEN dira modu deterministan
 * (hazi finko batekin). Horrela CSVak sinple jarraitzen du eta 450 objektu ez dira nonbait gorde
 * behar. Erabiltzaileak lehentasun-botoak alda ditzake, eta gainidazketa horiek bakarrik gordetzen
 * dira.
 */

export interface Candidate {
  /** Egonkorra eta ondorioztagarria: "bizkaia:urdina:3". */
  id: string;
  districtId: DistrictId;
  partyId: PartyId;
  name: string;
  /** Zerrendako postua, 1etik. */
  listOrder: number;
  /** Lehentasun-botoak (zerrenda irekietarako). */
  preferenceVotes: number;
}

export type ListMode = 'closed' | 'open' | 'flexible';

export interface CandidateConfig {
  listMode: ListMode;
  /**
   * Zerrenda malguan: hautagai bat zerrendako ordenatik AURRERATZEKO behar duen lehentasun-botoen
   * kopurua, alderdiaren kuotaren ehunekotan. Herbehereetan %25 ingurukoa da.
   */
  flexibleQuota: number;
  /** Erabiltzaileak eskuz jarritako lehentasun-botoak: hautagaiaren id → botoak. */
  preferences: Record<string, number>;
}

export const DEFAULT_CANDIDATE_CONFIG: CandidateConfig = {
  listMode: 'closed',
  flexibleQuota: 25,
  preferences: {},
};

export const candidateId = (districtId: DistrictId, partyId: PartyId, order: number) =>
  `${districtId}:${partyId}:${order}`;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Testu batetik hazi egonkor bat: hautagai berberak beti lehentasun-boto berberekin. */
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Alderdi bakoitzeko hautagaiak sortzen ditu barruti bakoitzean (barrutiak dituen eserleku adina:
 * ezin baitu gehiago irabazi).
 *
 * Lehentasun-botoak sintetikoak dira: zerrendaren goikoek gehiago jasotzen dute, baina zaratarekin
 * —bestela zerrenda irekiak ez luke inoiz ordena aldatuko eta mekanismoa ikusezina litzateke.
 */
export function generateCandidates(scenario: Scenario, cfg: CandidateConfig): Candidate[] {
  const out: Candidate[] = [];

  for (const district of scenario.districts) {
    for (const party of scenario.parties) {
      const votes = scenario.votes[district.id]?.[party.id] ?? 0;
      const count = Math.max(1, district.seats);
      const random = seededRandom(hashSeed(`${district.id}:${party.id}`));

      // Zerrendako postuaren araberako pisua, zarata dezenterekin.
      const weights = Array.from({ length: count }, (_, i) => {
        const rank = Math.exp(-i / Math.max(1, count / 3));
        return rank * (0.55 + 0.9 * random());
      });
      const total = weights.reduce((a, b) => a + b, 0);

      for (let i = 0; i < count; i++) {
        const id = candidateId(district.id, party.id, i + 1);
        const generated = total > 0 ? Math.round((weights[i] / total) * votes) : 0;
        out.push({
          id,
          districtId: district.id,
          partyId: party.id,
          name: `${party.abbrev} ${i + 1}`,
          listOrder: i + 1,
          preferenceVotes: cfg.preferences[id] ?? generated,
        });
      }
    }
  }

  return out;
}

export interface ElectedCandidate {
  candidate: Candidate;
  /** Zerrenda itxiarekin ere hautatuko litzatekeen. false = zerrenda irekiak sartu du. */
  wouldBeElectedClosed: boolean;
}

/**
 * Alderdi batek irabazitako eserlekuak ZEIN hautagairi dagozkien.
 *
 * Hiru modu:
 *   itxia   → zerrendako ordena hutsa. Alderdiak erabakitzen du; hautesleak ez du ezer esaten.
 *   irekia  → lehentasun-boto gehien dutenak. Hautesleak erabakitzen du.
 *   malgua  → kuota bat gainditzen dutenak aurreratzen dira; gainerakoak ordenaz. Erdibidea.
 *
 * Alderdiaren eserleku KOPURUA ez da inoiz aldatzen: geruza hau edozein sistema proportzionalen
 * gainean doa.
 */
export function electedCandidates(
  scenario: Scenario,
  result: ElectionResult,
  candidates: Candidate[],
  cfg: CandidateConfig,
): Record<DistrictId, ElectedCandidate[]> {
  const byDistrict: Record<DistrictId, ElectedCandidate[]> = {};

  for (const district of scenario.districts) {
    const elected: ElectedCandidate[] = [];

    for (const party of scenario.parties) {
      const seats = result.seatsByDistrict[district.id]?.[party.id] ?? 0;
      if (seats <= 0) continue;

      const list = candidates
        .filter((c) => c.districtId === district.id && c.partyId === party.id)
        .sort((a, b) => a.listOrder - b.listOrder);

      const closedWinners = new Set(list.slice(0, seats).map((c) => c.id));

      let chosen: Candidate[];
      if (cfg.listMode === 'closed') {
        chosen = list.slice(0, seats);
      } else if (cfg.listMode === 'open') {
        chosen = [...list]
          .sort((a, b) => b.preferenceVotes - a.preferenceVotes || a.listOrder - b.listOrder)
          .slice(0, seats);
      } else {
        // Malgua: kuota gainditzen dutenak lehenengo (beren artean boto gehienaren arabera),
        // gero gainerakoak zerrendako ordenaz.
        const partyVotes = scenario.votes[district.id]?.[party.id] ?? 0;
        const quota = (partyVotes / Math.max(1, district.seats)) * (cfg.flexibleQuota / 100);

        const promoted = list
          .filter((c) => quota > 0 && c.preferenceVotes >= quota)
          .sort((a, b) => b.preferenceVotes - a.preferenceVotes || a.listOrder - b.listOrder);
        const promotedIds = new Set(promoted.map((c) => c.id));
        const rest = list.filter((c) => !promotedIds.has(c.id));

        chosen = [...promoted, ...rest].slice(0, seats);
      }

      for (const candidate of chosen) {
        elected.push({ candidate, wouldBeElectedClosed: closedWinners.has(candidate.id) });
      }
    }

    byDistrict[district.id] = elected;
  }

  return byDistrict;
}
