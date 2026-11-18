import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, Save, Play, Trash2, CheckCircle2, XCircle,
  Database, BarChart3, AlertTriangle, Download, RefreshCw, FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  organizationsAPI, carriersAPI, accountingAPI, crmAPI, masterDataAPI,
} from '../../../services/api';
import { exportCsv, parseCsv } from '../../../utils/exportCsv';

// ETL: bulk import, saved import templates, and the reporting menu.
//
// The importer turns a CSV into real records through each target's own create
// endpoint, so every server-side rule (required fields, ACL, numbering,
// validation) applies exactly as it does when a user keys a record in. Rows
// are imported one at a time and each gets its own result, so one bad row
// never loses the rest.
//
// A mapping can be saved as an ETL Model Template and reused - the templates
// live in the shared master-data table, so they are the same for every user.

const TARGETS = {
  organization: {
    label: 'Organizations (contacts)',
    create: (row) => organizationsAPI.create({ companyType: 'company', isActive: true, ...row }),
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['company', 'company name', 'organization'] },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone', aliases: ['telephone', 'tel'] },
      { key: 'mobile', label: 'Mobile' },
      { key: 'streetName', label: 'Street', aliases: ['street', 'address'] },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'country', label: 'Country' },
      { key: 'zip', label: 'Postcode', aliases: ['zip', 'postal code'] },
      { key: 'vat', label: 'VAT / TRN', aliases: ['trn', 'tax id', 'vat number'] },
      { key: 'website', label: 'Website' },
      { key: 'contactPerson', label: 'Contact person', aliases: ['contact'] },
      { key: 'customerCode', label: 'Customer code', aliases: ['code'] },
    ],
  },
  prospect: {
    label: 'Prospects (CRM)',
    create: (row) => crmAPI.prospects.create(row),
    fields: [
      { key: 'name', label: 'Company', required: true, aliases: ['company', 'company name'] },
      { key: 'contactName', label: 'Contact', aliases: ['contact', 'contact person'] },
      { key: 'designation', label: 'Designation', aliases: ['title', 'job title'] },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'industry', label: 'Industry' },
      { key: 'clientTag', label: 'Client tag', aliases: ['tag', 'segment'] },
      { key: 'remarks', label: 'Remarks', aliases: ['notes'] },
    ],
  },
  carrier: {
    label: 'Carriers',
    create: (row) => carriersAPI.create({ status: 'active', ...row }),
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['carrier', 'carrier name'] },
      { key: 'code', label: 'Code', required: true, aliases: ['carrier code'] },
      {
        key: 'type', label: 'Type', aliases: ['carrier type'],
        hint: 'shipping_line, airline or trucking',
      },
      { key: 'scac', label: 'SCAC' },
      { key: 'iataCode', label: 'IATA code', aliases: ['iata'] },
      { key: 'country', label: 'Country' },
      { key: 'website', label: 'Website' },
      { key: 'trackingUrl', label: 'Tracking URL' },
    ],
  },
  product: {
    label: 'Products / charge codes',
    create: (row) => accountingAPI.createProduct({
      canBeSold: true, canBePurchased: true, active: true, ...row,
    }),
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['product', 'charge', 'charge name'] },
      { key: 'internalReference', label: 'Code', aliases: ['code', 'reference', 'charge code'] },
      { key: 'salesPrice', label: 'Sales price', number: true, aliases: ['sell', 'sell rate', 'price'] },
      { key: 'cost', label: 'Cost', number: true, aliases: ['buy', 'buy rate'] },
      { key: 'category', label: 'Category' },
      { key: 'uom', label: 'Unit', aliases: ['uom', 'unit of measure'] },
    ],
  },
  ...Object.fromEntries([
    ['hs-codes', 'HS Codes'],
    ['commodity', 'Commodities'],
    ['un-locode-locations', 'UN/LOCODE Locations'],
    ['client-tag', 'Client Tags'],
    ['carrier-service-type', 'Carrier Service Types'],
    ['truck-number', 'Truck Numbers'],
    ['vessel', 'Vessels'],
    ['cities', 'Cities'],
  ].map(([category, label]) => [`master:${category}`, {
    label: `Master data: ${label}`,
    create: (row) => masterDataAPI.create(category, row),
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['description'] },
      { key: 'code', label: 'Code' },
      { key: 'extra', label: 'Detail 1' },
      { key: 'extra2', label: 'Detail 2' },
      { key: 'description', label: 'Notes', aliases: ['remarks'] },
    ],
  }])),
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Best-guess column for each field: exact key, label, then any alias. */
const autoMap = (fields, headers) => {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const out = {};
  for (const f of fields) {
    const candidates = [f.key, f.label, ...(f.aliases || [])].map(norm);
    const hit = candidates.find((c) => byNorm.has(c));
    out[f.key] = hit ? byNorm.get(hit) : '';
  }
  return out;
};

