import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Layers, Star, SlidersHorizontal, ChevronLeft, ChevronRight, MoreVertical, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';

const money = (v, cur = 'AED') => {
  const n = Number(v || 0);
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (cur === 'USD') return `${n < 0 ? '-' : ''}$ ${s}`;
  return `${n < 0 ? '-' : ''}${s} ${cur}`;
};

// The ageing bar under sale/purchase cards: six labelled columns.
const AgeingBar = ({ buckets }) => {
  const max = Math.max(1, ...buckets.map((b) => Math.abs(Number(b.amount || 0))));
  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <div className="flex items-end gap-1 h-14">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 flex items-end justify-center h-full">
            <div
              className="w-full bg-rose-200 rounded-sm"
              style={{ height: `${Math.max(4, (Math.abs(Number(b.amount || 0)) / max) * 100)}%` }}
              title={money(b.amount)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {buckets.map((b, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-gray-500 truncate" title={b.label}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Bank/cash cards carry a sparkline instead of the ageing bar.
const Sparkline = ({ points }) => {
  if (!points?.length) return <div className="h-16" />;
  const max = Math.max(...points, 1);
  const d = points.map((p, i) =>
    `${(i / (points.length - 1)) * 100},${40 - (p / max) * 34}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-16 mt-2">
      <polygon points={`0,40 ${d} 100,40`} fill="#e5e7eb" />
      <polyline points={d} fill="none" stroke="#9ca3af" strokeWidth="0.7" />
    </svg>
  );
};

const btn = 'px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded';
const link = 'text-blue-700 hover:underline text-sm text-left';

const JournalCard = ({ j, onAction }) => {
  const a = j.actions;
  const [menu, setMenu] = useState(false);
  const cur = j.currency || 'AED';

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm relative"
      style={j.colour ? { borderLeft: `4px solid ${j.colour}` } : undefined}>
      <div className="flex items-start justify-between px-4 pt-3">
        <button onClick={() => onAction('open', j)} className="text-blue-700 font-semibold text-sm hover:underline text-left">
          {j.name}
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="text-gray-400 hover:text-gray-700">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white border border-gray-200 rounded shadow-lg py-1">
              {['Edit', 'Reports', 'Configuration'].map((x) => (
                <button key={x} onClick={() => { setMenu(false); onAction(x.toLowerCase(), j); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{x}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 pt-2 flex gap-4">
        {/* Left: actions */}
        <div className="flex flex-col items-start gap-1.5 min-w-[8.5rem]">
          {a.newInvoice && <button onClick={() => onAction('new-invoice', j)} className={btn}>New Invoice</button>}
          {a.upload && !a.newInvoice && <button onClick={() => onAction('upload', j)} className={btn}>Upload</button>}
          {a.newEntry && <button onClick={() => onAction('new-entry', j)} className={btn}>New Entry</button>}
          {a.newTransaction && <button onClick={() => onAction('new-transaction', j)} className={btn}>New Transaction</button>}
          {a.reconcile && (
            <button onClick={() => onAction('reconcile', j)} className={btn}>
              Reconcile {j.toReconcile} Items
            </button>
          )}
          {a.connect && <button onClick={() => onAction('connect', j)} className={btn}>Connect</button>}
          {a.createManually && <button onClick={() => onAction('create-manually', j)} className={link}>Create Manually</button>}
          {a.importStatements && (
            <p className="text-xs">
              <button onClick={() => onAction('create-statement', j)} className="text-blue-700 hover:underline">Create</button>
              <span className="text-gray-500"> or </span>
              <button onClick={() => onAction('import-statement', j)} className="text-blue-700 hover:underline">Import (OCA)</button>
              <span className="text-gray-500"> Statements</span>
            </p>
          )}
          {a.newTransactionLink && (
            <button onClick={() => onAction('new-transaction', j)} className={link}>New Transaction</button>
          )}
        </div>

        {/* Right: figures */}
        <div className="flex-1 min-w-0 text-sm">
          {a.showCounters && (
            <div className="space-y-0.5">
              {j.toValidateCount > 0 && (
                <div className="flex justify-between gap-3">
                  <button onClick={() => onAction('to-validate', j)} className={link}>
                    {j.toValidateCount} {j.type === 'sale' ? 'Invoices' : 'Bills'} to Validate
                  </button>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.toValidateAmount, cur)}</span>
                </div>
              )}
              {j.unpaidCount > 0 && (
                <div className="flex justify-between gap-3">
                  <button onClick={() => onAction('unpaid', j)} className={link}>
                    {j.unpaidCount} {j.type === 'sale' ? 'Unpaid Invoices' : 'Bills to Pay'}
                  </button>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.unpaidAmount, cur)}</span>
                </div>
              )}
              {j.lateCount > 0 && (
                <div className="flex justify-between gap-3">
                  <button onClick={() => onAction('late', j)} className={link}>
                    {j.lateCount} Late {j.type === 'sale' ? 'Invoices' : 'Bills'}
                  </button>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.lateAmount, cur)}</span>
                </div>
              )}
              {j.toCheckCount > 0 && (
                <div className="flex justify-between gap-3">
                  <button onClick={() => onAction('to-check', j)} className={link}>{j.toCheckCount} to check</button>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.toCheckAmount, cur)}</span>
                </div>
              )}
            </div>
          )}

          {a.showBalances && (
            <div className="space-y-0.5">
              {Number(j.balanceGl) !== 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Balance in GL</span>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.balanceGl, cur)}</span>
                </div>
              )}
              {j.outstandingAmount !== null && j.outstandingAmount !== undefined && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Outstanding Payments/Receipts</span>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.outstandingAmount, cur)}</span>
                </div>
              )}
              {j.latestStatement !== null && j.latestStatement !== undefined && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Latest Statement</span>
                  <span className="text-gray-800 whitespace-nowrap">{money(j.latestStatement, cur)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {a.showCounters && (j.ageingBuckets || []).length > 0 && <div className="px-4 pb-3"><AgeingBar buckets={j.ageingBuckets} /></div>}
      {a.showBalances && (j.sparkline || []).length > 0 && <div className="px-2 pb-2"><Sparkline points={j.sparkline} /></div>}
    </div>
  );
};

const AccountingDashboard = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [favourites, setFavourites] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/journals/dashboard');
      setCards(res.data.data.cards || []);
    } catch {
      toast.error('Could not load the accounting dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onAction = async (kind, j) => {
    // Counter links and invoice actions route into the Invoices list, filtered.
    const toInvoices = (q) => navigate(`/admin/accounting/customers/invoices?journal=${encodeURIComponent(j.name)}${q}`);
    const toBills = (q) => navigate(`/admin/accounting/vendors/bills?journal=${encodeURIComponent(j.name)}${q}`);
    const sale = j.type === 'sale';

    switch (kind) {
      case 'to-validate': return sale ? toInvoices('&status=draft') : toBills('&status=draft');
      case 'unpaid': return sale ? toInvoices('&payment=not_paid') : toBills('&payment=not_paid');
      case 'late': return sale ? toInvoices('&overdue=1') : toBills('&overdue=1');
      case 'to-check': return toInvoices('&to_check=1');
      case 'new-invoice': return navigate(`/admin/accounting/customers/invoices/create?journal=${encodeURIComponent(j.name)}`);
      case 'new-entry': return navigate(`/admin/accounting/entries/create?journal=${encodeURIComponent(j.name)}`);
      case 'new-transaction': return navigate(`/admin/accounting/customers/payments/create?journal=${encodeURIComponent(j.name)}`);
      case 'open': return sale || j.type === 'purchase'
        ? (sale ? toInvoices('') : toBills(''))
        : navigate(`/admin/accounting/journals/bank-cash?journal=${encodeURIComponent(j.name)}`);
      case 'connect': {
        try {
          await api.post(`/accounting/journals/${j.id}/connect`);
          toast.success('Bank feed connected');
          load();
        } catch { toast.error('Could not connect the feed'); }
        return undefined;
      }
      case 'reconcile': {
        try {
          const res = await api.post(`/accounting/journals/${j.id}/reconcile`);
          toast.success(res.data.message);
          load();
        } catch (err) { toast.error(err.response?.data?.message || 'Reconcile failed'); }
        return undefined;
      }
      default:
        toast(`${kind.replace(/-/g, ' ')} — coming in a later wave`);
        return undefined;
    }
  };

  const shown = cards.filter((c) =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">Accounting Dashboard</h2>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {favourites && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                <Filter className="w-3 h-3" /> Favorites
                <button onClick={() => setFavourites(false)}><X className="w-3 h-3" /></button>
              </span>
            )}
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className="w-96 pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <button className="flex items-center gap-1 hover:text-gray-900"><Filter className="w-3.5 h-3.5" /> Filters</button>
            <button className="flex items-center gap-1 hover:text-gray-900"><Layers className="w-3.5 h-3.5" /> Group By</button>
            <button className="flex items-center gap-1 hover:text-gray-900"><Star className="w-3.5 h-3.5" /> Favorites</button>
            <button className="hover:text-gray-900"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
            <span className="text-xs">1-{shown.length} / {shown.length}</span>
            <button className="p-1 opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1 opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {shown.map((j) => <JournalCard key={j.id} j={j} onAction={onAction} />)}
        </div>
      )}
    </div>
  );
};

export default AccountingDashboard;
