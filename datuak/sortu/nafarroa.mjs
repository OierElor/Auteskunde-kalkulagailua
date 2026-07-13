#!/usr/bin/env node
/**
 * Nafarroako Parlamentua 2023 — datu OFIZIALAK → aplikazioaren CSV formatua.
 *
 * Iturria: Nafarroako Gobernua, datu irekiak (CC-BY 4.0).
 *   https://datosabiertos.navarra.es/es/dataset/resultados-de-las-elecciones-al-parlamento-de-navarra-agrupados-por-municipios
 *
 * Datuak UDALERRIKA daude, baina Nafarroak BARRUTI BAKARRA du (50 eserleku, %3ko langa), beraz
 * batu egiten ditugu. Batuketa ez da hurbilketa bat: legez barruti bakarra da.
 *
 * Erabilera:  node datuak/sortu/nafarroa.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_CSV =
  'https://datosabiertos.navarra.es/es/datastore/dump/f555f0ff-a6f1-420b-bd25-caf979f26d86?format=csv&bom=True';
const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FILE = 'nafarroako-parlamentua-2023.csv';

/** Nafarroako Parlamentuak 50 eserleku ditu, barruti bakarrean. */
const SEATS = 50;

/**
 * Iturriko zutabe-izenak → hautagaitzen izen irakurgarriak.
 * Aldaketa hutsala da: azpimarrak zuriune bihurtu eta letra larriak zuzendu.
 */
const PARTIES = {
  UPN: 'UPN',
  'PSN-PSOE': 'PSN-PSOE',
  EH_BILDU: 'EH Bildu',
  GEROA_BAI: 'Geroa Bai',
  PPN: 'PPN',
  CONTIGO_ZUREKIN: 'Contigo-Zurekin',
  VOX: 'VOX',
  PUM_MAS_J: 'PUM+J',
  CIUDADANOS: 'Ciudadanos',
  EGUZKILORE: 'Eguzkilore',
  VOLUNTAD_FORAL: 'Voluntad Foral',
};

/** Emaitza ofiziala: Nafarroako Hauteskunde Batzordearen aldarrikapen-akta (BON 147, 2023-07-14). */
const OFFICIAL_SEATS = {
  UPN: 15,
  'PSN-PSOE': 11,
  'EH Bildu': 9,
  'Geroa Bai': 7,
  PPN: 3,
  'Contigo-Zurekin': 3,
  VOX: 2,
};

/** RFC4180 minimoa: komatxo arteko komak literalak dira. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const work = mkdtempSync(join(tmpdir(), 'nav-'));
try {
  const path = join(work, 'nav.csv');
  execFileSync('curl', ['-sSL', '--fail', '--max-time', '120', '-o', path, URL_CSV]);

  // BOM markarekin dator.
  const rows = parseCsv(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  const header = rows[0].map((h) => h.trim());
  const index = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`"${name}" zutabea ez dago iturrian.`);
    return i;
  };

  const num = (cell) => Number.parseInt((cell ?? '').replace(/[^\d]/g, ''), 10) || 0;

  const votes = Object.fromEntries(Object.values(PARTIES).map((p) => [p, 0]));
  let blank = 0;
  let valid = 0;
  let toCandidacies = 0;

  for (const row of rows.slice(1)) {
    for (const [column, name] of Object.entries(PARTIES)) votes[name] += num(row[index(column)]);
    blank += num(row[index('Votos_Blancos')]);
    valid += num(row[index('Votos_Validos')]);
    toCandidacies += num(row[index('Votos_Candidaturas')]);
  }

  // Iturriaren barne-koherentzia: boto baliodunak = hautagaitzei emandakoak + zuriak.
  if (valid !== toCandidacies + blank) {
    throw new Error(`${toCandidacies} + ${blank} ≠ ${valid} boto baliodun.`);
  }
  const sum = Object.values(votes).reduce((a, b) => a + b, 0);
  if (sum !== toCandidacies) {
    throw new Error(`Alderdien batura ${sum}, "votos a candidaturas" ${toCandidacies}.`);
  }

  const names = Object.values(PARTIES);
  const header2 = ['Barrutia', 'Eserlekuak', ...names, 'Zuriak'];
  const row2 = ['Nafarroa', String(SEATS), ...names.map((p) => String(votes[p])), String(blank)];
  writeFileSync(join(OUT, FILE), [header2.join(';'), row2.join(';')].join('\n') + '\n');

  const officialPath = join(OUT, 'emaitza-ofizialak.json');
  const official = JSON.parse(readFileSync(officialPath, 'utf8'));
  official[FILE] = {
    label: 'Nafarroako Parlamentua 2023',
    source: URL_CSV,
    seats: { Nafarroa: Object.fromEntries(names.map((p) => [p, OFFICIAL_SEATS[p] ?? 0])) },
  };
  writeFileSync(officialPath, JSON.stringify(official, null, 2) + '\n');

  console.log(`${FILE}: barruti 1, ${names.length} hautagaitza, ${SEATS} eserleku`);
  console.log(`  Boto zuriak: ${blank.toLocaleString('eu')}  ·  baliodunak: ${valid.toLocaleString('eu')}`);
  console.log('  Barne-koherentzia: hautagaitzei + zuriak = baliodunak ✓');
} finally {
  rmSync(work, { recursive: true, force: true });
}
