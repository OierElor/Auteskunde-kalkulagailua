import { describe, expect, it } from 'vitest';
import { runFPTP, runTwoRound } from './majoritarian';
import { runListPR } from './listPR';
import { DEFAULT_TRANSFER_CONFIG, cellKey } from '../transfers';
import { SINGLE_MEMBER_SCENARIO } from '../../data/examples';
import type { Party, RunoffDetail, Scenario } from '../types';

/** Erdikoa 35ean dago: ezkerretik hurbilago eskuinetik baino. Hori da bigarren itzuliaren gakoa. */
const PARTIES: Party[] = [
  { id: 'ezker', name: 'Ezkerra', abbrev: 'EZ', color: '#4a3aa7', position: 10 },
  { id: 'erdi', name: 'Erdikoa', abbrev: 'ER', color: '#2a78d6', position: 35 },
  { id: 'eskuin', name: 'Eskuina', abbrev: 'ES', color: '#eda100', position: 90 },
];

/** Zentro perfektua: bi aldeetatik distantzia berera. */
const CENTRIST: Party[] = PARTIES.map((p) =>
  p.id === 'erdi' ? { ...p, position: 50 } : p,
);

function scenario(
  rows: Record<string, Record<string, number>>,
  seats = 1,
  parties: Party[] = PARTIES,
): Scenario {
  const districts = Object.keys(rows).map((id) => ({ id, name: id, seats }));
  const blankVotes: Scenario['blankVotes'] = {};
  for (const id of Object.keys(rows)) blankVotes[id] = 0;
  return { name: 'proba', parties, districts, votes: rows, blankVotes };
}

const runoff = (o: Partial<Parameters<typeof runTwoRound>[1]> = {}) => ({
  rule: 'top-two' as const,
  qualifyPercent: 12.5,
  transfers: DEFAULT_TRANSFER_CONFIG,
  ...o,
});

describe('FPTP', () => {
  it('boto gehien dituenak irabazten du, gehiengorik gabe ere', () => {
    // Eskuinak %40 baino ez du, baina ezkerra zatituta dago: irabazi egiten du.
    const s = scenario({ bat: { ezker: 35, erdi: 25, eskuin: 40 } });
    const r = runFPTP(s);
    expect(r.totals).toEqual({ ezker: 0, erdi: 0, eskuin: 1 });

    const detail = r.districts[0].detail;
    if (detail.kind !== 'plurality') throw new Error('plurality espero zen');
    expect(detail.winnerPercent).toBeCloseTo(40, 6);
    expect(detail.margin).toBe(5);
  });

  it('langak ez du eraginik: sistema maioritarioek ez dute langarik', () => {
    // Erdikoak %2 baino ez du, baina beste biak are ahulagoak dira: irabazi egiten du.
    const s = scenario({ bat: { ezker: 1, erdi: 2, eskuin: 1 } });
    expect(runFPTP(s).totals.erdi).toBe(1);
  });

  it('eserleku bat baino gehiagoko barrutian, irabazleak denak hartzen ditu — eta abisatzen dugu', () => {
    const s = scenario({ bat: { ezker: 35, erdi: 25, eskuin: 40 } }, 10);
    const r = runFPTP(s);
    expect(r.totals.eskuin).toBe(10);
    expect(r.warnings.map((w) => w.kind)).toContain('general-ticket');
  });

  it('berdinketa abisatzen da', () => {
    const s = scenario({ bat: { ezker: 50, erdi: 0, eskuin: 50 } });
    expect(runFPTP(s).warnings.map((w) => w.kind)).toContain('tie');
  });

  it('eserleku guztiak esleitzen dira', () => {
    const s = scenario({ a: { ezker: 10, erdi: 5, eskuin: 3 }, b: { ezker: 1, erdi: 9, eskuin: 2 } });
    const r = runFPTP(s);
    expect(Object.values(r.totals).reduce((a, b) => a + b, 0)).toBe(r.totalSeats);
  });

  it('FPTP-k gehiengoak fabrikatzen ditu: boto berberak, emaitza guztiz bestelakoa', () => {
    // Hiru barruti uninominal. Eskuinak boto guztien %36 du, baina hiru barrutiak irabazten ditu
    // ezkerra eta erdikoa banatuta daudelako. Proportzionalean herena hartuko luke.
    const rows = {
      a: { ezker: 33, erdi: 31, eskuin: 36 },
      b: { ezker: 33, erdi: 31, eskuin: 36 },
      c: { ezker: 33, erdi: 31, eskuin: 36 },
    };
    const fptp = runFPTP(scenario(rows));
    expect(fptp.totals).toEqual({ ezker: 0, erdi: 0, eskuin: 3 });

    const pr = runListPR(scenario(rows, 1), {
      method: 'dhondt',
      threshold: { percent: 0, scope: 'district', includeBlank: false },
    });
    // Barruti uninominaletan D'Hondt-ek ere irabazlea ematen du: barrutiaren tamaina da gakoa.
    expect(pr.totals).toEqual({ ezker: 0, erdi: 0, eskuin: 3 });

    // Barruti bakar batean, aldiz, hirurek eserlekua lortzen dute.
    const single = runListPR(
      {
        ...scenario({ bat: { ezker: 99, erdi: 93, eskuin: 108 } }),
        districts: [{ id: 'bat', name: 'bat', seats: 3 }],
      },
      { method: 'dhondt', threshold: { percent: 0, scope: 'district', includeBlank: false } },
    );
    expect(single.totals).toEqual({ ezker: 1, erdi: 1, eskuin: 1 });
  });
});

