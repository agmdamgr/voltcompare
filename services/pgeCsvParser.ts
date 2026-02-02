import { EnergyReading } from '../types';

export interface PgeCsvParseResult {
  readings: EnergyReading[];
  warnings: string[];
}

const normalizeHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()\[\]{}]/g, '')
    .replace(/[^a-z0-9 ]/g, '');

const parseCsvRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    // Skip fully empty rows
    if (row.some(c => c.trim() !== '')) rows.push(row);
    row = [];
  };

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // Escaped quote inside quoted cell: ""
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      pushCell();
      continue;
    }

    if (!inQuotes && ch === '\n') {
      pushCell();
      pushRow();
      continue;
    }

    cell += ch;
  }

  // Flush last cell/row
  pushCell();
  pushRow();
  return rows;
};

const parseNumber = (value: unknown): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  // Common: "1,234.56", "0.123 kWh", "$12.34"
  const cleaned = raw.replace(/,/g, '');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const parseTime = (timeRaw: string): { hours: number; minutes: number; seconds: number } | null => {
  const t = timeRaw.trim();
  if (!t) return null;

  // Supports "HH:MM", "HH:MM:SS", "H:MM AM".
  const m = t.match(/^\s*(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?\s*$/i);
  if (!m) return null;

  let hours = Number(m[1]);
  const minutes = Number(m[2] ?? '0');
  const seconds = Number(m[3] ?? '0');
  const ampm = (m[4] ?? '').toLowerCase();

  if (minutes > 59 || seconds > 59) return null;
  if (hours > 24) return null;

  if (ampm) {
    if (hours < 1 || hours > 12) return null;
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }

  return { hours, minutes, seconds };
};

const parseUsDate = (dateRaw: string): { year: number; monthIndex: number; day: number } | null => {
  const d = dateRaw.trim();
  if (!d) return null;

  // YYYY-MM-DD
  let m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (monthIndex < 0 || monthIndex > 11) return null;
    if (day < 1 || day > 31) return null;
    return { year, monthIndex, day };
  }

  // MM/DD/YYYY or M/D/YY
  m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const monthIndex = Number(m[1]) - 1;
    const day = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (monthIndex < 0 || monthIndex > 11) return null;
    if (day < 1 || day > 31) return null;
    return { year, monthIndex, day };
  }

  // Some exports: "01-18-2025" (assume MM-DD-YYYY)
  m = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const monthIndex = Number(m[1]) - 1;
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (monthIndex < 0 || monthIndex > 11) return null;
    if (day < 1 || day > 31) return null;
    return { year, monthIndex, day };
  }

  return null;
};

const parseDateTime = (dateRaw: string, timeRaw?: string): Date | null => {
  const dateParts = parseUsDate(dateRaw);
  if (!dateParts) return null;

  let time = { hours: 0, minutes: 0, seconds: 0 };
  if (timeRaw != null) {
    const parsedTime = parseTime(timeRaw);
    if (!parsedTime) return null;
    time = parsedTime;
  }

  const dt = new Date(
    dateParts.year,
    dateParts.monthIndex,
    dateParts.day,
    time.hours,
    time.minutes,
    time.seconds,
    0
  );

  return Number.isFinite(dt.getTime()) ? dt : null;
};

const parseSingleDateTimeField = (raw: string): Date | null => {
  const s = raw.trim();
  if (!s) return null;

  // Try ISO-ish first.
  const iso = new Date(s);
  if (Number.isFinite(iso.getTime())) return iso;

  // Common: "01/18/2025 00:15" or "01/18/2025 12:15 AM"
  const m = s.match(/^(.+?)\s+(\d{1,2}(:\d{2})?(:\d{2})?\s*(am|pm)?)$/i);
  if (m) {
    return parseDateTime(m[1], m[2]);
  }

  return null;
};

const scoreHeaderRow = (row: string[]): number => {
  const joined = row.map(c => c.toLowerCase()).join(' | ');
  let score = 0;
  if (/kwh/.test(joined)) score += 3;
  if (/usage|consumption|quantity|value/.test(joined)) score += 2;
  if (/start|end|interval/.test(joined)) score += 2;
  if (/date|time/.test(joined)) score += 1;
  return score;
};

const detectHeaderRowIndex = (rows: string[][]): number => {
  const maxScan = Math.min(rows.length, 80);
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i].map(v => String(v ?? '').trim());
    const nonEmpty = row.filter(Boolean).length;
    if (nonEmpty < 3) continue;

    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestIdx = i;
      bestScore = score;
    }
  }

  return bestScore >= 4 ? bestIdx : -1;
};

