import { describe, expect, it } from 'vitest';
import { CsvError, csvToScenario, scenarioToCsv } from './csv';
import type { Scenario } from './types';

const CSV = [
  'Barrutia;Eserlekuak;EAJ;EH Bildu;PSE-EE;Zuriak',
  'Araba;25;62000;51000;38000;1200',
  'Bizkaia;25;185000;160000;110000;3100',
  'Gipuzkoa;25;120000;135000;60000;2000',
].join('\n');

describe('CSV inportazioa', () => {
  it('barrutiak, eserlekuak eta botoak irakurtzen ditu', () => {
    const s = csvToScenario(CSV);
    expect(s.districts.map((d) => d.name)).toEqual(['Araba', 'Bizkaia', 'Gipuzkoa']);
    expect(s.districts.every((d) => d.seats === 25)).toBe(true);
    expect(s.parties.map((p) => p.name)).toEqual(['EAJ', 'EH Bildu', 'PSE-EE']);
    expect(s.votes[s.districts[1].id][s.parties[0].id]).toBe(185_000);
  });

  it('"Zuriak" zutabea boto zuri gisa hartzen du, ez alderdi gisa', () => {
    const s = csvToScenario(CSV);
    expect(s.parties.map((p) => p.name)).not.toContain('Zuriak');
    expect(s.blankVotes[s.districts[0].id]).toBe(1_200);
  });

  it('bereizlea automatikoki antzematen du (komak ere)', () => {
    const s = csvToScenario('Barrutia,Eserlekuak,A,B\nBat,10,100,200');
    expect(s.parties.map((p) => p.name)).toEqual(['A', 'B']);
    expect(s.votes[s.districts[0].id][s.parties[1].id]).toBe(200);
  });

  it('milakoen bereizlea onartzen du (europarra eta ingelesa)', () => {
    const s = csvToScenario('Barrutia;Eserlekuak;A;B\nBat;10;1.234;5 678');
    const d = s.districts[0].id;
    expect(s.votes[d][s.parties[0].id]).toBe(1_234);
    expect(s.votes[d][s.parties[1].id]).toBe(5_678);
  });

  it('komatxo arteko eremuak errespetatzen ditu', () => {
    const s = csvToScenario('Barrutia;Eserlekuak;"Alderdi A; eta B"\nBat;10;500');
    expect(s.parties[0].name).toBe('Alderdi A; eta B');
    expect(s.votes[s.districts[0].id][s.parties[0].id]).toBe(500);
  });

  it('alderdi berriei paletako koloreak ematen dizkie, ordena finkoan', () => {
    const s = csvToScenario(CSV);
    expect(s.parties[0].color).toBe('#2a78d6');
    expect(s.parties[1].color).toBe('#1baf7a');
    expect(new Set(s.parties.map((p) => p.color)).size).toBe(3);
  });

  it('lehendik dagoen eszenatokiaren koloreak eta posizioak mantentzen ditu', () => {
    const previous = csvToScenario(CSV);
    previous.parties[0].color = '#008300';
    previous.parties[0].position = 42;

    const reimported = csvToScenario(CSV, previous);
    expect(reimported.parties[0].color).toBe('#008300');
    expect(reimported.parties[0].position).toBe(42);
  });
});

describe('CSV akatsak', () => {
  it('hutsik dagoen CSVak akatsa ematen du', () => {
    expect(() => csvToScenario('   ')).toThrow(CsvError);
  });

  it('goiburu bakarrak akatsa ematen du', () => {
    expect(() => csvToScenario('Barrutia;Eserlekuak;A')).toThrow(CsvError);
  });

  it('eserleku baliogabeek akatsa ematen dute, barrutiaren izenarekin', () => {
    expect(() => csvToScenario('Barrutia;Eserlekuak;A\nAraba;zero;100')).toThrow(/Araba/);
  });

  it('alderdi-zutaberik gabe akatsa ematen du', () => {
    expect(() => csvToScenario('Barrutia;Eserlekuak;Zuriak\nBat;10;50')).toThrow(CsvError);
  });
});

describe('joan-etorria (round trip)', () => {
  it('esportatu eta berriz inportatuta, datuak berdinak dira', () => {
    const original = csvToScenario(CSV);
    const roundTripped = csvToScenario(scenarioToCsv(original), original);

    expect(roundTripped.districts).toEqual(original.districts);
    expect(roundTripped.parties).toEqual(original.parties);
    expect(roundTripped.votes).toEqual(original.votes);
    expect(roundTripped.blankVotes).toEqual(original.blankVotes);
  });

  it('bereizlea daramaten izenak babestuta esportatzen ditu', () => {
    const s: Scenario = {
      name: 'x',
      parties: [{ id: 'a', name: 'A; B', abbrev: 'AB', color: '#2a78d6', position: 50 }],
      districts: [{ id: 'bat', name: 'Bat', seats: 3 }],
      votes: { bat: { a: 10 } },
      blankVotes: { bat: 0 },
    };
    expect(scenarioToCsv(s)).toContain('"A; B"');
    expect(csvToScenario(scenarioToCsv(s)).parties[0].name).toBe('A; B');
  });
});
