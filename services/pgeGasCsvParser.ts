import { GasReading } from '../types';

export interface PgeGasCsvParseResult {
  readings: GasReading[];
  warnings: string[];
}

const normalizeHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()[\]{}]/g, '')
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
    if (row.some(c => c.trim() !== '')) rows.push(row);
    row = [];
  };

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
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

  pushCell();
  pushRow();
  return rows;
};

const parseNumber = (value: unknown): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const cleaned = raw.replace(/,/g, '');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const parseTime = (timeRaw: string): { hours: number; minutes: number; seconds: number } | null => {
  const t = timeRaw.trim();
  if (!t) return null;

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

  // MM-DD-YYYY
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

  const iso = new Date(s);
  if (Number.isFinite(iso.getTime())) return iso;

  const m = s.match(/^(.+?)\s+(\d{1,2}(:\d{2})?(:\d{2})?\s*(am|pm)?)$/i);
  if (m) {
    return parseDateTime(m[1], m[2]);
  }

  return null;
};

const scoreHeaderRow = (row: string[]): number => {
  const joined = row.map(c => c.toLowerCase()).join(' | ');
  let score = 0;
  if (/therm/.test(joined)) score += 3;
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

  return bestScore >= 3 ? bestIdx : -1;
};

export const parsePgeGasCsv = (csvText: string): PgeGasCsvParseResult => {
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
      'Could not detect a header row with gas (therm) interval data. Make sure this is a PG&E gas Green Button export.'
    );
  }

  const headersRaw = rows[headerIdx].map(h => String(h ?? '').trim());
  const headers = headersRaw.map(normalizeHeader);

  const findHeader = (predicate: (h: string) => boolean): number => headers.findIndex(predicate);

  // Look for therms column
  const thermsIdx = findHeader(h => /therm/.test(h) && /usage|consumption|quantity|value/.test(h)) !== -1
    ? findHeader(h => /therm/.test(h) && /usage|consumption|quantity|value/.test(h))
    : findHeader(h => /therm/.test(h) && !/cost|price|rate|charge|dollar|\$/.test(h));

  const startDateIdx = findHeader(h => /start date|interval start date|usage start date|from date/.test(h));
  const startTimeIdx = findHeader(h => /start time|interval start time|usage start time|from time/.test(h));
  const endDateIdx = findHeader(h => /end date|interval end date|usage end date|to date/.test(h));
  const endTimeIdx = findHeader(h => /end time|interval end time|usage end time|to time/.test(h));

  const startDateTimeIdx = findHeader(h => /interval start|start datetime|start date time/.test(h));
  const endDateTimeIdx = findHeader(h => /interval end|end datetime|end date time/.test(h));

  const dateIdx = findHeader(h => h === 'date' || /reading date|usage date/.test(h));
  const timeIdx = findHeader(h => h === 'time' || /reading time/.test(h));

  if (thermsIdx === -1) {
    throw new Error('Could not find a therms/usage column in this CSV. Make sure this is a gas (not electric) export.');
  }

  const readings: GasReading[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    const therms = parseNumber(row[thermsIdx]);

    if (therms == null) {
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

    if (!ts && dateIdx !== -1 && startTimeIdx !== -1) {
      ts = parseDateTime(String(row[dateIdx] ?? ''), String(row[startTimeIdx] ?? ''));
    }

    if (!ts && dateIdx !== -1) {
      ts = parseSingleDateTimeField(String(row[dateIdx] ?? ''));
    }

    if (!ts && endDateTimeIdx !== -1) {
      const end = parseSingleDateTimeField(String(row[endDateTimeIdx] ?? ''));
      if (end) ts = new Date(end.getTime() - 60 * 60 * 1000); // Gas is usually hourly
    }

    if (!ts && endDateIdx !== -1 && endTimeIdx !== -1) {
      const end = parseDateTime(String(row[endDateIdx] ?? ''), String(row[endTimeIdx] ?? ''));
      if (end) ts = new Date(end.getTime() - 60 * 60 * 1000);
    }

    if (!ts) {
      skipped++;
      continue;
    }

    if (!Number.isFinite(ts.getTime())) {
      skipped++;
      continue;
    }

    readings.push({ timestamp: ts, value: therms });
  }

  if (readings.length === 0) {
    throw new Error('No gas readings were parsed from this CSV.');
  }

  // Sort and deduplicate
  readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const summed = new Map<number, number>();
  for (const r of readings) {
    const key = r.timestamp.getTime();
    summed.set(key, (summed.get(key) ?? 0) + r.value);
  }

  const normalized: GasReading[] = Array.from(summed.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ms, v]) => ({ timestamp: new Date(ms), value: v }));

  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} row(s) that didn't look like gas interval readings.`);
  }

  // Detect interval size
  if (normalized.length >= 3) {
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(normalized.length, 500); i++) {
      diffs.push(normalized[i].timestamp.getTime() - normalized[i - 1].timestamp.getTime());
    }
    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)];
    const hours = Math.round(median / (60 * 60 * 1000));
    if (hours !== 1 && hours !== 24) {
      warnings.push(`Detected ~${hours} hour intervals (expected 1 or 24). Data may be aggregated differently.`);
    }
  }

  return { readings: normalized, warnings };
};
