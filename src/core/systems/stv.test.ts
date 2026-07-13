import { describe, expect, it } from 'vitest';
import { runStv, runStvDistrict } from './stv';
import { runFPTP } from './majoritarian';
import { runListPR } from './listPR';
import { computeIndices } from '../indices';
import { DEFAULT_CANDIDATE_CONFIG } from '../candidates';
import { DEFAULT_TRANSFER_CONFIG, cellKey } from '../transfers';
import { DEFAULT_SCENARIO, SINGLE_MEMBER_SCENARIO } from '../../data/examples';
import type { Party, Scenario, StvDetail } from '../types';

/** Txartel-sorta bat eraikitzeko lagungarria: ordena eta kopurua. */
const ballot = (ranking: string[], value: number) => ({ ranking, value, position: 0 });

describe('STV: kasu kanonikoak', () => {
  it('kuota Droop da: ⌊botoak / (eserlekuak+1)⌋ + 1', () => {
    const { detail } = runStvDistrict(['a', 'b'], [ballot(['a'], 100)], 1);
    // 100 boto, 1 eserleku → ⌊100/2⌋ + 1 = 51
    expect(detail.quota).toBe(51);
  });

  it('kuota gainditzen duenak berehala irabazten du', () => {
    const { elected } = runStvDistrict(['a', 'b', 'c'], [ballot(['a'], 60), ballot(['b'], 40)], 1);
    expect(elected).toEqual(['a']);
  });

  it('IRV: kanporaketa mailakatuak irabazlea alda dezake', () => {
    // Lehen lehentasunak: A 40, B 35, C 25. FPTPn A-k irabaziko luke.
    // C kanporatuta, bere botoak B-ra doaz osorik → B 60, A 40. B irabazle.
    const { elected, detail } = runStvDistrict(
      ['a', 'b', 'c'],
      [ballot(['a'], 40), ballot(['b'], 35), ballot(['c', 'b'], 25)],
      1,
    );

    expect(elected).toEqual(['b']);
    expect(detail.rounds[0].eliminated).toBe('c');
    expect(detail.rounds[0].transfers).toEqual([{ from: 'c', to: 'b', votes: 25 }]);
  });

  it('Gregory: SOBERAKINA bakarrik transferitzen da, ez boto guztiak', () => {
    // 2 eserleku, 300 boto → kuota = ⌊300/3⌋ + 1 = 101.
    // A-k 200 boto ditu → 99 soberakin. Transferentzia-balioa = 99/200 = 0,495.
    // A-ren txartelen bigarren lehentasuna B da → B-k 200 × 0,495 = 99 jasotzen ditu.
    const { elected, detail } = runStvDistrict(
      ['a', 'b', 'c'],
      [ballot(['a', 'b'], 200), ballot(['c'], 100)],
      2,
    );

    expect(detail.quota).toBe(101);
    expect(elected[0]).toBe('a');

    const surplus = detail.rounds[0].transfers.find((t) => t.to === 'b');
    expect(surplus!.votes).toBeCloseTo(99, 6);

    // B-k soberakinarekin bakarrik ez du kuota lortzen (99 < 101), baina C baino gehiago du?
    // Ez: C-k 100 ditu. Beraz B kanporatzen da eta C hautatzen da.
    expect(elected).toHaveLength(2);
  });

  it('soberakinik ez badago, txartelek ez dute balio gehiagorik', () => {
    // A-k kuota ZEHATZA du: ez dago soberakinik, beraz ez da ezer transferitzen.
    const { detail } = runStvDistrict(['a', 'b', 'c'], [ballot(['a', 'b'], 51), ballot(['c'], 49)], 1);
    expect(detail.rounds[0].elected).toBe('a');
    expect(detail.rounds[0].transfers).toHaveLength(0);
  });

  it('"plumper" txartelak agortu egiten dira, eta irabazleak kuota baino GUTXIAGO lor dezake', () => {
    // Hautesle guztiek lehentasun bakarra adierazten dute. 100 boto, 1 eserleku → kuota 51.
    // A (20) kanporatzen da → bere botoak inora ez. Gero C (35) ere kanporatzen da → berdin.
    // B geratzen da bakarrik eta hautatua da 45 botorekin — KUOTA BAINO GUTXIAGO.
    //
    // Ez da akatsa: 55 boto agortu direnez, hautesle-gorputz ERAGINKORRA txikitu da. STVren
    // propietate erreala da, eta "boto agortuak" zenbatzea horregatik da beharrezkoa.
    const { detail, elected } = runStvDistrict(
      ['a', 'b', 'c'],
      [ballot(['a'], 20), ballot(['b'], 45), ballot(['c'], 35)],
      1,
    );

    expect(elected).toEqual(['b']);
    expect(detail.quota).toBe(51);
    expect(detail.exhausted).toBe(55);

    const finalCount = detail.rounds[detail.rounds.length - 1].counts.b;
    expect(finalCount).toBe(45);
    expect(finalCount).toBeLessThan(detail.quota);
  });

  it('geratzen diren hautagaiak eserlekuak beste badira, denak hautatzen dira', () => {
    const { elected } = runStvDistrict(['a', 'b'], [ballot(['a'], 10), ballot(['b'], 5)], 2);
    expect(elected.sort()).toEqual(['a', 'b']);
  });
});

