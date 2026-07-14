import { create } from 'zustand';
import { csvToScenario } from '../core/csv';
import { defaultColorForIndex } from '../core/palette';
import { DEFAULT_SYSTEM_CONFIG } from '../core/systems';
import type { SystemConfig, SystemId } from '../core/systems';
import { DEFAULT_TRANSFER_CONFIG, cellKey } from '../core/transfers';
import type { TransferConfig } from '../core/transfers';
import type { District, MethodId, Party, PartyId, Scenario, ThresholdConfig } from '../core/types';
import { DEFAULT_SCENARIO, EXAMPLES } from '../data/examples';
import { applyKnownParties } from '../data/knownParties';

interface Snapshot {
  scenario: Scenario;
  config: SystemConfig;
}

interface AppState extends Snapshot {
  coalition: PartyId[];
  past: Snapshot[];
  future: Snapshot[];
  /** Kargatuta dagoen adibidea, hautatzailean nabarmentzeko. CSV bat inportatuz gero, null. */
  exampleId: string | null;

  loadExample: (id: string) => void;
  importCsv: (text: string) => void;

  setSystem: (system: SystemId) => void;
  setMethod: (method: MethodId) => void;
  setThreshold: (patch: Partial<ThresholdConfig>) => void;
  setRunoff: (patch: Partial<SystemConfig['runoff']>) => void;
  setMixed: (patch: Partial<SystemConfig['mixed']>) => void;
  setCandidates: (patch: Partial<SystemConfig['candidates']>) => void;
  /** Hautagai baten lehentasun-botoak eskuz jarri. */
  setPreference: (candidateId: string, votes: number) => void;
  resetPreferences: () => void;
  /** Bigarren botoa sortu (lehen botoaren kopia gisa), edo kendu. */
  enableSecondVotes: (on: boolean) => void;
  setSecondVotes: (districtId: string, partyId: PartyId, votes: number) => void;
  setTransfers: (patch: Partial<TransferConfig>) => void;
  /** Matrizeko gelaxka bat eskuz jarri (ehunekotan). */
  setTransferCell: (from: PartyId, to: PartyId, percent: number) => void;
  setPartyAbstention: (from: PartyId, percent: number) => void;
  /** Eskuzko gainidazketa guztiak kendu: hurbiltasunean oinarritutako lehenetsira itzuli. */
  resetTransfers: () => void;

  addParty: () => void;
  removeParty: (id: PartyId) => void;
  updateParty: (id: PartyId, patch: Partial<Party>) => void;

  addDistrict: () => void;
  removeDistrict: (id: string) => void;
  updateDistrict: (id: string, patch: Partial<District>) => void;
  setBlankVotes: (districtId: string, votes: number) => void;

  setVotes: (districtId: string, partyId: PartyId, votes: number) => void;
  /** Barruti guztien eserlekuak batera doitzeko (kontrol-paneleko graduatzailea). */
  scaleAllSeats: (total: number) => void;