const toPayload = (fields, mapping, row) => {
  const out = {};
  for (const f of fields) {
    const col = mapping[f.key];
    if (!col) continue;
    let v = row[col];
    if (v === undefined || v === '') continue;
    if (f.number) {
      const n = Number(String(v).replace(/,/g, ''));
      v = Number.isFinite(n) ? n : v;
    }
    out[f.key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
};

const rowProblems = (fields, payload) => fields
  .filter((f) => f.required && (payload[f.key] === undefined || payload[f.key] === ''))
  .map((f) => `${f.label} is required`)
  .concat(fields
    .filter((f) => f.number && payload[f.key] !== undefined && typeof payload[f.key] !== 'number')
    .map((f) => `${f.label} must be a number`));

// --- importer ---------------------------------------------------------------

const Importer = () => {
  const [target, setTarget] = useState('organization');
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [templates, setTemplates] = useState([]);

  const spec = TARGETS[target];

  const loadTemplates = useCallback(async () => {
    try {
      const res = await masterDataAPI.getAll('etl-template', {});
      setTemplates(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch { setTemplates([]); }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // A new target or new file re-guesses the mapping.
  useEffect(() => {
    setMapping(autoMap(spec.fields, headers));
    setResults(null);
  }, [target, headers, spec]);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const parsed = await parseCsv(f);
      if (!parsed.headers.length) {
        toast.error('That file has no header row');
        return;
      }
      setFile(f);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      toast.success(`${parsed.rows.length} row(s) read from ${f.name}`);
    } catch {
      toast.error('Could not read that file. Save it as CSV (comma separated) and try again.');
    }
  };

  const preview = useMemo(() => rows.slice(0, 8).map((r) => {
    const payload = toPayload(spec.fields, mapping, r);
    return { payload, problems: rowProblems(spec.fields, payload) };
  }), [rows, mapping, spec]);

  const invalidCount = useMemo(
    () => rows.filter((r) => rowProblems(spec.fields, toPayload(spec.fields, mapping, r)).length).length,
    [rows, mapping, spec],
  );

  const missingRequired = spec.fields.filter((f) => f.required && !mapping[f.key]);

  const run = async () => {
    if (missingRequired.length) {
      toast.error(`Map a column to: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }
    const ok = window.confirm(
      `Import ${rows.length} row(s) as ${spec.label}?\n\n`
      + `${invalidCount} row(s) fail validation and will be skipped.\n`
      + 'Each row is created separately, so a failure does not stop the rest.',
    );
    if (!ok) return;
    setRunning(true);
    setProgress(0);
    const out = [];
    for (let i = 0; i < rows.length; i += 1) {
      const payload = toPayload(spec.fields, mapping, rows[i]);
      const problems = rowProblems(spec.fields, payload);
      if (problems.length) {
        out.push({ row: i + 2, status: 'skipped', message: problems.join('; '), data: rows[i] });
      } else {
        try {
          await spec.create(payload);
          out.push({ row: i + 2, status: 'created', message: '', data: rows[i] });
        } catch (err) {
          out.push({
            row: i + 2,
            status: 'failed',
            message: err.response?.data?.message || err.message || 'Failed',
            data: rows[i],
          });
        }
      }
      setProgress(i + 1);
    }
    setResults(out);
    setRunning(false);
    const created = out.filter((r) => r.status === 'created').length;
    toast.success(`${created} of ${rows.length} row(s) imported`);
  };

  const downloadErrors = () => {
    const bad = (results || []).filter((r) => r.status !== 'created');
    const spec2 = [
      { label: 'Row', key: 'row' },
      { label: 'Status', key: 'status' },
      { label: 'Reason', key: 'message' },
      ...headers.map((h) => ({ label: h, key: (r) => r.data[h] })),
    ];
    if (exportCsv(bad, spec2, `etl-errors-${target}`)) toast.success(`${bad.length} row(s) exported`);
  };

  const saveTemplate = async () => {
    const name = window.prompt('Name this mapping so it can be reused:', `${spec.label} import`);
    if (!name) return;
    try {
      await masterDataAPI.create('etl-template', {
        name,
        code: target,
        description: JSON.stringify({ target, mapping }),
      });
      toast.success('Template saved');
      await loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the template');
    }
  };

  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    try {
      const parsed = JSON.parse(t.description || '{}');
      if (parsed.target && TARGETS[parsed.target]) setTarget(parsed.target);
      // Apply after the target switch has re-guessed the mapping.
      setTimeout(() => setMapping((m) => ({ ...m, ...(parsed.mapping || {}) })), 0);
      toast.success(`Template "${t.name}" applied`);
    } catch {
      toast.error('That template could not be read');
    }
  };

  const downloadSample = () => {
    const sample = [Object.fromEntries(spec.fields.map((f) => [f.label, f.required ? `Example ${f.label}` : '']))];
    exportCsv(sample, spec.fields.map((f) => ({ label: f.label, key: f.label })), `etl-sample-${target}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Create Mapping Data / ETL Operation</h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Load a CSV, match its columns to the fields of the record you are
          creating, check the preview, then import. Every row is created through
          the same rules as a record keyed in by hand.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            1. What are you importing?
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={running}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          >
            {Object.entries(TARGETS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
          <button
            type="button"
            onClick={downloadSample}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
          >
            <Download size={11} /> Download a sample file
          </button>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            2. Choose the CSV file
          </label>
          <label className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-slate-300 rounded text-xs text-slate-600 cursor-pointer hover:border-blue-400">
            <Upload size={13} />
            <span className="truncate">{file ? `${file.name} (${rows.length} rows)` : 'Select a .csv file'}</span>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" disabled={running} />
          </label>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Or start from a saved template
          </label>
          <select
            value=""
            onChange={(e) => applyTemplate(e.target.value)}
            disabled={running || !templates.length}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-50"
          >
            <option value="">{templates.length ? 'Choose a template' : 'No templates saved yet'}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {!!headers.length && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">3. Match the columns</h2>
            <button
              type="button"
              onClick={saveTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Save size={13} /> Save as template
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {spec.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={mapping[f.key] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  className={`w-full px-2 py-1.5 border rounded text-xs ${
                    f.required && !mapping[f.key] ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                >
                  <option value="">Do not import</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {f.hint && <p className="mt-0.5 text-[10px] text-slate-400">{f.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!rows.length && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              4. Preview <span className="font-normal text-slate-500">(first {preview.length} of {rows.length})</span>
            </h2>
            <div className="flex items-center gap-3">
              {invalidCount > 0 && (
                <span className="text-[11px] text-amber-700 inline-flex items-center gap-1">
                  <AlertTriangle size={12} /> {invalidCount} row(s) will be skipped
                </span>
              )}
              <button
                type="button"
                onClick={run}
                disabled={running || !!missingRequired.length}
                title={missingRequired.length ? `Map: ${missingRequired.map((f) => f.label).join(', ')}` : 'Import every row'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <Play size={13} /> {running ? `Importing ${progress}/${rows.length}…` : `Import ${rows.length} row(s)`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {spec.fields.filter((f) => mapping[f.key]).map((f) => (
                    <th key={f.key} className="px-2 py-1.5 text-left font-semibold">{f.label}</th>
                  ))}
                  <th className="px-2 py-1.5 text-left font-semibold">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((p, i) => (
                  <tr key={i}>
                    {spec.fields.filter((f) => mapping[f.key]).map((f) => (
                      <td key={f.key} className="px-2 py-1.5 text-slate-700 max-w-[160px] truncate">
                        {String(p.payload[f.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      {p.problems.length
                        ? <span className="text-red-600">{p.problems.join('; ')}</span>
                        : <span className="text-emerald-600">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-800">Result</h2>
            {results.some((r) => r.status !== 'created') && (
              <button
                type="button"
                onClick={downloadErrors}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Download size={13} /> Download rows that did not import
              </button>
            )}
          </div>
          <div className="flex gap-4 text-xs mb-2">
            <span className="text-emerald-700 inline-flex items-center gap-1">
              <CheckCircle2 size={13} /> {results.filter((r) => r.status === 'created').length} created
            </span>
            <span className="text-amber-700">{results.filter((r) => r.status === 'skipped').length} skipped</span>
            <span className="text-red-700 inline-flex items-center gap-1">
              <XCircle size={13} /> {results.filter((r) => r.status === 'failed').length} failed
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {results.filter((r) => r.status !== 'created').map((r) => (
              <p key={r.row} className="text-[11px] text-slate-600 border-t border-slate-100 py-1">
                Row {r.row}: <span className={r.status === 'failed' ? 'text-red-600' : 'text-amber-700'}>{r.message}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- saved templates --------------------------------------------------------

const Templates = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterDataAPI.getAll('etl-template', {});
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (t) => {
    if (!window.confirm(`Delete the template "${t.name}"?\n\nThis cannot be undone.`)) return;
    try {
      await masterDataAPI.delete('etl-template', t.id);
      toast.success('Template deleted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete the template');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">ETL Model Template</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Saved column mappings. Save one from the importer and pick it next time.
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Template</th>
              <th className="px-3 py-2 text-left font-semibold">Imports into</th>
              <th className="px-3 py-2 text-left font-semibold">Mapped fields</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && !rows.length && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                No templates yet. Map a file in the importer and use &ldquo;Save as template&rdquo;.
              </td></tr>
            )}
            {!loading && rows.map((t) => {
              let parsed = {};
              try { parsed = JSON.parse(t.description || '{}'); } catch { /* shown as unreadable */ }
              const mapped = Object.entries(parsed.mapping || {}).filter(([, v]) => v);
              return (
                <tr key={t.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{t.name}</td>
                  <td className="px-3 py-2 text-slate-600">{TARGETS[parsed.target]?.label || parsed.target || '-'}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {mapped.length ? mapped.map(([k, v]) => `${k} ← ${v}`).join(', ') : 'Unreadable'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      title="Delete this template"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- report menu ------------------------------------------------------------
// Every entry opens the shared report engine. "Schedule Download" reports are
// the same reports with Export, since this app runs them on demand rather than
// on a timer.

const REPORT_GROUPS = [
  {
    title: 'On Screen View',
    items: [
      ['consolidated-house-shipment', 'Consolidated House Shipment Report'],
      ['shipment-analysis', 'Shipment Analysis'],
      ['shipment-document-analysis', 'Shipment Document Analysis'],
    ],
  },
  {
    title: 'Direct Excel Download',
    items: [['charge-wise-cost-analysis', 'Charge Wise Cost Analysis']],
  },
  {
    title: 'Schedule Download',
    items: [
      ['aged-payable', 'Aged Payable'],
      ['aged-receivable', 'Aged Receivable'],
      ['carrier-wise-teu', 'Carrier Wise Invoice / TEUs Report'],
      ['customer-wise-billing', 'Customer Wise Billing Report'],
      ['pending-carrier-invoice', 'Pending Carrier Invoice Report (Outstanding)'],
      ['salesperson-teu-profit', 'Salesperson Wise TEUs and Profitability'],
      ['shipment-profitability', 'Shipment Profitability Report'],
      ['tradeline-wise', 'Tradeline Wise Carrier / TEUs / Invoice'],
    ],
  },
  {
    title: 'Data Discrepancy Reports',
    items: [
      ['accounting-without-shipment', 'Accounting Without Shipment'],
      ['shipment-without-container', 'Shipment Without Container Number'],
      ['shipment-without-cost', 'Shipment Without Cost Charges'],
      ['shipment-without-revenue', 'Shipment Without Revenue Charges'],
    ],
  },
];

const ReportMenu = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [checking, setChecking] = useState(false);

  // The discrepancy reports are exception lists, so their row counts are the
  // headline: zero is the good outcome.
  const check = useCallback(async () => {
    setChecking(true);
    const ids = REPORT_GROUPS.find((g) => g.title === 'Data Discrepancy Reports').items.map(([id]) => id);
    const next = {};
    for (const id of ids) {
      try {
        const res = await accountingAPI.runReport(id, {});
        next[id] = (res.data?.data?.rows || []).length;
      } catch {
        next[id] = null;
      }
    }
    setCounts(next);
    setChecking(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">ETL Reporting</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every report opens on screen with Export to CSV. The discrepancy
            lists show how many records need attention.
          </p>
        </div>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> Re-check discrepancies
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_GROUPS.map((g) => (
          <div key={g.title} className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{g.title}</h2>
            <div className="space-y-1">
              {g.items.map(([id, label]) => {
                const n = counts[id];
                const isCheck = g.title === 'Data Discrepancy Reports';
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(`/admin/ops-reports/${id}`)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-700 hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      {isCheck ? <AlertTriangle size={13} className="text-slate-400" /> : <BarChart3 size={13} className="text-slate-400" />}
                      {label}
                    </span>
                    {isCheck && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        n === undefined ? 'bg-slate-100 text-slate-400'
                          : n === null ? 'bg-slate-100 text-slate-500'
                            : n === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                      >
                        {n === undefined ? '…' : n === null ? 'no access' : n === 0 ? 'clean' : `${n} to fix`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- shell ------------------------------------------------------------------

const MENU = [
  { to: 'import', label: 'Create Mapping Data', icon: FileSpreadsheet },
  { to: 'templates', label: 'ETL Model Template', icon: FolderOpen },
  { to: 'reports', label: 'Reporting', icon: BarChart3 },
];

const EtlLayout = () => (
  <div className="flex gap-4">
    <aside className="w-52 flex-shrink-0 bg-white border border-slate-200 rounded-lg p-3 h-fit">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2 mb-2 inline-flex items-center gap-1.5">
        <Database size={12} /> ETL
      </h2>
      <nav className="space-y-0.5">
        {MENU.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
              isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Icon size={13} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
    <div className="flex-1 min-w-0">
      <Routes>
        <Route index element={<Navigate to="import" replace />} />
        <Route path="import" element={<Importer />} />
        <Route path="templates" element={<Templates />} />
        <Route path="reports" element={<ReportMenu />} />
        <Route path="*" element={<Navigate to="import" replace />} />
      </Routes>
    </div>
  </div>
);

export default EtlLayout;
