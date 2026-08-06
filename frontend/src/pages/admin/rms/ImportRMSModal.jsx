import React, { useState, useRef } from 'react';
import { X, Upload, FileDown } from 'lucide-react';
import { rmsTariffsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

// "Import RMS" modal: pick a CSV/XLSX, Apply, or grab the sample template.
const SAMPLE_HEADERS = [
  'tariffNumber', 'tariffDate', 'service', 'trade', 'cargoType',
  'originCountry', 'originPort', 'destinationCountry', 'destinationPort', 'expiryDate',
];

const SAMPLE_ROW = [
  'TF/00500', '2026-03-01', 'SEA', 'EXP', 'FCL',
  'Malaysia', 'Port Klang - [Malaysia - MYKUL]',
  'India', 'Mumbai - [India - INBOM]', '2026-12-31',
];

// Minimal CSV parse — handles quoted cells containing commas.
const parseCsv = (text) => {
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rawLine.length; i += 1) {
      const ch = rawLine[i];
      if (ch === '"') {
        if (inQuotes && rawLine[i + 1] === '"') { cur += '"'; i += 1; } else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
};

const ImportRMSModal = ({ onClose }) => {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const downloadSample = () => {
    const csv = [SAMPLE_HEADERS.join(','), SAMPLE_ROW.join(',')].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rms-tariff-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const apply = async () => {
    if (!file) { toast.error('Choose a file first'); return; }
    if (/\.xlsx?$/i.test(file.name)) {
      toast.error('Excel parsing is not wired up yet — save the sheet as CSV and retry.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const [header, ...body] = parseCsv(text);
      if (!header) throw new Error('empty file');
      const rows = body.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
      const res = await rmsTariffsAPI.importRows(rows);
      const { created, updated } = res.data.data;
      toast.success(`Imported — ${created} created, ${updated} updated`);
      onClose();
      window.location.reload();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Import failed — check the column headers.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-blue-700">Import RMS</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-8 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-gray-700 w-28">Upload File</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded"
              >
                <Upload className="w-4 h-4" /> Upload your file
              </button>
              {file && <span className="text-sm text-gray-600">{file.name}</span>}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center gap-4">
            <button
              onClick={apply}
              disabled={busy}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded"
            >
              {busy ? 'Importing...' : 'Apply'}
            </button>
            <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          </div>
          <p className="text-sm text-gray-600">
            Download Sample:{' '}
            <button onClick={downloadSample} className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium">
              <FileDown className="w-3.5 h-3.5" /> Excel file
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImportRMSModal;