  toggleCoalition: (id: PartyId) => void;
  clearCoalition: () => void;

  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 50;
/** Graduatzaile bat arrastatzeak ez du 50 urrats sortu behar: tarte honetan aldaketak batzen dira. */
const COALESCE_MS = 700;

let lastTag: string | null = null;
let lastAt = 0;

export const useApp = create<AppState>((set, get) => {
  /**
   * Aldaketa bat aplikatzen du historia gordez. `tag` berdina errepikatzen bada segidan
   * (graduatzaile bat mugitzean, adibidez), urrats bakarrean batzen dira.
   */
  function commit(tag: string, patch: (s: AppState) => Partial<Snapshot>) {
    const state = get();
    const now = Date.now();
    const coalesce = tag === lastTag && now - lastAt < COALESCE_MS;
    lastTag = tag;
    lastAt = now;

    const previous: Snapshot = { scenario: state.scenario, config: state.config };
    set({
      ...patch(state),
      past: coalesce ? state.past : [...state.past, previous].slice(-HISTORY_LIMIT),
      future: [],
    });
  }

  return {
    scenario: DEFAULT_SCENARIO,
    config: DEFAULT_SYSTEM_CONFIG,
    coalition: [],
    past: [],
    future: [],
    exampleId: 'hiru-barruti',

    loadExample: (id) => {
      const example = EXAMPLES.find((e) => e.id === id);
      if (!example) return;
      lastTag = null;

      // Eszenatokiak BERE ARAU LEGALAK dakartza. Hori gabe, Eusko Legebiltzarra kargatuta zure
      // uneko langarekin kalkulatuko luke eta emaitza ez litzateke ofiziala — jakin gabe zergatik.
      // Gero eskuz alda ditzakezu: horixe da tresnaren funtsa.
      commit(`example:${id}`, (s) => ({
        scenario: example.scenario,
        config: { ...s.config, ...example.config },
      }));
      set({ coalition: [], exampleId: id });
    },

    importCsv: (text) => {
      // Akatsak deitzaileak harrapatzen ditu: hark daki nola erakutsi erabiltzaileari.
      //
      // `applyKnownParties`: datu ofizialetan izenak luzeak dira eta CSVak ez du kolorerik ez
      // ezker-eskuin posiziorik garraiatzen. Alderdi ezagunei beren laburdura, marka-kolorea eta
      // posizioa ematen dizkiegu, bestela hemizikloa zutabe-ordenan marraztuko litzateke.
      const scenario = applyKnownParties(csvToScenario(text, get().scenario));
      lastTag = null;
      commit('csv', () => ({ scenario }));
      // Jada ez da adibide bat: hautatzailean ez da ezer nabarmenduta geratzen.
      set({ coalition: [], exampleId: null });
    },

    setSystem: (system) => commit('system', (s) => ({ config: { ...s.config, system } })),
    setMethod: (method) => commit('method', (s) => ({ config: { ...s.config, method } })),
    setThreshold: (patch) =>
      commit('threshold', (s) => ({
        config: { ...s.config, threshold: { ...s.config.threshold, ...patch } },
      })),

    setRunoff: (patch) =>
      commit('runoff', (s) => ({
        config: { ...s.config, runoff: { ...s.config.runoff, ...patch } },
      })),

    setMixed: (patch) =>
      commit('mixed', (s) => ({
        config: { ...s.config, mixed: { ...s.config.mixed, ...patch } },
      })),

    setCandidates: (patch) =>
      commit('candidates', (s) => ({
        config: { ...s.config, candidates: { ...s.config.candidates, ...patch } },
      })),

    setPreference: (candidateId, votes) =>
      commit(`preference:${candidateId}`, (s) => ({
        config: {
          ...s.config,
          candidates: {
            ...s.config.candidates,
            preferences: {
              ...s.config.candidates.preferences,
              [candidateId]: Math.max(0, votes),
            },
          },
        },
      })),

    resetPreferences: () =>
      commit('reset-preferences', (s) => ({
        config: {
          ...s.config,
          candidates: { ...s.config.candidates, preferences: {} },
        },
      })),

    enableSecondVotes: (on) =>
      commit('second-votes', (s) => {
        if (!on) {
          const { secondVotes: _drop, ...rest } = s.scenario;
          return { scenario: rest, config: { ...s.config, mixed: { ...s.config.mixed, ballot: 'same' } } };
        }
        // Lehen botoaren kopia bat da abiapuntua: hortik editatzen du erabiltzaileak boto banatua.
        const secondVotes: Scenario['secondVotes'] = {};
        for (const d of s.scenario.districts) secondVotes[d.id] = { ...s.scenario.votes[d.id] };
        return {
          scenario: { ...s.scenario, secondVotes },
          config: { ...s.config, mixed: { ...s.config.mixed, ballot: 'second' } },
        };
      }),

    setSecondVotes: (districtId, partyId, votes) =>
      commit(`second:${districtId}:${partyId}`, (s) => ({
        scenario: {
          ...s.scenario,
          secondVotes: {
            ...s.scenario.secondVotes,
            [districtId]: {
              ...(s.scenario.secondVotes?.[districtId] ?? {}),
              [partyId]: Math.max(0, votes),
            },
          },
        },
      })),

    setTransfers: (patch) =>
      commit('transfers', (s) => ({
        config: { ...s.config, transfers: { ...s.config.transfers, ...patch } },
      })),

    setTransferCell: (from, to, percent) =>
      commit(`transfer:${from}:${to}`, (s) => ({
        config: {
          ...s.config,
          transfers: {
            ...s.config.transfers,
            cells: {
              ...s.config.transfers.cells,
              [cellKey(from, to)]: Math.max(0, percent),
            },
          },
        },
      })),

    setPartyAbstention: (from, percent) =>
      commit(`abstention:${from}`, (s) => ({
        config: {
          ...s.config,
          transfers: {
            ...s.config.transfers,
            abstentions: {
              ...s.config.transfers.abstentions,
              [from]: Math.min(100, Math.max(0, percent)),
            },
          },
        },
      })),

    resetTransfers: () =>
      commit('reset-transfers', (s) => ({
        config: {
          ...s.config,
          transfers: { ...DEFAULT_TRANSFER_CONFIG, affinity: s.config.transfers.affinity },
        },
      })),

    addParty: () =>
      commit('add-party', (s) => {
        const n = s.scenario.parties.length;
        const party: Party = {
          id: `alderdia-${Date.now().toString(36)}`,
          name: `Alderdi berria ${n + 1}`,
          abbrev: `A${n + 1}`,
          color: defaultColorForIndex(n),
          position: 50,
        };
        const votes = { ...s.scenario.votes };
        for (const d of s.scenario.districts) votes[d.id] = { ...votes[d.id], [party.id]: 0 };
        return {
          scenario: { ...s.scenario, parties: [...s.scenario.parties, party], votes },
        };
      }),

    removeParty: (id) =>
      commit('remove-party', (s) => {
        const votes: Scenario['votes'] = {};
        for (const d of s.scenario.districts) {
          const { [id]: _removed, ...rest } = s.scenario.votes[d.id] ?? {};
          votes[d.id] = rest;
        }
        return {
          scenario: {
            ...s.scenario,
            parties: s.scenario.parties.filter((p) => p.id !== id),
            votes,
          },
        };
      }),

    updateParty: (id, patch) =>
      commit(`party:${id}:${Object.keys(patch).join(',')}`, (s) => ({
        scenario: {
          ...s.scenario,
          parties: s.scenario.parties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        },
      })),

    addDistrict: () =>
      commit('add-district', (s) => {
        const id = `barrutia-${Date.now().toString(36)}`;
        const row: Record<PartyId, number> = {};
        for (const p of s.scenario.parties) row[p.id] = 0;
        return {
          scenario: {
            ...s.scenario,
            districts: [
              ...s.scenario.districts,
              { id, name: `Barruti berria ${s.scenario.districts.length + 1}`, seats: 10 },
            ],
            votes: { ...s.scenario.votes, [id]: row },
            blankVotes: { ...s.scenario.blankVotes, [id]: 0 },
          },
        };
      }),

    removeDistrict: (id) =>
      commit('remove-district', (s) => {
        const { [id]: _v, ...votes } = s.scenario.votes;
        const { [id]: _b, ...blankVotes } = s.scenario.blankVotes;
        return {
          scenario: {
            ...s.scenario,
            districts: s.scenario.districts.filter((d) => d.id !== id),
            votes,
            blankVotes,
          },
        };
      }),

    updateDistrict: (id, patch) =>
      commit(`district:${id}:${Object.keys(patch).join(',')}`, (s) => ({
        scenario: {
          ...s.scenario,
          districts: s.scenario.districts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        },
      })),

    setBlankVotes: (districtId, votes) =>
      commit(`blank:${districtId}`, (s) => ({
        scenario: {
          ...s.scenario,
          blankVotes: { ...s.scenario.blankVotes, [districtId]: Math.max(0, votes) },
        },
      })),

    setVotes: (districtId, partyId, votes) =>
      commit(`votes:${districtId}:${partyId}`, (s) => ({
        scenario: {
          ...s.scenario,
          votes: {
            ...s.scenario.votes,
            [districtId]: { ...s.scenario.votes[districtId], [partyId]: Math.max(0, votes) },
          },
        },
      })),

    scaleAllSeats: (total) =>
      commit('scale-seats', (s) => {
        const districts = s.scenario.districts;
        if (districts.length === 0) return {};

        // Eserlekuak barrutien artean banatzen ditugu oraingo proportzioari eutsiz. Hondarra
        // barruti handienei ematen zaie, guztizkoa zehatz-zehatz betetzeko.
        const current = districts.reduce((sum, d) => sum + d.seats, 0);
        const shares = districts.map((d) => (current > 0 ? d.seats / current : 1 / districts.length));
        const raw = shares.map((share) => share * total);
        const base = raw.map((v) => Math.max(1, Math.floor(v)));

        let remaining = total - base.reduce((a, b) => a + b, 0);
        const order = raw
          .map((v, i) => ({ i, frac: v - Math.floor(v) }))
          .sort((a, b) => b.frac - a.frac);
        for (let k = 0; remaining > 0 && order.length > 0; k++, remaining--) {
          base[order[k % order.length].i] += 1;
        }
        // Guztizkoa gainditu bada (barruti bakoitzak gutxienez 1 duelako), handienetatik kentzen dugu.
        while (remaining < 0) {
          const biggest = base.indexOf(Math.max(...base));
          if (base[biggest] <= 1) break;
          base[biggest] -= 1;
          remaining++;
        }

        return {
          scenario: {
            ...s.scenario,
            districts: districts.map((d, i) => ({ ...d, seats: base[i] })),
          },
        };
      }),

    toggleCoalition: (id) =>
      set((s) => ({
        coalition: s.coalition.includes(id)
          ? s.coalition.filter((p) => p !== id)
          : [...s.coalition, id],
      })),

    clearCoalition: () => set({ coalition: [] }),

    undo: () =>
      set((s) => {
        const previous = s.past[s.past.length - 1];
        if (!previous) return {};
        lastTag = null;
        return {
          scenario: previous.scenario,
          config: previous.config,
          past: s.past.slice(0, -1),
          future: [{ scenario: s.scenario, config: s.config }, ...s.future],
        };
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0];
        if (!next) return {};
        lastTag = null;
        return {
          scenario: next.scenario,
          config: next.config,
          past: [...s.past, { scenario: s.scenario, config: s.config }],
          future: s.future.slice(1),
        };
      }),
  };
});
