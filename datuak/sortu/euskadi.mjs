#!/usr/bin/env node
/**
 * Eusko Legebiltzarrerako hauteskundeen datu OFIZIALAK → aplikazioaren CSV formatua.
 *
 * Iturria: Eusko Jaurlaritza, Segurtasun Saila — hauteskunde-emaitzen fitxategi ofizialak.
 *   https://www.euskadi.eus/informazioa/hauteskundeetako-emaitzen-fitxategien-deskargak/web01-a2haukon/eu/
 *
 * ZIP bakoitzak bi fitxategi erabiltzen ditugu:
 *   Cir*.csv  → barrutika: errolda, boto zuriak, eta hautagaitza bakoitzaren botoak.
 *   Elec*.csv → HAUTETSIEN zerrenda (izen-abizenak). Alderdiz zenbatuta, eserleku ofizialak ematen ditu.
 *
 * Bi fitxategi BEREIZI izateak balio du: botoak batetik hartzen ditugu eta eserleku ofizialak
 * bestetik, eta gero motorrak botoetatik eserlekuak berriro kalkulatzen ditu. Bat badatoz, datuek
 * ETA motorrak biek funtzionatzen dute. Ez da egiaztapen zirkularra.
 *
 * Erabilera:  node datuak/sortu/euskadi.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://www.euskadi.eus/contenidos/informacion/w_em_descargas/eu_def/adjuntos/csv';
const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Eusko Legebiltzarrak 25 eserleku ditu lurralde historiko bakoitzeko, legez finkatuta. */
const SEATS_PER_DISTRICT = 25;

const ELECTIONS = [
  { year: 2024, zip: 'Eus-csv.zip', label: 'Eusko Legebiltzarra 2024' },
  { year: 2020, zip: 'P20_e.zip', label: 'Eusko Legebiltzarra 2020' },
  { year: 2016, zip: 'P16_e.zip', label: 'Eusko Legebiltzarra 2016' },
];

/** Fitxategi ofizialak ISO-8859-1 dira, ez UTF-8. */
const readLatin1 = (path) => new TextDecoder('iso-8859-1').decode(readFileSync(path));

const splitRow = (line) => line.split(';').map((c) => c.trim());

/** "1.234" edo "1234" → 1234. Hutsik = 0 (hautagaitzak ez zuen barruti horretan aurkeztu). */
function count(raw) {
  const digits = (raw ?? '').replace(/[^\d]/g, '');
  return digits === '' ? 0 : Number.parseInt(digits, 10);
}

/** Barrutien izenak normalizatu: fitxategi batzuek "ARABA/ÁLAVA" darabilte, besteek "ARABA". */
function districtName(raw) {
  const name = raw.split('/')[0].trim();
  return name.charAt(0) + name.slice(1).toLowerCase();
}

/**
 * 2024ko formatua: BI goiburu-lerro. Lehenak alderdien izenak LAU aldiz errepikatzen ditu; bigarrenak
 * zutabeen etiketak (botoak, %, %, Jarlekuak). Eserlekuak fitxategian bertan daude.
 */
function parseWide(text) {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const names = splitRow(lines[0]);
  const labels = splitRow(lines[1]);

  const first = labels.findIndex((l) => l.startsWith('B. Hautagaitzari'));
  if (first < 0) throw new Error('Ez da alderdi-zutaberik aurkitu (2024ko formatua).');

  const blankIndex = labels.indexOf('Zuriak');
  const parties = [];
  for (let i = first; i < labels.length; i += 4) {
    if (names[i]) parties.push({ name: names[i], votes: i, seats: i + 3 });
  }

  const districts = [];
  for (const line of lines.slice(2)) {
    const row = splitRow(line);
    if (!row[0]) continue;
    districts.push({
      name: districtName(row[0]),
      blank: count(row[blankIndex]),
      votes: Object.fromEntries(parties.map((p) => [p.name, count(row[p.votes])])),
      seats: Object.fromEntries(parties.map((p) => [p.name, count(row[p.seats])])),
    });
  }

  return { parties: parties.map((p) => p.name), districts };
}

/**
 * 2016/2020ko formatua: alderdi bakoitzak zutabe bat (botoak soilik). Eserlekuak ez daude hemen —
 * Elec*.csv fitxategitik datoz.
 *
 * Urte bakoitzak bere aldaerak ditu: 2020k goiburua lehen lerroan du eta 2016k bi izenburu-lerro
 * ditu aurretik; zutabeen izenak ere aldatzen dira (Baliodunak/Baleko, Boto-emaileak/Hautesleak).
 * Horregatik goiburua BILATU egiten dugu, ez suposatu, eta ainguratzat "Zuriak" eta "Abstentzioa"
 * hartzen ditugu — biak urte guztietan agertzen dira.
 */
function parseNarrow(text) {
  const lines = text.split('\n').filter((l) => l.trim() !== '');

  const headerIndex = lines.findIndex((l) => {
    const cells = splitRow(l);
    return cells.includes('Zuriak') && cells.includes('Abstentzioa');
  });
  if (headerIndex < 0) throw new Error('Ez da goiburu-lerroa aurkitu (Zuriak/Abstentzioa falta).');

  const header = splitRow(lines[headerIndex]);
  const blankIndex = header.indexOf('Zuriak');
  const abstention = header.indexOf('Abstentzioa');

  // Alderdiak abstentzioaren zutabearen ondoren hasten dira.
  const parties = header.slice(abstention + 1).filter((n) => n !== '');

  const districts = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const row = splitRow(line);
    if (!row[0]) continue;
    districts.push({
      name: districtName(row[0]),
      blank: count(row[blankIndex]),
      votes: Object.fromEntries(parties.map((p, i) => [p, count(row[abstention + 1 + i])])),
      seats: null, // Elec*.csv-tik etorriko dira.
    });
  }

  return { parties, districts };
}

