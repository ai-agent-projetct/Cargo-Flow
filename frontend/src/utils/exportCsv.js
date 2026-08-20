// Shared CSV export. Every list in the app has an Export control; they all
// funnel through here so the file format is consistent and a new list gets
// working export for free.

const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * @param {Array<object>} rows      records to export
 * @param {Array<{key:string,label:string,format?:Function}>} columns
 * @param {string} filename         without extension
 */
export const exportCsv = (rows, columns, filename = 'export') => {
  if (!rows || !rows.length) return false;

  const cols = columns && columns.length
    ? columns
    // No column spec given: fall back to the keys of the first row, skipping
    // the internal ones nobody wants in a spreadsheet.
    : Object.keys(rows[0])
      .filter((k) => !['id', 'createdAt', 'updatedAt', 'availableActions'].includes(k))
      .map((k) => ({ key: k, label: k }));

  const esc = (s) => `"${cell(s).replace(/"/g, '""')}"`;
  const head = cols.map((c) => esc(c.label ?? c.key)).join(',');
  const body = rows.map((r) => cols
    .map((c) => esc(c.format ? c.format(r[c.key], r) : r[c.key]))
    .join(',')).join('\n');

  // Excel needs the BOM to read UTF-8 correctly.
  const blob = new Blob([`﻿${head}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

/**
 * Read a CSV file into objects keyed by its header row. Used by the Upload
 * controls so an exported file can be edited and brought back in.
 */
export const parseCsv = async (file) => {
  const text = await file.text();
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  // Split on commas that are not inside quotes.
  const split = (line) => (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [])
    .map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '').trim())
    .slice(0, -1);

  const headers = split(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
  return { headers, rows };
};

export default exportCsv;
