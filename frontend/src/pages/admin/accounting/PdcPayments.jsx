import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, Search, RefreshCw, Download, Save, X, Landmark, CheckCircle2,
  XCircle, RotateCcw, Undo2, Calendar, AlertTriangle, Trash2, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pdcAPI, accountingAPI, organizationsAPI } from '../../../services/api';
import { exportCsv } from '../../../utils/exportCsv';

// Accounting > Post Dated Cheque (PDC) > PDC Payments.
//
// A post-dated cheque must not touch the bank ledger when it is taken in,
// because the money is not there yet. The lifecycle is
// registered -> deposited -> done, with returned and bounced as the failure
// exits. Only "done" posts a payment, which is what keeps a drawer full of
// post-dated cheques out of the cash position.

const STATE_META = {
  registered: { label: 'Held', className: 'bg-slate-100 text-slate-700', hint: 'In hand, not yet banked' },
  deposited: { label: 'Banked', className: 'bg-blue-100 text-blue-700', hint: 'With the bank, not yet cleared' },
  done: { label: 'Cleared', className: 'bg-emerald-100 text-emerald-700', hint: 'Funds received, payment posted' },
  returned: { label: 'Returned', className: 'bg-amber-100 text-amber-700', hint: 'Handed back to the drawer' },
  bounced: { label: 'Bounced', className: 'bg-red-100 text-red-700', hint: 'Dishonoured by the bank' },
};

const money = (v, cur = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
};

const unwrap = (res) => {
  const d = res.data?.data;
  if (Array.isArray(d)) return d;
  return d?.rows || d?.journals || d?.organizations || [];
};

const today = () => new Date().toISOString().slice(0, 10);

