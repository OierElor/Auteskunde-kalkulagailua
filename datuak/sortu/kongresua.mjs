#!/usr/bin/env node
/**
 * Espainiako Kongresua 2023 — datu OFIZIALAK → aplikazioaren CSV formatua.
 *
 * Iturria: BOE-A-2023-18907 — Junta Electoral Central-en ebazpena (2023-08-30), eskrutinio
 * orokorraren AKTA. Ez da laburpen bat: emaitza ofizial aldarrikatua da.
 *   https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907
 *
 * (Zuzenketa-ebazpena, BOE-A-2023-19537, SENATUARI bakarrik dagokio — hautagai baten botoak.
 *  Kongresuko datuek ez dute zuzenketarik behar.)
 *
 * BI ITURRI, nahita:
 *   XML → alderdien botoak eta eserlekuak barrutika. HTML taula egituratuak dira: zehatzak.
 *   PDF → CUADRO I: boto zuriak barrutika. Taula hori ez dago XMLan (irudi gisa dago).
 *
 * Eta horrek GURUTZE-EGIAZTAPEN bat ematen digu doan: XMLko alderdi guztien botoen batura
 * PDFko "Votos a Candidaturas" zutabearekin bat etorri behar da, barruti bakoitzean. Bat ez
 * badator, erauzketaren batek huts egin du eta script honek gelditu egiten du.
 *
 * Erabilera:  node datuak/sortu/kongresua.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const XML_URL = 'https://www.boe.es/diario_boe/xml.php?id=BOE-A-2023-18907';
const PDF_URL = 'https://www.boe.es/boe/dias/2023/09/01/pdfs/BOE-A-2023-18907.pdf';
const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FILE = 'espainiako-kongresua-2023.csv';

const strip = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "1.463.183" → 1463183. Hutsik = 0 (hautagaitzak ez zuen barruti horretan aurkeztu). */
function count(raw) {
  const digits = (raw ?? '').replace(/[^\d]/g, '');
  return digits === '' ? 0 : Number.parseInt(digits, 10);
}

/** Barrutiaren izena: "Madrid." → "Madrid". */
const districtName = (raw) => raw.replace(/\.$/, '').trim();

const TOTAL_ROW = /^total\b/i;

/** Taula bat lerroetan eta gelaxketan. */
function parseTable(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => strip(cell[1])),
  );
}

// --- XML: alderdien botoak eta eserlekuak -----------------------------------