export const parsePgeIntervalCsv = (csvText: string): PgeCsvParseResult => {
  const warnings: string[] = [];

  const rows = parseCsvRows(csvText)
    .map(r => r.map(v => String(v ?? '')))
    .filter(r => r.some(cell => String(cell ?? '').trim() !== ''));

  if (rows.length < 2) {
    throw new Error('CSV appears empty or unreadable.');
  }

  const headerIdx = detectHeaderRowIndex(rows);
  if (headerIdx === -1) {
    throw new Error(
      'Could not detect a header row with kWh interval data. If this is a Green Button export, re-export as “Interval Data (CSV)”.'
    );
  }

  const headersRaw = rows[headerIdx].map(h => String(h ?? '').trim());
  const headers = headersRaw.map(normalizeHeader);

  const findHeader = (predicate: (h: string) => boolean): number => headers.findIndex(predicate);

  // Look for IMPORT/EXPORT columns (common in solar/NEM exports)
  const importIdx = findHeader(h => /import/.test(h) && /kwh/.test(h));
  const exportIdx = findHeader(h => /export/.test(h) && /kwh/.test(h));
  const hasSolarColumns = importIdx !== -1 && exportIdx !== -1;

  // Fallback to generic usage column if no import/export
  const usageIdx = hasSolarColumns
    ? importIdx
    : findHeader(h => /kwh/.test(h) && /usage|consumption|quantity|value|interval/.test(h)) !== -1
      ? findHeader(h => /kwh/.test(h) && /usage|consumption|quantity|value|interval/.test(h))
      : findHeader(h => /kwh/.test(h) && !/cost|price|rate|charge|dollar|\$/.test(h));

  const startDateIdx = findHeader(h => /start date|interval start date|usage start date|from date/.test(h));
  const startTimeIdx = findHeader(h => /start time|interval start time|usage start time|from time/.test(h));
  const endDateIdx = findHeader(h => /end date|interval end date|usage end date|to date/.test(h));
  const endTimeIdx = findHeader(h => /end time|interval end time|usage end time|to time/.test(h));

  const startDateTimeIdx = findHeader(h => /interval start|start datetime|start date time/.test(h));
  const endDateTimeIdx = findHeader(h => /interval end|end datetime|end date time/.test(h));

  const dateIdx = findHeader(h => h === 'date' || /reading date|usage date/.test(h));
  const timeIdx = findHeader(h => h === 'time' || /reading time/.test(h));

  if (usageIdx === -1) {
    throw new Error('Could not find a kWh/usage column in this CSV.');
  }

  const readings: EnergyReading[] = [];
  let skipped = 0;

  if (hasSolarColumns) {
    warnings.push('Detected solar IMPORT/EXPORT columns. Calculating NET usage (Import − Export) to match PG&E billing.');
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    // Calculate NET usage for solar customers (IMPORT - EXPORT)
    let kwh: number | null;
    if (hasSolarColumns) {
      const importKwh = parseNumber(row[importIdx]) ?? 0;
      const exportKwh = parseNumber(row[exportIdx]) ?? 0;
      kwh = importKwh - exportKwh;
    } else {
      kwh = parseNumber(row[usageIdx]);
    }

    if (kwh == null) {
      skipped++;
      continue;
    }

    let ts: Date | null = null;

    if (startDateTimeIdx !== -1) {
      ts = parseSingleDateTimeField(String(row[startDateTimeIdx] ?? ''));
    }

    if (!ts && startDateIdx !== -1 && startTimeIdx !== -1) {
      ts = parseDateTime(String(row[startDateIdx] ?? ''), String(row[startTimeIdx] ?? ''));
    }

    if (!ts && dateIdx !== -1 && timeIdx !== -1) {
      ts = parseDateTime(String(row[dateIdx] ?? ''), String(row[timeIdx] ?? ''));
    }

    // Handle DATE + START TIME combination (common in PG&E exports)
    if (!ts && dateIdx !== -1 && startTimeIdx !== -1) {
      ts = parseDateTime(String(row[dateIdx] ?? ''), String(row[startTimeIdx] ?? ''));
    }

    if (!ts && dateIdx !== -1) {
      // Sometimes a single "Date" column contains full datetime.
      ts = parseSingleDateTimeField(String(row[dateIdx] ?? ''));
    }

    if (!ts && endDateTimeIdx !== -1) {
      // Fallback: use end timestamp minus 15 minutes if end is parseable.
      const end = parseSingleDateTimeField(String(row[endDateTimeIdx] ?? ''));
      if (end) ts = new Date(end.getTime() - 15 * 60 * 1000);
    }

    if (!ts && endDateIdx !== -1 && endTimeIdx !== -1) {
      const end = parseDateTime(String(row[endDateIdx] ?? ''), String(row[endTimeIdx] ?? ''));
      if (end) ts = new Date(end.getTime() - 15 * 60 * 1000);
    }

    if (!ts) {
      skipped++;
      continue;
    }

    // Guard against junk totals/summary rows.
    if (!Number.isFinite(ts.getTime())) {
      skipped++;
      continue;
    }

    readings.push({ timestamp: ts, value: kwh });
  }

  if (readings.length === 0) {
    throw new Error('No interval readings were parsed from this CSV.');
  }

  // Sort + de-duplicate timestamps (DST and exports sometimes duplicate local times).
  readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const summed = new Map<number, number>();
  for (const r of readings) {
    const key = r.timestamp.getTime();
    summed.set(key, (summed.get(key) ?? 0) + r.value);
  }

  const normalized: EnergyReading[] = Array.from(summed.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ms, v]) => ({ timestamp: new Date(ms), value: v }));

  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} row(s) that didn’t look like interval readings.`);
  }

  // Heuristic: estimate interval size.
  if (normalized.length >= 3) {
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(normalized.length, 2000); i++) {
      diffs.push(normalized[i].timestamp.getTime() - normalized[i - 1].timestamp.getTime());
    }
    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)];
    const minutes = Math.round(median / 60000);
    if (![15, 30, 60].includes(minutes)) {
      warnings.push(`Detected ~${minutes} minute intervals (expected 15/30/60). Data may be aggregated.`);
    }
  }

  return { readings: normalized, warnings };
};