const PdcPayments = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [maturity, setMaturity] = useState(null);
  const [journals, setJournals] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [view, setView] = useState('list');
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = { limit: 100 };
      if (search) q.search = search;
      if (state) q.state = state;
      const [listRes, matRes] = await Promise.all([
        pdcAPI.getAll(q),
        pdcAPI.maturity(),
      ]);
      setRows(listRes.data?.data?.payments || []);
      setSummary(listRes.data?.data?.summary || null);
      setMaturity(matRes.data?.data || null);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(err.response.data?.message || 'You do not have access to post-dated cheques');
      } else {
        toast.error(err.response?.data?.message || 'Could not load the cheques');
      }
    } finally {
      setLoading(false);
    }
  }, [search, state]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    (async () => {
      try {
        const [j, p] = await Promise.all([
          accountingAPI.journals({ limit: 'all' }),
          organizationsAPI.getAll({ limit: 'all' }),
        ]);
        setJournals(unwrap(j).filter((x) => ['bank', 'cash'].includes(x.type)) || []);
        setPartners(unwrap(p));
      } catch { /* the selects degrade to fewer options */ }
    })();
  }, []);

  const blank = () => ({
    chequeRef: '',
    paymentType: 'inbound',
    partnerId: '',
    journalId: journals[0]?.id || '',
    bankName: '',
    date: today(),
    paymentDate: '',
    amount: '',
    currency: 'AED',
    memo: '',
  });

  const startAdd = () => { setDraft(blank()); setEditingId(null); };
  const startEdit = (row) => { setDraft({ ...row }); setEditingId(row.id); };
  const cancel = () => { setDraft(null); setEditingId(null); };
  const setField = (f) => (e) => setDraft((d) => ({ ...d, [f]: e.target.value }));

  const save = async () => {
    if (!draft.journalId) { toast.error('Choose the bank journal the cheque will be banked into'); return; }
    if (!draft.paymentDate) { toast.error('Enter the date written on the cheque'); return; }
    if (!(Number(draft.amount) > 0)) { toast.error('Enter the cheque amount'); return; }
    setBusy(true);
    try {
      const payload = { ...draft, amount: Number(draft.amount), partnerId: draft.partnerId || null };
      if (editingId) {
        await pdcAPI.update(editingId, payload);
        toast.success('Cheque updated');
      } else {
        const res = await pdcAPI.create(payload);
        toast.success(res.data?.message || 'Cheque registered');
      }
      cancel();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the cheque');
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res?.data?.message || msg);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const deposit = (r) => {
    const due = String(r.paymentDate).slice(0, 10);
    if (due > today()) {
      const ok = window.confirm(
        `${r.name} is dated ${due}, which is in the future.\n\n`
        + 'A post-dated cheque should not be banked before its date. Bank it '
        + 'anyway only if the drawer has confirmed in writing.',
      );
      if (!ok) return;
      act(() => pdcAPI.deposit(r.id, { force: true }), 'Cheque deposited');
      return;
    }
    act(() => pdcAPI.deposit(r.id, {}), 'Cheque deposited');
  };

  const clear = (r) => {
    const date = window.prompt(
      `${r.name} cleared for ${money(r.amount, r.currency)}.\n\n`
      + 'This posts a payment and counts the funds as received. '
      + 'On what date did it clear?',
      today(),
    );
    if (!date) return;
    act(() => pdcAPI.clear(r.id, { clearingDate: date }), 'Cheque cleared and payment posted');
  };

  const bounce = (r) => {
    const reason = window.prompt(
      `${r.name} bounced. Why?\n\nThe invoices it was set against stay open.`,
      'Insufficient funds',
    );
    if (!reason) return;
    const charge = window.prompt('Bank charge to recover, if any:', '0');
    if (charge === null) return;
    act(
      () => pdcAPI.bounce(r.id, { reason, bounceCharge: Number(charge) || 0 }),
      'Cheque marked bounced',
    );
  };

  const markReturned = (r) => {
    const reason = window.prompt(`Return ${r.name} to the drawer. Why?`);
    if (!reason) return;
    act(() => pdcAPI.markReturned(r.id, { reason }), 'Cheque marked returned');
  };

  const reopen = (r) => {
    const date = window.prompt(
      `Put ${r.name} back in play. What is the new cheque date?`,
      String(r.paymentDate).slice(0, 10),
    );
    if (!date) return;
    act(() => pdcAPI.reopen(r.id, { paymentDate: date }), 'Cheque reopened');
  };

  const remove = (r) => {
    if (!window.confirm(`Delete ${r.name}?\n\nThis cannot be undone.`)) return;
    act(() => pdcAPI.delete(r.id), 'Cheque deleted');
  };

  const exportSpec = [
    { label: 'Reference', key: 'name' },
    { label: 'Cheque no.', key: 'chequeRef' },
    { label: 'Type', key: 'paymentType' },
    { label: 'Party', key: (r) => (r.partner ? (r.partner.companyName || r.partner.name) : '') },
    { label: 'Bank', key: 'bankName' },
    { label: 'Journal', key: (r) => r.journal?.name || '' },
    { label: 'Received', key: 'date' },
    { label: 'Cheque date', key: 'paymentDate' },
    { label: 'Cleared', key: 'clearingDate' },
    { label: 'Amount', key: 'amount' },
    { label: 'Currency', key: 'currency' },
    { label: 'State', key: (r) => STATE_META[r.state]?.label || r.state },
    { label: 'Bounce reason', key: 'bounceReason' },
  ];

  const stateTotals = (summary?.byState || []).reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || { count: 0, amount: 0 });
    acc[s.state].count += s.count;
    acc[s.state].amount += Number(s.amount) || 0;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Post Dated Cheques</h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Cheques held until their own date. Nothing reaches the bank ledger
            until a cheque is marked cleared, so held cheques stay out of the
            cash position.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-2.5 py-1.5 text-xs font-medium ${
                view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              All cheques
            </button>
            <button
              type="button"
              onClick={() => setView('maturity')}
              title="Group the open cheques by when they are bankable"
              className={`px-2.5 py-1.5 text-xs font-medium ${
                view === 'maturity' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Calendar size={13} className="inline mr-1" />Maturity
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference, cheque no., bank…"
              className="pl-8 pr-3 py-1.5 w-56 border border-slate-300 rounded text-xs"
            />
          </div>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={`px-2 py-1.5 border rounded text-xs ${
              state ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-300 text-slate-600'}`}
          >
            <option value="">Any state</option>
            {Object.entries(STATE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
          <button
            type="button"
            onClick={load}
            title="Reload"
            className="p-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => exportCsv(rows, exportSpec, 'pdc-payments')
              ? toast.success(`Exported ${rows.length} cheques`)
              : toast.error('Nothing to export')}
            disabled={!rows.length}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={13} /> Export
          </button>
          <button
            type="button"
            onClick={startAdd}
            disabled={!!draft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus size={13} /> Register a cheque
          </button>
        </div>
      </div>

      {/* State summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(STATE_META).map(([key, meta]) => {
          const t = stateTotals[key] || { count: 0, amount: 0 };
          return (
            <button
              key={key}
              type="button"
              onClick={() => setState(state === key ? '' : key)}
              title={meta.hint}
              className={`text-left px-3 py-2 rounded-lg border transition ${
                state === key ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.className}`}>
                  {meta.label}
                </span>
                <span className="text-xs font-bold text-slate-700">{t.count}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 tabular-nums">{money(t.amount)}</p>
            </button>
          );
        })}
      </div>

      {summary?.maturedAwaitingClearance > 0 && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{summary.maturedAwaitingClearance}</strong> cheque(s) have reached
            their date and are still not cleared. Check the Maturity view.
          </span>
        </div>
      )}

      {draft && (
        <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {editingId ? `Edit ${draft.name || 'cheque'}` : 'Register a post-dated cheque'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Cheque number">
              <input value={draft.chequeRef || ''} onChange={setField('chequeRef')} className={input} />
            </Field>
            <Field label="Direction">
              <select value={draft.paymentType} onChange={setField('paymentType')} className={input}>
                <option value="inbound">Received from a customer</option>
                <option value="outbound">Issued to a vendor</option>
              </select>
            </Field>
            <Field label="Party">
              <select value={draft.partnerId || ''} onChange={setField('partnerId')} className={input}>
                <option value="">Not set</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.companyName || p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Drawer's bank">
              <input value={draft.bankName || ''} onChange={setField('bankName')} className={input} />
            </Field>
            <Field label="Bank journal" hint="Where it will be banked when it matures">
              <select value={draft.journalId || ''} onChange={setField('journalId')} className={input}>
                <option value="">Choose a journal</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>{j.name} ({j.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Date received">
              <input type="date" value={String(draft.date || '').slice(0, 10)} onChange={setField('date')} className={input} />
            </Field>
            <Field label="Date on the cheque" hint="Not bankable before this date">
              <input
                type="date"
                value={String(draft.paymentDate || '').slice(0, 10)}
                onChange={setField('paymentDate')}
                className={input}
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft.amount ?? ''}
                onChange={setField('amount')}
                className={`${input} text-right`}
              />
            </Field>
            <Field label="Currency">
              <input value={draft.currency || 'AED'} onChange={setField('currency')} className={input} />
            </Field>
            <Field label="Memo" wide>
              <input value={draft.memo || ''} onChange={setField('memo')} className={input} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <X size={13} /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Save size={13} /> {busy ? 'Saving…' : 'Save cheque'}
            </button>
          </div>
        </div>
      )}

      {view === 'maturity' && maturity && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            ['overdue', 'Past due for banking', 'border-red-300'],
            ['dueThisWeek', 'Bankable this week', 'border-amber-300'],
            ['dueThisMonth', 'Bankable this month', 'border-slate-300'],
            ['later', 'Later', 'border-slate-200'],
          ].map(([key, label, border]) => {
            const b = maturity[key];
            return (
              <div key={key} className={`bg-white border rounded-lg p-3 ${border}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">{label}</h3>
                  <span className="text-xs font-bold text-slate-800">{b.count}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-1 tabular-nums">
                  {money(b.amount)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  in {money(b.inbound)} · out {money(b.outbound)}
                </p>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {!b.payments.length && <p className="text-[11px] text-slate-400">None</p>}
                  {b.payments.map((p) => (
                    <div key={p.id} className="text-[11px] border-t border-slate-100 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-600 truncate">{p.name}</span>
                        <span className="tabular-nums text-slate-700">{money(p.amount, p.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="truncate">
                          {p.partner ? (p.partner.companyName || p.partner.name) : '-'}
                        </span>
                        <span>{String(p.paymentDate).slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Reference</th>
                <th className="px-3 py-2 text-left font-semibold">Party</th>
                <th className="px-3 py-2 text-left font-semibold">Bank / journal</th>
                <th className="px-3 py-2 text-left font-semibold">Cheque date</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">State</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && !rows.length && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                  No post-dated cheques{state ? ` in state "${STATE_META[state]?.label}"` : ''}.
                </td></tr>
              )}
              {!loading && rows.map((r) => {
                const a = r.actions || {};
                const meta = STATE_META[r.state] || {};
                const overdue = ['registered', 'deposited'].includes(r.state)
                  && String(r.paymentDate).slice(0, 10) < today();
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-mono text-slate-800">{r.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {r.chequeRef ? `Cheque ${r.chequeRef}` : 'No cheque number'}
                        {r.paymentType === 'outbound' ? ' · issued' : ' · received'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[170px] truncate">
                      {r.partner ? (r.partner.companyName || r.partner.name) : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="truncate max-w-[150px]">{r.bankName || '-'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Landmark size={9} />{r.journal?.code || r.journal?.name || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                        {String(r.paymentDate).slice(0, 10)}
                      </span>
                      {r.clearingDate && (
                        <div className="text-[10px] text-emerald-600">
                          cleared {String(r.clearingDate).slice(0, 10)}
                        </div>
                      )}
                      {overdue && <div className="text-[10px] text-red-500">past due</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(r.amount, r.currency)}
                      {Number(r.bounceCharge) > 0 && (
                        <div className="text-[10px] text-red-500">
                          +{money(r.bounceCharge, r.currency)} charge
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.className}`}
                        title={meta.hint}
                      >
                        {meta.label || r.state}
                      </span>
                      {r.bounceReason && (
                        <div className="text-[10px] text-red-500 mt-0.5 max-w-[130px] truncate" title={r.bounceReason}>
                          {r.bounceReason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {a.deposit && (
                        <button
                          type="button"
                          onClick={() => deposit(r)}
                          disabled={busy}
                          title="Bank this cheque"
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 mr-1"
                        >
                          Deposit
                        </button>
                      )}
                      {a.markCleared && (
                        <button
                          type="button"
                          onClick={() => clear(r)}
                          disabled={busy}
                          title="The bank cleared it — posts a payment"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 mr-1"
                        >
                          <CheckCircle2 size={11} /> Cleared
                        </button>
                      )}
                      {a.markBounced && (
                        <button
                          type="button"
                          onClick={() => bounce(r)}
                          disabled={busy}
                          title="The bank dishonoured it"
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                      {a.markReturned && (
                        <button
                          type="button"
                          onClick={() => markReturned(r)}
                          disabled={busy}
                          title="Hand the cheque back to the drawer"
                          className="p-1 text-slate-400 hover:text-amber-600 disabled:opacity-30"
                        >
                          <Undo2 size={13} />
                        </button>
                      )}
                      {a.reopen && (
                        <button
                          type="button"
                          onClick={() => reopen(r)}
                          disabled={busy}
                          title="Put it back in play, e.g. on re-presentation"
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        disabled={r.state === 'done'}
                        title={r.state === 'done'
                          ? 'A cleared cheque is posted and cannot be edited'
                          : 'Edit this cheque'}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        disabled={busy || r.state !== 'registered'}
                        title={r.state === 'registered'
                          ? 'Delete this cheque'
                          : 'Only a held cheque can be deleted — mark it returned instead'}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
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
      )}
    </div>
  );
};

const input = 'w-full px-2 py-1.5 border border-slate-300 rounded text-xs';

const Field = ({ label, hint, wide, children }) => (
  <div className={wide ? 'md:col-span-2' : ''}>
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

export default PdcPayments;