describe('STV: inbarianteak', () => {
  it('ez ditu eserleku gehiago ematen daudenak baino, ezta gutxiago ere botoak nahikoa badira', () => {
    for (const seats of [1, 2, 3, 5]) {
      const { elected } = runStvDistrict(
        ['a', 'b', 'c', 'd', 'e', 'f'],
        [
          ballot(['a', 'b', 'c'], 300),
          ballot(['b', 'a', 'c'], 250),
          ballot(['c', 'd'], 200),
          ballot(['d', 'e'], 150),
          ballot(['e', 'f'], 100),
        ],
        seats,
      );
      expect(elected, `${seats} eserleku`).toHaveLength(seats);
      expect(new Set(elected).size, `${seats}: errepikatuak`).toBe(seats);
    }
  });

  it('hautagai bat ez da bi aldiz hautatzen, ezta hautatu eta kanporatu ere', () => {
    const { detail } = runStvDistrict(
      ['a', 'b', 'c', 'd'],
      [ballot(['a', 'b'], 100), ballot(['b', 'c'], 90), ballot(['c', 'd'], 80), ballot(['d'], 70)],
      2,
    );
    const touched = detail.rounds.flatMap((r) => [r.elected, r.eliminated].filter(Boolean));
    expect(new Set(touched).size).toBe(touched.length);
  });

  it('botoak ez dira sortzen: transferentziek ezin dute jatorrizkoa gainditu', () => {
    const { detail } = runStvDistrict(
      ['a', 'b', 'c'],
      [ballot(['a', 'b'], 500), ballot(['c'], 100)],
      2,
    );
    const transferred = detail.rounds.flatMap((r) => r.transfers).reduce((s, t) => s + t.votes, 0);
    expect(transferred).toBeLessThanOrEqual(detail.totalVotes + 1e-6);
  });
});

describe('STVren proportzionaltasuna NONDIK datorren', () => {
  const opts = { transfers: DEFAULT_TRANSFER_CONFIG, candidates: DEFAULT_CANDIDATE_CONFIG };
  const noThreshold = { percent: 0, scope: 'district' as const, includeBlank: false };

  it('IRV-k (barruti uninominalak) EZ du proportzionaltasuna hobetzen', () => {
    // Sarritan gaizki ulertzen da: boto ordenatuak berak ez dakar proportzionaltasunik.
    // Eserleku BAKARRA dagoen barrutian, IRV sistema MAIORITARIOA da — FPTP bezain
    // desproportzionala. Nor irabazten duen aldatzen du, ez zenbat.
    const fptp = runFPTP(SINGLE_MEMBER_SCENARIO);
    const irv = runStv(SINGLE_MEMBER_SCENARIO, opts);

    const gFptp = computeIndices(SINGLE_MEMBER_SCENARIO, fptp).gallagher;
    const gIrv = computeIndices(SINGLE_MEMBER_SCENARIO, irv).gallagher;

    expect(gFptp).toBeGreaterThan(12);
    expect(gIrv).toBeGreaterThan(12);
    // Ia berdinak: IRV-k ez du sistema konpontzen.
    expect(Math.abs(gIrv - gFptp)).toBeLessThan(3);
  });

  it('STV-k (barruti handiak) BAI: proportzionaltasuna barrutiaren tamainatik dator', () => {
    const stv = runStv(DEFAULT_SCENARIO, opts); // 3 barruti × 25 eserleku
    const pr = runListPR(DEFAULT_SCENARIO, { method: 'dhondt', threshold: noThreshold });

    const gStv = computeIndices(DEFAULT_SCENARIO, stv).gallagher;
    const gPr = computeIndices(DEFAULT_SCENARIO, pr).gallagher;

    // 25 eserlekuko barrutietan STV proportzionala da, D'Hondt bezainbeste.
    expect(gStv).toBeLessThan(5);
    expect(Math.abs(gStv - gPr)).toBeLessThan(2);
  });
});

