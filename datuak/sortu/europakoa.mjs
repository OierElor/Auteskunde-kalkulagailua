#!/usr/bin/env node
/**
 * Europako Parlamentua 2024 (Espainia) — datu OFIZIALAK → aplikazioaren CSV formatua.
 *
 * Iturria: BOE-A-2024-13092 — Junta Electoral Central-en akordioa (2024-06-27).
 *   https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-13092
 *
 * Espainiak BARRUTI BAKARRA du Europako hauteskundeetan: 61 eserleku, D'Hondt, eta
 * **LANGARIK EZ**. Datuak probintziaka argitaratzen dira, baina eserlekuak estatu mailan
 * esleitzen dira — beraz "Total estatal" lerroa hartzen dugu, eta hori da fidela.
 *
 * Langarik ez izateak eszenatoki hau berezi bihurtzen du: langaren eragina isolatzeko balio du.
 * Igo langa %3ra eta ikusi zenbat alderdi txiki desagertzen diren.
 *
 * Erabilera:  node datuak/sortu/europakoa.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const XML_URL = 'https://www.boe.es/diario_boe/xml.php?id=BOE-A-2024-13092';
const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FILE = 'europako-parlamentua-2024.csv';
const SEATS = 61;

const strip = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const count = (raw) => {
  const digits = (raw ?? '').replace(/[^\d]/g, '');
  return digits === '' ? 0 : Number.parseInt(digits, 10);
};

const parseTable = (html) =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => strip(cell[1])),
  );

const isTotal = (cell) => /^total\b/i.test(cell ?? '');

const xml = execFileSync('curl', ['-sS', '--fail', '--max-time', '120', XML_URL], {
  encoding: 'utf8',
  maxBuffer: 1e8,
});
const tables = [...xml.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => parseTable(m[0]));

// --- 1. taula: boto zuriak (CUADRO I) ---------------------------------------
//     goiburua: '', Electores, Votantes, Votos válidos, Votos a candidaturas, Votos en blanco, Votos nulos

const summary = tables.find((rows) => rows[0]?.includes('Votos en blanco'));
if (!summary) throw new Error('Ez da CUADRO I aurkitu (boto zuriak).');

const head = summary[0];
const totalRow = summary.find((r) => isTotal(r[0]));
if (!totalRow) throw new Error('Ez da "Total estatal" lerroa aurkitu CUADRO I-en.');

const valid = count(totalRow[head.indexOf('Votos válidos')]);
const toCandidacies = count(totalRow[head.indexOf('Votos a candidaturas')]);
const blank = count(totalRow[head.indexOf('Votos en blanco')]);

if (valid !== toCandidacies + blank) {
  throw new Error(`${toCandidacies} + ${blank} ≠ ${valid} boto baliodun.`);
}

// --- Gainerako taulak: hautagaitzen botoak eta eserlekuak --------------------

const votes = {};
const seats = {};
let declaredSeats = null;

for (const rows of tables) {
  if (rows === summary) continue;

  const names = rows[0].slice(1).filter((n) => n !== '');
  const withSeats = rows[0][1] === 'Total escaños';
  const parties = withSeats ? names.slice(1) : names;

  // Hiru goiburu-lerro: izen osoa, laburdura, eta "Votos"/"Escaños".
  const row = rows.find((r) => isTotal(r[0]));
  if (!row) throw new Error('Ez da "Total estatal" lerroa aurkitu taula batean.');

  const width = withSeats ? 2 + 2 * parties.length : 1 + parties.length;
  const cells = [...row, ...Array(Math.max(0, width - row.length)).fill('')];

  if (withSeats) {
    declaredSeats ??= count(cells[1]);
    parties.forEach((name, i) => {
      votes[name] = count(cells[2 + i * 2]);
      seats[name] = count(cells[3 + i * 2]);
    });
  } else {
    parties.forEach((name, i) => {
      votes[name] = count(cells[1 + i]);
      seats[name] = 0;
    });
  }
}

if (declaredSeats !== SEATS) throw new Error(`${SEATS} eserleku espero ziren, ${declaredSeats} agertzen dira.`);

const sum = Object.values(votes).reduce((a, b) => a + b, 0);
if (sum !== toCandidacies) {
  throw new Error(`Alderdien batura ${sum}, "votos a candidaturas" ${toCandidacies}.`);
}
const allocated = Object.values(seats).reduce((a, b) => a + b, 0);
if (allocated !== SEATS) throw new Error(`${allocated} eserleku esleituta, ${SEATS} espero ziren.`);

// --- Idatzi -----------------------------------------------------------------

const names = Object.keys(votes);
const header = ['Barrutia', 'Eserlekuak', ...names, 'Zuriak'];
const row = ['Espainia', String(SEATS), ...names.map((p) => String(votes[p])), String(blank)];
writeFileSync(join(OUT, FILE), [header.join(';'), row.join(';')].join('\n') + '\n');

const officialPath = join(OUT, 'emaitza-ofizialak.json');
const official = JSON.parse(readFileSync(officialPath, 'utf8'));
official[FILE] = {
  label: 'Europako Parlamentua 2024 (Espainia)',
  source: XML_URL,
  seats: { Espainia: seats },
};
writeFileSync(officialPath, JSON.stringify(official, null, 2) + '\n');

console.log(`${FILE}: barruti 1, ${names.length} hautagaitza, ${SEATS} eserleku`);
console.log('  Gurutze-egiaztapena: alderdien batura = "votos a candidaturas" ✓');
console.log('  Eserleku ofizialak:');
for (const [p, s] of Object.entries(seats).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(s).padStart(2)}  ${p}`);
}
