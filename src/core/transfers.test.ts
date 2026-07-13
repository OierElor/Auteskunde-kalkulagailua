import { describe, expect, it } from 'vitest';
import { DEFAULT_TRANSFER_CONFIG, buildTransferMatrix, cellKey, distributeVotes } from './transfers';
import type { Party } from './types';

const PARTIES: Party[] = [
  { id: 'ezker', name: 'Ezkerra', abbrev: 'EZ', color: '#4a3aa7', position: 10 },
  { id: 'erdi', name: 'Erdikoa', abbrev: 'ER', color: '#2a78d6', position: 50 },
  { id: 'eskuin', name: 'Eskuina', abbrev: 'ES', color: '#eda100', position: 90 },
];

const cfg = (o: Partial<typeof DEFAULT_TRANSFER_CONFIG> = {}) => ({
  ...DEFAULT_TRANSFER_CONFIG,
  ...o,
});

describe('transferentzia-matrizea', () => {
  it('errenkada bakoitza 100era normalizatzen da', () => {
    const m = buildTransferMatrix(PARTIES, cfg());
    for (const p of PARTIES) {
      const sum = Object.values(m.weights[p.id]).reduce((a, b) => a + b, 0);
      expect(sum, p.id).toBeCloseTo(100, 6);
    }
  });

  it('alderdi bat ez da bere buruari transferitzen', () => {
    const m = buildTransferMatrix(PARTIES, cfg());
    expect(m.weights.ezker.ezker).toBeUndefined();
  });

  it('lehenetsian, hurbilago dagoenak boto gehiago jasotzen ditu', () => {
    const m = buildTransferMatrix(PARTIES, cfg());
    // Ezkerra (10) kanporatuta: erdikoak (50) eskuinak (90) baino gehiago jaso behar du.
    expect(m.weights.ezker.erdi).toBeGreaterThan(m.weights.ezker.eskuin);
    // Erdikoa (50) erdian dago: bi aldeetara berdin.
    expect(m.weights.erdi.ezker).toBeCloseTo(m.weights.erdi.eskuin, 6);
  });

  it('afinitate zorrotzagoak alderdi hurbilenaren alde egiten du gehiago', () => {
    const lasaia = buildTransferMatrix(PARTIES, cfg({ affinity: 100 }));
    const zorrotza = buildTransferMatrix(PARTIES, cfg({ affinity: 5 }));
    expect(zorrotza.weights.ezker.erdi).toBeGreaterThan(lasaia.weights.ezker.erdi);
  });

  it('erabiltzailearen gainidazketak lehenetsia ordezkatzen du', () => {
    const m = buildTransferMatrix(
      PARTIES,
      cfg({ cells: { [cellKey('ezker', 'eskuin')]: 300, [cellKey('ezker', 'erdi')]: 100 } }),
    );
    expect(m.weights.ezker.eskuin).toBeCloseTo(75, 6);
    expect(m.weights.ezker.erdi).toBeCloseTo(25, 6);
  });

  it('abstentzioa alderdika gainidatz daiteke', () => {
    const m = buildTransferMatrix(PARTIES, cfg({ abstention: 30, abstentions: { ezker: 80 } }));
    expect(m.abstention.ezker).toBe(80);
    expect(m.abstention.erdi).toBe(30);
  });
});

describe('botoen banaketa', () => {
  it('abstentzioak botoak galtzen ditu, eta gainerakoa banatzen da', () => {
    const m = buildTransferMatrix(PARTIES, cfg({ abstention: 25 }));
    const { flows, abstained } = distributeVotes('ezker', 1000, ['erdi', 'eskuin'], m);

    expect(abstained).toBeCloseTo(250, 6);
    const transferred = flows.reduce((sum, f) => sum + f.votes, 0);
    expect(transferred).toBeCloseTo(750, 6);
  });

  it('biziraunleen artean berrinormalizatzen da', () => {
    // Ezkerraren lehen hautua erdikoa da, baina erdikoa ere kanporatuta badago, botoak ez dira
    // galtzen: eskuinera doaz (abstentzioa kenduta). Hori da berrinormalizazioa.
    const m = buildTransferMatrix(PARTIES, cfg({ abstention: 20 }));
    const { flows, abstained } = distributeVotes('ezker', 1000, ['eskuin'], m);

    expect(flows).toHaveLength(1);
    expect(flows[0].to).toBe('eskuin');
    expect(flows[0].votes).toBeCloseTo(800, 6);
    expect(abstained).toBeCloseTo(200, 6);
  });

  it('afinitaterik gabe, dena abstentziora', () => {
    const m = buildTransferMatrix(
      PARTIES,
      cfg({ cells: { [cellKey('ezker', 'erdi')]: 0, [cellKey('ezker', 'eskuin')]: 0 } }),
    );
    const { flows, abstained } = distributeVotes('ezker', 1000, ['erdi', 'eskuin'], m);
    expect(flows).toHaveLength(0);
    expect(abstained).toBe(1000);
  });

  it('biziraunlerik ez badago, botoak ez dira asmatzen', () => {
    const m = buildTransferMatrix(PARTIES, cfg());
    expect(distributeVotes('ezker', 500, [], m)).toEqual({ flows: [], abstained: 500 });
  });

  it('botoak ez dira sortzen: banatutakoa + abstentzioa = jatorrizkoa', () => {
    const m = buildTransferMatrix(PARTIES, cfg({ abstention: 37 }));
    const { flows, abstained } = distributeVotes('erdi', 12_345, ['ezker', 'eskuin'], m);
    const total = flows.reduce((sum, f) => sum + f.votes, 0) + abstained;
    expect(total).toBeCloseTo(12_345, 6);
  });
});
