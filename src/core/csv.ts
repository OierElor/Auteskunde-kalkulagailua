import { defaultColorForIndex } from './palette';
import type { Party, Scenario } from './types';

/**
 * CSV formatu "zabala": lehen zutabea barrutia, bigarrena eserlekuak, gainerakoak alderdiak.
 *
 *   Barrutia;Eserlekuak;EAJ;EH Bildu;PSE-EE;Zuriak
 *   Araba;25;62000;51000;38000;1200
 *   Bizkaia;25;185000;160000;110000;3100
 *
 * "Zuriak" izeneko zutabea (edo "Blanco", "Blank"…) boto zuri gisa hartzen da, ez alderdi gisa.
 */

const BLANK_COLUMN = /^(zuriak?|boto\s*zuriak?|en\s*blanco|blanco|votos?\s*en\s*blanco|blank)$/i;

/** Zenbaki-formatu europarra eta ingelesa, biak: "1.234", "1 234", "1,234" → 1234. */
function parseCount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function detectDelimiter(headerLine: string): string {
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** RFC4180: komatxo bikoitzen barruan bereizleak eta lerro-jauziak literalak dira. */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function slugify(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

export class CsvError extends Error {}

/**
 * CSV testu batetik eszenatoki bat. `previous` emanez gero, izen bereko alderdien kolorea eta
 * ezker-eskuin posizioa mantentzen dira (CSV batek ez baitu informazio hori garraiatzen).
 */
export function csvToScenario(text: string, previous?: Scenario): Scenario {
  const trimmed = text.trim();
  if (trimmed === '') throw new CsvError('CSVa hutsik dago.');

  const firstLine = trimmed.split('\n')[0];
  const rows = parseCsv(trimmed, detectDelimiter(firstLine));

  if (rows.length < 2) {
    throw new CsvError('CSVak goiburu-lerroa eta gutxienez barruti bat behar ditu.');
  }

  const header = rows[0].map((c) => c.trim());
  if (header.length < 3) {
    throw new CsvError(
      'Goiburuak gutxienez hiru zutabe behar ditu: barrutia, eserlekuak eta alderdi bat.',
    );
  }

  const columns = header.slice(2);
  const blankIndex = columns.findIndex((c) => BLANK_COLUMN.test(c.trim()));
  const partyColumns = columns
    .map((name, i) => ({ name: name.trim(), index: i }))
    .filter((c) => c.name !== '' && c.index !== blankIndex);

  if (partyColumns.length === 0) {
    throw new CsvError('Ez da alderdi-zutaberik aurkitu.');
  }

  const partyIds = new Set<string>();
  const parties: Party[] = partyColumns.map((col, i) => {
    const prev = previous?.parties.find((p) => p.name === col.name || p.abbrev === col.name);
    return {
      id: uniqueId(slugify(col.name, `alderdia-${i + 1}`), partyIds),
      name: col.name,
      abbrev: col.name,
      color: prev?.color ?? defaultColorForIndex(i),
      position:
        prev?.position ??
        (partyColumns.length === 1 ? 50 : Math.round((i / (partyColumns.length - 1)) * 100)),
    };
  });

  const districtIds = new Set<string>();
  const districts: Scenario['districts'] = [];
  const votes: Scenario['votes'] = {};
  const blankVotes: Scenario['blankVotes'] = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = (row[0] ?? '').trim();
    if (name === '') continue;

    const seats = parseCount(row[1] ?? '');
    if (seats <= 0) {
      throw new CsvError(`"${name}" barrutiak eserleku-kopuru baliogabea du: "${row[1] ?? ''}".`);
    }

    const id = uniqueId(slugify(name, `barrutia-${r}`), districtIds);
    districts.push({ id, name, seats });

    votes[id] = {};
    partyColumns.forEach((col, i) => {
      votes[id][parties[i].id] = parseCount(row[2 + col.index] ?? '');
    });
    blankVotes[id] = blankIndex >= 0 ? parseCount(row[2 + blankIndex] ?? '') : 0;
  }

  if (districts.length === 0) throw new CsvError('Ez da barrutirik aurkitu.');

  return {
    name: previous?.name ?? 'CSVtik inportatua',
    parties,
    districts,
    votes,
    blankVotes,
  };
}

export function scenarioToCsv(scenario: Scenario, delimiter = ';'): string {
  const esc = (v: string) =>
    v.includes(delimiter) || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  const header = ['Barrutia', 'Eserlekuak', ...scenario.parties.map((p) => p.name), 'Zuriak'];
  const lines = [header.map(esc).join(delimiter)];

  for (const d of scenario.districts) {
    lines.push(
      [
        esc(d.name),
        String(d.seats),
        ...scenario.parties.map((p) => String(scenario.votes[d.id]?.[p.id] ?? 0)),
        String(scenario.blankVotes[d.id] ?? 0),
      ].join(delimiter),
    );
  }

  return lines.join('\n');
}