describe('arkitekturaren oinarria', () => {
  it("barruti uninominaletan D'Hondt eta FPTP emaitza BERBERA ematen dute", () => {
    // Aplikazio osoa hipotesi honen gainean eraikita dago: "barruti uninominala = seats:1 duen
    // barruti arrunta". Eserleku BAKARRA dagoenean, zatidurarik handiena beti da boto gehien
    // dituenarena — hau da, D'Hondt pluralitatea DA. Hori hausten bada, datu-eredua dago hautsita,
    // eta 3. faseko sistema mistoek ez lukete funtzionatuko.
    const fptp = runFPTP(SINGLE_MEMBER_SCENARIO);
    const dhondt = runListPR(SINGLE_MEMBER_SCENARIO, {
      method: 'dhondt',
      threshold: { percent: 0, scope: 'district', includeBlank: false },
    });

    expect(fptp.totals).toEqual(dhondt.totals);
    expect(fptp.seatsByDistrict).toEqual(dhondt.seatsByDistrict);
  });

  it('FPTP-k alderdi handi bat guztiz ezaba dezake', () => {
    // Alderdi Gorriak boto guztien %16,4 du eta ZERO eserleku. Alderdi Horiak gutxiago du (%13,2)
    // eta 17 eserleku: eskualdeka kontzentratuta dagoelako. FPTPn kokapenak boto-kopurua garaitzen du.
    const r = runFPTP(SINGLE_MEMBER_SCENARIO);
    expect(r.totals.gorria).toBe(0);
    expect(r.totals.horia).toBeGreaterThan(10);
    expect(r.voteTotals.gorria).toBeGreaterThan(r.voteTotals.horia);
  });
});