describe('STV eszenatoki oso batean', () => {
  const PARTIES: Party[] = [
    { id: 'ezker', name: 'Ezkerra', abbrev: 'EZ', color: '#4a3aa7', position: 15 },
    { id: 'erdi', name: 'Erdikoa', abbrev: 'ER', color: '#2a78d6', position: 45 },
    { id: 'eskuin', name: 'Eskuina', abbrev: 'ES', color: '#eda100', position: 85 },
  ];

  const scenario = (seats: number, votes: Record<string, number>): Scenario => ({
    name: 'proba',
    parties: PARTIES,
    districts: [{ id: 'bat', name: 'Bat', seats }],
    votes: { bat: votes },
    blankVotes: { bat: 0 },
  });

  const opts = {
    transfers: DEFAULT_TRANSFER_CONFIG,
    candidates: DEFAULT_CANDIDATE_CONFIG,
  };

  it('eserleku guztiak esleitzen dira', () => {
    for (const seats of [1, 3, 5, 9]) {
      const r = runStv(scenario(seats, { ezker: 4000, erdi: 3500, eskuin: 2500 }), opts);
      const given = Object.values(r.totals).reduce((a, b) => a + b, 0);
      expect(given, `${seats}`).toBe(seats);
    }
  });

  it('barruti anitzeko STVk proportzionaltasuna ematen du', () => {
    const s = scenario(9, { ezker: 4000, erdi: 3500, eskuin: 2500 });
    const r = runStv(s, opts);
    // 40/35/25 → 9 eserleku: hirurek ordezkaritza dute.
    for (const p of PARTIES) expect(r.totals[p.id], p.id).toBeGreaterThan(0);
  });

  it('eserleku bakarreko barrutian IRV da, eta FPTPren irabazlea irauli dezake', () => {
    // Eskuina lehena da lehen lehentasunetan (%40), baina ezkerra eta erdikoa hurbilago daude
    // elkarrengandik: erdikoa kanporatuta, bere botoak ezkerrera doaz eta irauli egiten du.
    const s = scenario(1, { ezker: 3500, erdi: 2500, eskuin: 4000 });

    expect(runFPTP(s).totals.eskuin).toBe(1);

    const r = runStv(s, {
      ...opts,
      transfers: {
        ...DEFAULT_TRANSFER_CONFIG,
        abstention: 0,
        cells: { [cellKey('erdi', 'ezker')]: 100, [cellKey('erdi', 'eskuin')]: 0 },
      },
    });
    expect(r.totals.ezker).toBe(1);
  });

  it('transferentzia-matrizea da hipotesia: aldatuz gero, emaitza aldatzen da', () => {
    const s = scenario(1, { ezker: 3500, erdi: 2500, eskuin: 4000 });

    const toLeft = runStv(s, {
      ...opts,
      transfers: {
        ...DEFAULT_TRANSFER_CONFIG,
        abstention: 0,
        cells: { [cellKey('erdi', 'ezker')]: 100, [cellKey('erdi', 'eskuin')]: 0 },
      },
    });
    const toRight = runStv(s, {
      ...opts,
      transfers: {
        ...DEFAULT_TRANSFER_CONFIG,
        abstention: 0,
        cells: { [cellKey('erdi', 'ezker')]: 0, [cellKey('erdi', 'eskuin')]: 100 },
      },
    });

    expect(toLeft.totals.ezker).toBe(1);
    expect(toRight.totals.eskuin).toBe(1);
  });

  it('erronda bakoitzean ekintza bakarra gertatzen da: irakurgarria da', () => {
    const s = scenario(3, { ezker: 4000, erdi: 3500, eskuin: 2500 });
    const detail = runStv(s, opts).districts[0].detail as StvDetail;

    for (const round of detail.rounds) {
      const actions = [round.elected, round.eliminated].filter(Boolean).length;
      expect(actions).toBeLessThanOrEqual(1);
    }
    expect(detail.rounds.length).toBeGreaterThan(0);
  });
});