const work = mkdtempSync(join(tmpdir(), 'boe-'));
try {
  const xmlPath = join(work, 'boe.xml');
  const pdfPath = join(work, 'boe.pdf');
  execFileSync('curl', ['-sS', '--fail', '--max-time', '120', '-o', xmlPath, XML_URL]);
  execFileSync('curl', ['-sS', '--fail', '--max-time', '120', '-o', pdfPath, PDF_URL]);

  const xml = readFileSync(xmlPath, 'utf8');
  const tables = [...xml.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => parseTable(m[0]));

  /** barrutia → alderdia → botoak / eserlekuak */
  const votes = {};
  const seats = {};
  const districtSeats = {};
  const parties = [];

  for (const rows of tables) {
    const header = rows[0];
    if (!header) continue;

    // Eserlekua lortu duten hautagaitzen taulek "Total escaños" zutabea dute, eta alderdi bakoitzak
    // BI gelaxka (Votos, Escaños). Gainerakoek gelaxka BAT (Votos).
    const withSeats = header[1] === 'Total escaños';
    const names = header.slice(withSeats ? 2 : 1).filter((n) => n !== '');
    const width = withSeats ? 2 + 2 * names.length : 1 + names.length;
    parties.push(...names);

    // Taula GUZTIEK bi goiburu-lerro dituzte: izenak, eta gero "Votos"/"Escaños" etiketak.
    // (Eserlekurik gabeko tauletan bigarrena "Votos;Votos;…" da — hura barruti gisa hartzea izan
    // zen lehen akatsa.)
    for (const row of rows.slice(2)) {
      if (row.length === 0 || !row[0] || TOTAL_ROW.test(row[0])) continue;

      // Amaierako gelaxka hutsak kendu egiten dira HTMLan: bete egin behar dira.
      const cells = [...row, ...Array(Math.max(0, width - row.length)).fill('')];
      const district = districtName(cells[0]);

      votes[district] ??= {};
      seats[district] ??= {};

      if (withSeats) {
        districtSeats[district] = count(cells[1]);
        names.forEach((name, i) => {
          votes[district][name] = count(cells[2 + i * 2]);
          seats[district][name] = count(cells[3 + i * 2]);
        });
      } else {
        names.forEach((name, i) => {
          votes[district][name] = count(cells[1 + i]);
          seats[district][name] = 0;
        });
      }
    }
  }

  // --- PDF: CUADRO I → boto zuriak eta hautagaitzei emandako botoak ---------

  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  const blank = {};
  const toCandidacies = {};

  // "Albacete   307.988   223.917   221.191   219.357   1.834   2.726"
  //  izena  errolda  botoemaileak  baliodunak  hautagaitzei  ZURIAK  nuluak
  const ROW = /^\s{6,}(\S[^\d]*?)\s{2,}([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/;
  for (const line of text.split('\n')) {
    const m = ROW.exec(line);
    if (!m) continue;
    const district = districtName(m[1]);
    if (TOTAL_ROW.test(district) || !votes[district]) continue;

    const valid = count(m[4]);
    const candidacies = count(m[5]);
    const blanks = count(m[6]);

    // Legezko identitatea: boto baliodunak = hautagaitzei emandakoak + zuriak.
    if (valid !== candidacies + blanks) {
      throw new Error(`${district}: ${candidacies} + ${blanks} ≠ ${valid} boto baliodun.`);
    }
    blank[district] = blanks;
    toCandidacies[district] = candidacies;
  }

  // --- Gurutze-egiaztapena: bi iturriek bat etorri behar dute --------------

  const districts = Object.keys(votes).sort((a, b) => a.localeCompare(b, 'es'));
  if (districts.length !== 52) {
    throw new Error(`52 barruti espero ziren, ${districts.length} aurkitu dira.`);
  }

  for (const district of districts) {
    if (blank[district] === undefined) throw new Error(`${district}: ez da CUADRO I-en aurkitu.`);

    const sum = Object.values(votes[district]).reduce((a, b) => a + b, 0);
    if (sum !== toCandidacies[district]) {
      throw new Error(
        `${district}: XMLko alderdien batura ${sum}, PDFko "votos a candidaturas" ${toCandidacies[district]}. ` +
          'Erauzketaren batek huts egin du.',
      );
    }
  }

  const totalSeats = districts.reduce((a, d) => a + districtSeats[d], 0);
  if (totalSeats !== 350) throw new Error(`350 eserleku espero ziren, ${totalSeats} aurkitu dira.`);

  // --- Idatzi ---------------------------------------------------------------

  const unique = [...new Set(parties)];
  const header = ['Barrutia', 'Eserlekuak', ...unique, 'Zuriak'];
  const rows = districts.map((d) => [
    d,
    String(districtSeats[d]),
    ...unique.map((p) => String(votes[d][p] ?? 0)),
    String(blank[d]),
  ]);
  writeFileSync(join(OUT, FILE), [header, ...rows].map((r) => r.join(';')).join('\n') + '\n');

  const officialPath = join(OUT, 'emaitza-ofizialak.json');
  const official = JSON.parse(readFileSync(officialPath, 'utf8'));
  official[FILE] = {
    label: 'Espainiako Kongresua 2023',
    source: XML_URL,
    seats: Object.fromEntries(districts.map((d) => [d, seats[d]])),
  };
  writeFileSync(officialPath, JSON.stringify(official, null, 2) + '\n');

  const totals = {};
  for (const d of districts) {
    for (const [p, s] of Object.entries(seats[d])) if (s > 0) totals[p] = (totals[p] ?? 0) + s;
  }
  console.log(`${FILE}: ${districts.length} barruti, ${unique.length} hautagaitza, ${totalSeats} eserleku`);
  console.log('  Gurutze-egiaztapena: XMLko botoak = PDFko "votos a candidaturas" barruti guztietan ✓');
  console.log('  Eserleku ofizialak:');
  for (const [p, s] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(s).padStart(3)}  ${p}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