describe('bi itzuli', () => {
  it('%50 gainditzen bada, lehen itzulian erabakitzen da', () => {
    const s = scenario({ bat: { ezker: 60, erdi: 25, eskuin: 15 } });
    const r = runTwoRound(s, runoff());
    const detail = r.districts[0].detail as RunoffDetail;

    expect(detail.decidedInFirstRound).toBe(true);
    expect(detail.winner).toBe('ezker');
    expect(detail.transfers).toHaveLength(0);
    expect(r.totals.ezker).toBe(1);
  });

  it('bigarren itzuliak FPTPren irabazlea irauli dezake', () => {
    // Lehen itzulia: eskuina 40, ezkerra 35, erdikoa 25. Eskuinak FPTPn irabaziko luke.
    // Erdikoa (35) ezkerretik hurbilago dagoenez, bere botoak ezkerrera doaz gehienbat: buelta.
    const s = scenario({ bat: { ezker: 35, erdi: 25, eskuin: 40 } });

    expect(runFPTP(s).totals.eskuin).toBe(1);

    const r = runTwoRound(s, runoff());
    const detail = r.districts[0].detail as RunoffDetail;

    expect(detail.decidedInFirstRound).toBe(false);
    expect(detail.qualified).toEqual(['eskuin', 'ezker']);
    expect(detail.eliminated).toEqual(['erdi']);
    expect(detail.winner).toBe('ezker');
    expect(r.totals.ezker).toBe(1);
  });

  it('zentro perfektuak EZ du irauliko: botoak berdin banatzen dira eta aldea bere horretan geratzen da', () => {
    // Erdikoa 50ean: bi aldeetatik distantzia berera. Bere 25 botoak 50/50 banatzen dira, beraz
    // eskuinaren 5 puntuko aldea ez da desagertzen. Transferentziak asimetrikoak izan behar dira.
    const s = scenario({ bat: { ezker: 35, erdi: 25, eskuin: 40 } }, 1, CENTRIST);
    const r = runTwoRound(s, runoff());
    expect(r.totals.eskuin).toBe(1);
  });

  it('transferentzia-matrizea aldatzeak irabazlea alda dezake', () => {
    const s = scenario({ bat: { ezker: 35, erdi: 25, eskuin: 40 } });

    // Erdikoaren botoak eskuinera bakarrik badoaz, eskuinak eusten dio.
    const r = runTwoRound(
      s,
      runoff({
        transfers: {
          ...DEFAULT_TRANSFER_CONFIG,
          abstention: 0,
          cells: { [cellKey('erdi', 'ezker')]: 0, [cellKey('erdi', 'eskuin')]: 100 },
        },
      }),
    );
    expect(r.totals.eskuin).toBe(1);
  });

  it('abstentzioak botoak galtzen ditu, ez ditu asmatzen', () => {
    const s = scenario({ bat: { ezker: 35, erdi: 25, eskuin: 40 } });
    const r = runTwoRound(s, runoff({ transfers: { ...DEFAULT_TRANSFER_CONFIG, abstention: 40 } }));
    const detail = r.districts[0].detail as RunoffDetail;

    // Erdikoaren 25 botoetatik %40 etxean geratzen da.
    expect(detail.abstained).toBeCloseTo(10, 6);

    const secondTotal = Object.values(detail.secondRound).reduce((a, b) => a + b, 0);
    expect(secondTotal + detail.abstained).toBeCloseTo(100, 6);
  });

  it('Frantziako erregela: ehunekoa gainditzen duten guztiak pasatzen dira (triangulaire)', () => {
    const s = scenario({ bat: { ezker: 30, erdi: 30, eskuin: 40 } });
    const r = runTwoRound(s, runoff({ rule: 'qualify', qualifyPercent: 12.5 }));
    const detail = r.districts[0].detail as RunoffDetail;

    expect(detail.qualified).toHaveLength(3);
    expect(detail.eliminated).toHaveLength(0);
  });

  it('inork ez badu ehunekoa lortzen, bi onenak beti pasatzen dira', () => {
    const s = scenario({ bat: { ezker: 34, erdi: 33, eskuin: 33 } });
    const r = runTwoRound(s, runoff({ rule: 'qualify', qualifyPercent: 90 }));
    expect((r.districts[0].detail as RunoffDetail).qualified).toHaveLength(2);
  });

  it('eserleku guztiak esleitzen dira', () => {
    const s = scenario({
      a: { ezker: 35, erdi: 25, eskuin: 40 },
      b: { ezker: 60, erdi: 25, eskuin: 15 },
      c: { ezker: 10, erdi: 45, eskuin: 45 },
    });
    const r = runTwoRound(s, runoff());
    expect(Object.values(r.totals).reduce((a, b) => a + b, 0)).toBe(r.totalSeats);
  });
});