/**
 * Hautetsien zerrenda → eserlekuak alderdiz eta barrutiz. Lerro bat = diputatu bat.
 *
 * Zutabeen izenak urtez urte aldatzen dira (2020: "Barrutia"/"Alderdia"; 2016: "LH"/"Alderdi"),
 * eta 2016k hiru izenburu-lerro ditu aurretik. Beraz goiburua bilatu eta zutabeak izen posibleen
 * artean bilatzen ditugu.
 */
function parseElected(text) {
  const lines = text.split('\n').filter((l) => l.trim() !== '');

  const pick = (cells, names) => cells.findIndex((c) => names.includes(c));
  const DISTRICT = ['Barrutia', 'LH'];
  const PARTY = ['Alderdia', 'Alderdi'];

  const headerIndex = lines.findIndex((l) => {
    const cells = splitRow(l);
    return pick(cells, DISTRICT) >= 0 && pick(cells, PARTY) >= 0;
  });
  if (headerIndex < 0) throw new Error('Ez da hautetsien goiburua aurkitu.');

  const header = splitRow(lines[headerIndex]);
  // "Barrutia" lehenesten dugu "LH"ren gainetik: biak daudenean, hura da barruti ofiziala.
  const districtCol = header.indexOf('Barrutia') >= 0 ? header.indexOf('Barrutia') : pick(header, DISTRICT);
  const partyCol = pick(header, PARTY);

  const seats = {};
  for (const line of lines.slice(headerIndex + 1)) {
    const row = splitRow(line);
    if (!row[partyCol] || !row[districtCol]) continue;
    const district = districtName(row[districtCol]);
    seats[district] ??= {};
    seats[district][row[partyCol]] = (seats[district][row[partyCol]] ?? 0) + 1;
  }
  return seats;
}

function toCsv({ parties, districts }) {
  const header = ['Barrutia', 'Eserlekuak', ...parties, 'Zuriak'];
  const rows = districts.map((d) => [
    d.name,
    String(SEATS_PER_DISTRICT),
    ...parties.map((p) => String(d.votes[p] ?? 0)),
    String(d.blank),
  ]);
  return [header, ...rows].map((r) => r.join(';')).join('\n') + '\n';
}

// --- Nagusia ---------------------------------------------------------------

const official = {};

for (const election of ELECTIONS) {
  const work = mkdtempSync(join(tmpdir(), 'eusk-'));
  try {
    const zip = join(work, 'e.zip');
    execFileSync('curl', ['-sS', '--fail', '--max-time', '90', '-o', zip, `${BASE}/${election.zip}`]);
    execFileSync('unzip', ['-qo', zip, '-d', work]);

    /** ZIP batzuek azpikarpeta bat dute, besteek ez. */
    const find = (prefix) => {
      const hits = [];
      const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) walk(path);
          else if (entry.name.startsWith(prefix) && entry.name.endsWith('.csv')) hits.push(path);
        }
      };
      walk(work);
      if (hits.length === 0) throw new Error(`Ez da "${prefix}*.csv" aurkitu ${election.zip}-en.`);
      return hits[0];
    };

    const cirText = readLatin1(find('Cir'));
    const wide = cirText.split('\n')[1]?.includes('Jarlekuak');
    const data = wide ? parseWide(cirText) : parseNarrow(cirText);

    // Eserleku ofizialak: 2024koak fitxategian daude; 2016/2020koak hautetsien zerrendan.
    if (!wide) {
      const elected = parseElected(readLatin1(find('Elec')));
      for (const district of data.districts) {
        district.seats = Object.fromEntries(
          data.parties.map((p) => [p, elected[district.name]?.[p] ?? 0]),
        );
      }
    }

    // Osasun-egiaztapena: barruti bakoitzak 25 eserleku izan behar ditu, ez gutxiago ez gehiago.
    for (const district of data.districts) {
      const total = Object.values(district.seats).reduce((a, b) => a + b, 0);
      if (total !== SEATS_PER_DISTRICT) {
        throw new Error(
          `${election.label} / ${district.name}: ${total} eserleku ofizial, ${SEATS_PER_DISTRICT} espero ziren.`,
        );
      }
    }

    const file = `eusko-legebiltzarra-${election.year}.csv`;
    writeFileSync(join(OUT, file), toCsv(data));

    official[file] = {
      label: election.label,
      source: `${BASE}/${election.zip}`,
      seats: Object.fromEntries(data.districts.map((d) => [d.name, d.seats])),
    };

    const totals = {};
    for (const d of data.districts) {
      for (const [p, s] of Object.entries(d.seats)) if (s > 0) totals[p] = (totals[p] ?? 0) + s;
    }
    console.log(`${file}: ${data.districts.length} barruti, ${data.parties.length} hautagaitza`);
    console.log(`  Eserleku ofizialak: ${Object.entries(totals).map(([p, s]) => `${p} ${s}`).join(', ')}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

writeFileSync(join(OUT, 'emaitza-ofizialak.json'), JSON.stringify(official, null, 2) + '\n');
console.log('\nemaitza-ofizialak.json eguneratuta.');
