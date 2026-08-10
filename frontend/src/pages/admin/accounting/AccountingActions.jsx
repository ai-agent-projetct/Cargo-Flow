import React, { useState, useEffect, useCallback } from 'react';
import { Link2, Lock, Upload, Check } from 'lucide-react';
import api from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');

// ── Reconciliation ──────────────────────────────────────────────────────────
// Pick one open payment and one open invoice, then match them. The backend
// applies the smaller of the two, so a partial settlement leaves the invoice
// open with a reduced residual.
const Reconciliation = () => {
  const { guard } = usePermissions();
  const [data, setData] = useState({ invoices: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => api.get('/accounting/actions/reconciliation'));
    if (res) setData(res.data.data);
    setLoading(false);
  }, [guard]);

  useEffect(() => { load(); }, [load]);

  const reconcile = async () => {
    if (!payment || !invoice) return;
    const res = await guard(() => api.post('/accounting/actions/reconcile', {
      paymentId: payment, moveId: invoice,
    }));
    if (res) {
      setNote(res.data.message);
      setPayment(null); setInvoice(null);
      load();
    }
  };

  if (loading) return <PageLoader />;

  const Panel = ({ title, rows, selected, onSelect, amountKey }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 min-w-[20rem]">
      <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">
        {title} ({rows.length})
      </div>
      <div className="max-h-[26rem] overflow-y-auto">
        <table className="w-full text-xs">
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td className="text-center py-8 text-gray-400">Nothing open</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} onClick={() => onSelect(selected === r.id ? null : r.id)}
                className={`cursor-pointer ${selected === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <td className="px-2 py-1.5 w-6">
                  {selected === r.id && <Check className="w-3.5 h-3.5 text-blue-700" />}
                </td>
                <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                <td className="px-2 py-1.5 text-gray-600 max-w-[12rem] truncate">{r.partner}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-2 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                  {money(r[amountKey])} {r.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Reconciliation
        </h2>
        <button onClick={reconcile} disabled={!payment || !invoice}
          className="px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800 disabled:opacity-40">
          Reconcile
        </button>
      </div>
      {note && <div className="mb-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{note}</div>}
      <div className="flex gap-3 flex-wrap">
        <Panel title="Open Payments" rows={data.payments} selected={payment} onSelect={setPayment} amountKey="amount" />
        <Panel title="Open Invoices" rows={data.invoices} selected={invoice} onSelect={setInvoice} amountKey="residual" />
      </div>
    </div>
  );
};

// ── Lock dates ──────────────────────────────────────────────────────────────
const LOCK_FIELDS = [
  ['fiscalYearLockDate', 'All Users Lock Date'],
  ['taxLockDate', 'Tax Return Lock Date'],
  ['salesLockDate', 'Sales Lock Date'],
  ['purchaseLockDate', 'Purchase Lock Date'],
];

const LockDates = () => {
  const { guard } = usePermissions();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => api.get('/accounting/actions/lock-dates'));
    if (res) setValues(res.data.data);
    setLoading(false);
  }, [guard]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const res = await guard(() => api.put('/accounting/actions/lock-dates', values));
    if (res) { setValues(res.data.data); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="px-6 pb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-3 inline-flex items-center gap-2">
        <Lock className="w-4 h-4" /> Lock Dates
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-xl">
        <p className="text-xs text-gray-500 mb-4">
          Entries dated on or before a lock date can no longer be changed.
        </p>
        {LOCK_FIELDS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3 mb-3">
            <label className="text-xs text-gray-700" htmlFor={key}>{label}</label>
            <input id={key} type="date" value={values[key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1 text-xs" />
          </div>
        ))}
        <div className="flex items-center gap-3 mt-4">
          <button onClick={save}
            className="px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800">
            Save
          </button>
          {saved && <span className="text-xs text-green-700">Saved</span>}
        </div>
      </div>
    </div>
  );
};

// ── Import statement ────────────────────────────────────────────────────────
// Parse the CSV in the browser, show what was read, then let the user commit it.
const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const idx = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = idx('date');
  const iLabel = idx('label', 'description', 'narration');
  const iPartner = idx('partner', 'counterparty', 'payee');
  const iAmount = idx('amount', 'value');
  const iRef = idx('reference', 'ref');

  return lines.slice(1).map((l) => {
    const cells = l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      date: iDate >= 0 ? cells[iDate] : '',
      label: iLabel >= 0 ? cells[iLabel] : '',
      partner: iPartner >= 0 ? cells[iPartner] : '',
      reference: iRef >= 0 ? cells[iRef] : '',
      amount: iAmount >= 0 ? Number(cells[iAmount]) || 0 : 0,
    };
  }).filter((r) => r.amount);
};

const ImportStatement = () => {
  const { guard } = usePermissions();
  const [rows, setRows] = useState([]);
  const [journal, setJournal] = useState('Bank');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setError(''); setResult('');
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError('Only CSV statements are supported. Export your statement as CSV and retry.');
      setRows([]);
      return;
    }
    const parsed = parseCsv(await file.text());
    if (!parsed.length) setError('No usable rows found — the file needs a date and an amount column.');
    setRows(parsed);
  };

  const commit = async () => {
    const res = await guard(() => api.post('/accounting/actions/import-statement', { journal, lines: rows }));
    if (res) { setResult(res.data.message); setRows([]); }
  };

  return (
    <div className="px-6 pb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-3 inline-flex items-center gap-2">
        <Upload className="w-4 h-4" /> Import Statement
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <input type="file" accept=".csv" onChange={onFile} className="text-xs" />
          <label className="text-xs text-gray-600" htmlFor="journal">Journal</label>
          <input id="journal" value={journal} onChange={(e) => setJournal(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs" />
          <button onClick={commit} disabled={!rows.length}
            className="px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800 disabled:opacity-40">
            Import {rows.length ? `${rows.length} lines` : ''}
          </button>
        </div>
        {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
        {result && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-2">{result}</div>}
        {rows.length > 0 && (
          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['Date', 'Label', 'Partner', 'Reference', 'Amount'].map((h) => (
                    <th key={h} className={`px-2 py-1.5 font-semibold text-gray-700 ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  // Parsed CSV rows have no natural key.
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={i}>
                    <td className="px-2 py-1 text-gray-700">{r.date}</td>
                    <td className="px-2 py-1 text-gray-700">{r.label}</td>
                    <td className="px-2 py-1 text-gray-700">{r.partner}</td>
                    <td className="px-2 py-1 text-gray-500">{r.reference}</td>
                    <td className="px-2 py-1 text-right font-medium text-gray-900">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export { Reconciliation, LockDates, ImportStatement };
export default Reconciliation;
