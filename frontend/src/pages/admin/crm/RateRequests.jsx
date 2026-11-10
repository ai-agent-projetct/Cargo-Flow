import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Search, RefreshCw, Download, X, Award, Repeat, Check, Ban, Link2,
  Copy, ChevronDown, ChevronUp, AlertTriangle, Plus, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  rateRequestsAPI, quotationsAPI, organizationsAPI, chargeLinesAPI,
} from '../../../services/api';
import { exportCsv } from '../../../utils/exportCsv';

// Sales & CRM > Sales > Rate Requests.
//
// The buy side of pricing. Sales raises a request from a quotation, it goes to
// one or more vendors, each vendor fills in their rates through the portal,
// the options are compared side by side and one is awarded. Awarding copies
// the vendor's figures onto the quotation's charge lines as the buy rates, so
// a vendor's number becomes our cost in one step.

const STATUS_STYLES = {
  pending: 'bg-slate-100 text-slate-600',
  submitted: 'bg-emerald-100 text-emerald-700',
  renegotiate_pending: 'bg-amber-100 text-amber-700',
  renegotiate_submitted: 'bg-blue-100 text-blue-700',
  renegotiate_rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  pending: 'Awaiting rates',
  submitted: 'Rates in',
  renegotiate_pending: 'Renegotiating',
  renegotiate_submitted: 'Revised rates in',
  renegotiate_rejected: 'Renegotiation rejected',
};

const money = (v, cur = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
};

const unwrap = (res) => {
  const d = res.data?.data;
  if (Array.isArray(d)) return d;
  return d?.rows || d?.quotations || d?.organizations || [];
};

const RateRequests = () => {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const [quotationId, setQuotationId] = useState(params.get('quotationId') || '');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [compare, setCompare] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = { limit: 50 };
      if (search) q.search = search;
      if (status) q.vendorRateStatus = status;
      if (quotationId) q.quotationId = quotationId;
      const res = await rateRequestsAPI.getAll(q);
      setRows(res.data?.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(err.response.data?.message || 'You do not have access to rate requests');
      } else {
        toast.error(err.response?.data?.message || 'Could not load the rate requests');
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, quotationId]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const next = {};
    if (status) next.status = status;
    if (quotationId) next.quotationId = quotationId;
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, quotationId]);

  const open = async (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    try {
      const res = await rateRequestsAPI.getById(id);
      setDetail(res.data?.data || null);
      setOpenId(id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open the rate request');
    }
  };

  const act = async (fn, successMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res?.data?.message || successMsg);
      await load();
      if (openId) {
        const fresh = await rateRequestsAPI.getById(openId);
        setDetail(fresh.data?.data || null);
      }
      if (compare) await openCompare(compare.quotationId);
      return res;
    } catch (err) {
      toast.error(err.response?.data?.message || 'That did not work');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const send = (r) => act(() => rateRequestsAPI.send(r.id), 'Sent to the vendor').then((res) => {
    const url = res?.data?.data?.portalUrl;
    if (url) {
      navigator.clipboard?.writeText(url).then(
        () => toast.success('Vendor link copied to the clipboard'),
        () => toast(`Vendor link: ${url}`, { duration: 8000 }),
      );
    }
  });

  const award = async (r) => {
    const marginRaw = window.prompt(
      `Award ${r.requestNumber} and copy these rates onto the quotation as buy rates.\n\n`
      + 'What margin should the sell rates be derived at? Enter a percentage, '
      + 'or leave blank to keep the existing sell rates.',
      '20',
    );
    if (marginRaw === null) return;
    const keepSellRate = marginRaw.trim() === '';
    await act(
      () => rateRequestsAPI.select(r.id, keepSellRate
        ? { keepSellRate: true }
        : { marginType: 'percentage', marginValue: Number(marginRaw) || 0 }),
      'Rates awarded and applied to the quotation',
    );
  };

  const renegotiate = async (r) => {
    const note = window.prompt(
      `Ask ${r.agent ? (r.agent.companyName || r.agent.name) : 'the vendor'} to revise `
      + `${r.requestNumber}.\n\nWhat needs to change? The vendor sees this message.`,
    );
    if (!note) return;
    await act(() => rateRequestsAPI.renegotiate(r.id, { note }), 'Renegotiation requested');
  };

  const copyLink = (r) => {
    if (!r.accessToken) {
      toast.error('Send the request first — the vendor link is created on send.');
      return;
    }
    const url = `${window.location.origin}/vendor/rate-request/${r.accessToken}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Vendor link copied'),
      () => toast(url, { duration: 8000 }),
    );
  };

  const openCompare = async (qid) => {
    if (!qid) { toast.error('Filter by a quotation first, or open one from the list'); return; }
    try {
      const res = await rateRequestsAPI.compare(qid);
      setCompare(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not build the comparison');
    }
  };

  const exportSpec = [
    { label: 'Request', key: 'requestNumber' },
    { label: 'Option', key: 'quoteOptionName' },
    { label: 'Vendor', key: (r) => (r.agent ? (r.agent.companyName || r.agent.name) : '') },
    { label: 'Quotation', key: (r) => r.quotation?.quoteNumber || '' },
    { label: 'Requested', key: 'requestDate' },
    { label: 'Valid to', key: 'validityDate' },
    { label: 'Status', key: 'vendorRateStatus' },
    { label: 'Awarded', key: (r) => (r.isRateSelected ? 'Yes' : 'No') },
    { label: 'Transit days', key: 'transitDays' },
    { label: 'Total', key: 'rateTotal' },
    { label: 'Currency', key: 'currency' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Rate Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Buy rates from vendors and agents. Awarding a vendor copies their
            figures onto the quotation&rsquo;s charge lines as the cost side.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Request no., option, email…"
              className="pl-8 pr-3 py-1.5 w-56 border border-slate-300 rounded text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`px-2 py-1.5 border rounded text-xs ${
              status ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-300 text-slate-600'}`}
          >
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
            onClick={() => exportCsv(rows, exportSpec, 'rate-requests')
              ? toast.success(`Exported ${rows.length} requests`)
              : toast.error('Nothing to export')}
            disabled={!rows.length}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={13} /> Export
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus size={13} /> Request rates
          </button>
        </div>
      </div>

      {creating && (
        <NewRequest
          onClose={() => setCreating(false)}
          onCreated={async (qid) => { setCreating(false); setQuotationId(qid); await load(); }}
        />
      )}

      {compare && (
        <Comparison
          data={compare}
          onClose={() => setCompare(null)}
          onAward={(id) => award({ id, requestNumber: id })}
          busy={busy}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Request</th>
              <th className="px-3 py-2 text-left font-semibold">Vendor</th>
              <th className="px-3 py-2 text-left font-semibold">Quotation</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Transit</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-left font-semibold">Valid to</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
            )}
            {!loading && !rows.length && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                No rate requests. Use &ldquo;Request rates&rdquo; against a quotation to ask vendors to price it.
              </td></tr>
            )}
            {!loading && rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr className={`hover:bg-slate-50 ${r.isRateSelected ? 'bg-emerald-50/40' : ''}`}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => open(r.id)}
                      className="font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {r.requestNumber}
                      {openId === r.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    <div className="text-[10px] text-slate-400">{r.requestDate}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700 max-w-[170px]">
                    <div className="truncate font-medium">
                      {r.agent ? (r.agent.companyName || r.agent.name) : '-'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{r.quoteOptionName}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.quotation ? (
                      <button
                        type="button"
                        onClick={() => setQuotationId(r.quotationId)}
                        title="Filter to this quotation's requests"
                        className="font-mono text-slate-600 hover:text-blue-600 hover:underline"
                      >
                        {r.quotation.quoteNumber}
                      </button>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      STATUS_STYLES[r.vendorRateStatus] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {STATUS_LABELS[r.vendorRateStatus] || r.vendorRateStatus}
                    </span>
                    {r.isRateSelected && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white">
                        Awarded
                      </span>
                    )}
                    {r.status === 'draft' && (
                      <span className="ml-1 text-[10px] text-slate-400">not sent</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {r.transitDays ? `${r.transitDays}d` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {Number(r.rateTotal) ? money(r.rateTotal, r.currency) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.validityDate || '-'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {r.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => send(r)}
                        disabled={busy}
                        title="Send this request and create the vendor link"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 mr-1"
                      >
                        <Send size={11} /> Send
                      </button>
                    )}
                    {r.vendorRateStatus === 'submitted' && !r.isRateSelected && (
                      <>
                        <button
                          type="button"
                          onClick={() => award(r)}
                          disabled={busy}
                          title="Award this vendor and copy their rates onto the quotation"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 mr-1"
                        >
                          <Award size={11} /> Award
                        </button>
                        <button
                          type="button"
                          onClick={() => renegotiate(r)}
                          disabled={busy}
                          title="Ask the vendor to revise their rates"
                          className="p-1 text-slate-400 hover:text-amber-600 disabled:opacity-30"
                        >
                          <Repeat size={13} />
                        </button>
                      </>
                    )}
                    {r.vendorRateStatus === 'renegotiate_submitted' && (
                      <>
                        <button
                          type="button"
                          onClick={() => act(() => rateRequestsAPI.resolveRenegotiation(r.id, true), 'Revised rates accepted')}
                          disabled={busy}
                          title="Accept the revised rates"
                          className="p-1 text-slate-400 hover:text-emerald-600 disabled:opacity-30"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => act(() => rateRequestsAPI.resolveRenegotiation(r.id, false), 'Revised rates rejected')}
                          disabled={busy}
                          title="Reject the revised rates"
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Ban size={13} />
                        </button>
                      </>
                    )}
                    {r.isRateSelected && (
                      <button
                        type="button"
                        onClick={() => act(() => rateRequestsAPI.unselect(r.id), 'Award withdrawn')}
                        disabled={busy}
                        title="Withdraw the award. The buy rates already on the quotation stay."
                        className="px-2 py-1 text-[11px] font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 mr-1"
                      >
                        Unaward
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyLink(r)}
                      title="Copy the vendor's link"
                      className="p-1 text-slate-400 hover:text-blue-600"
                    >
                      <Link2 size={13} />
                    </button>
                    {r.quotationId && (
                      <button
                        type="button"
                        onClick={() => openCompare(r.quotationId)}
                        title="Compare every vendor quoting this quotation"
                        className="p-1 text-slate-400 hover:text-indigo-600"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </td>
                </tr>

                {openId === r.id && detail && (
                  <tr>
                    <td colSpan={8} className="px-3 py-3 bg-slate-50">
                      <RequestLines
                        detail={detail}
                        busy={busy}
                        onSubmitRates={(lines) => act(
                          () => rateRequestsAPI.submitRates(detail.id, { lines, rateReceivedBy: 'email', source: 'manual' }),
                          'Rates recorded',
                        )}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {quotationId && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Filtered to one quotation.</span>
          <button type="button" onClick={() => openCompare(quotationId)} className="text-blue-600 hover:underline">
            Compare vendors
          </button>
          <button type="button" onClick={() => setQuotationId('')} className="text-slate-500 hover:underline">
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

// The charge lines a vendor was asked to price, with a form for staff to key
// in rates that arrived by email rather than through the portal.
const RequestLines = ({ detail, busy, onSubmitRates }) => {
  const [edits, setEdits] = useState({});
  const canKeyIn = detail.actions?.submitRates;

  const setRate = (id, field) => (e) => {
    setEdits((d) => ({ ...d, [id]: { ...(d[id] || {}), [field]: e.target.value } }));
  };

  const submit = () => {
    const lines = (detail.lines || [])
      .map((l) => ({
        id: l.id,
        buyRate: edits[l.id]?.buyRate ?? l.buyRate,
        minAmount: edits[l.id]?.minAmount ?? l.minAmount,
      }))
      .filter((l) => Number(l.buyRate) > 0);
    if (!lines.length) {
      toast.error('Enter at least one rate before recording them');
      return;
    }
    onSubmitRates(lines);
    setEdits({});
  };

  return (
    <div>
      {detail.renegotiateNote && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-1.5">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span><strong>Renegotiation note:</strong> {detail.renegotiateNote}</span>
        </div>
      )}
      <table className="w-full text-[11px] bg-white border border-slate-200 rounded">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">Charge</th>
            <th className="px-2 py-1.5 text-left font-semibold">Basis</th>
            <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
            <th className="px-2 py-1.5 text-left font-semibold">Cur.</th>
            <th className="px-2 py-1.5 text-right font-semibold">Buy rate</th>
            <th className="px-2 py-1.5 text-right font-semibold">Minimum</th>
            <th className="px-2 py-1.5 text-right font-semibold">Line total</th>
            <th className="px-2 py-1.5 text-right font-semibold">Counter</th>
            <th className="px-2 py-1.5 text-left font-semibold">Check</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(detail.lines || []).map((l) => (
            <tr key={l.id}>
              <td className="px-2 py-1.5 text-slate-800">
                {l.chargeCode && <span className="font-mono text-slate-400 mr-1">{l.chargeCode}</span>}
                {l.chargeDescription}
              </td>
              <td className="px-2 py-1.5 text-slate-600">{l.measurementBasis || '-'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{Number(l.quantity).toLocaleString()}</td>
              <td className="px-2 py-1.5 text-slate-500">{l.currency}</td>
              <td className="px-2 py-1.5 text-right">
                {canKeyIn ? (
                  <input
                    type="number"
                    step="0.0001"
                    value={edits[l.id]?.buyRate ?? l.buyRate ?? ''}
                    onChange={setRate(l.id, 'buyRate')}
                    className="w-24 px-1.5 py-1 border border-slate-300 rounded text-right text-[11px]"
                  />
                ) : <span className="tabular-nums">{Number(l.buyRate || 0).toLocaleString()}</span>}
              </td>
              <td className="px-2 py-1.5 text-right">
                {canKeyIn ? (
                  <input
                    type="number"
                    step="0.01"
                    value={edits[l.id]?.minAmount ?? l.minAmount ?? ''}
                    onChange={setRate(l.id, 'minAmount')}
                    className="w-20 px-1.5 py-1 border border-slate-300 rounded text-right text-[11px]"
                  />
                ) : <span className="tabular-nums">{Number(l.minAmount || 0).toLocaleString()}</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                {money(l.lineTotal, detail.currency)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">
                {l.counterRate != null ? Number(l.counterRate).toLocaleString() : '-'}
              </td>
              <td className="px-2 py-1.5">
                {l.checkStatus === 'high' && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-700"
                    title="Above the last known rate for this lane and charge"
                  >
                    High
                  </span>
                )}
                {l.checkStatus === 'low' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-100 text-sky-700">
                    Low
                  </span>
                )}
                {l.checkStatus === 'ok' && <span className="text-emerald-600">OK</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold">
          <tr>
            <td colSpan={6} className="px-2 py-1.5 text-right">Total</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{money(detail.rateTotal, detail.currency)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      {canKeyIn && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-slate-400">
            Use this only for rates that arrived by email. A vendor filling in the
            portal writes straight here.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Save size={13} /> Record these rates
          </button>
        </div>
      )}
    </div>
  );
};

// Vendors side by side, charge by charge: the screen that decides the award.
const Comparison = ({ data, onClose, onAward, busy }) => (
  <div className="bg-white border-2 border-indigo-300 rounded-lg p-4">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">
          Vendor comparison · {data.quoteNumber}
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {data.options.length} option(s).
          {data.cheapest && ' Cheapest and fastest are marked.'}
        </p>
      </div>
      <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700">
        <X size={14} />
      </button>
    </div>

    {!data.options.length ? (
      <p className="text-xs text-slate-400">No requests on this quotation yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-slate-50">Charge</th>
              {data.options.map((o) => (
                <th key={o.id} className="px-2 py-2 text-right font-semibold min-w-[120px]">
                  <div className="truncate max-w-[140px]">{o.vendor || o.optionName}</div>
                  <div className="font-normal text-[9px] text-slate-400">{o.requestNumber}</div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {data.cheapest?.id === o.id && (
                      <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] font-bold">
                        CHEAPEST
                      </span>
                    )}
                    {data.fastest?.id === o.id && (
                      <span className="px-1 py-0.5 rounded bg-sky-100 text-sky-700 text-[8px] font-bold">
                        FASTEST
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.charges.map((c) => {
              // The cheapest quote for this one charge, so the row shows where
              // each vendor is strong rather than only the grand total.
              const values = data.options
                .map((o) => o.charges[c.key]?.lineTotal)
                .filter((v) => Number(v) > 0);
              const best = values.length ? Math.min(...values) : null;
              return (
                <tr key={c.key}>
                  <td className="px-2 py-1.5 text-slate-700 sticky left-0 bg-white">{c.description}</td>
                  {data.options.map((o) => {
                    const cell = o.charges[c.key];
                    const isBest = cell && best != null && Number(cell.lineTotal) === best;
                    return (
                      <td
                        key={o.id}
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          isBest ? 'text-emerald-700 font-semibold' : 'text-slate-600'}`}
                      >
                        {cell && Number(cell.lineTotal)
                          ? Number(cell.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : <span className="text-slate-300">-</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-2 py-2 text-right sticky left-0 bg-slate-50">Total</td>
              {data.options.map((o) => (
                <td key={o.id} className="px-2 py-2 text-right tabular-nums">
                  {Number(o.rateTotal) ? money(o.rateTotal, o.currency) : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-2 py-2 text-right text-slate-500 sticky left-0 bg-white">Transit</td>
              {data.options.map((o) => (
                <td key={o.id} className="px-2 py-2 text-right text-slate-600">
                  {o.transitDays ? `${o.transitDays} days` : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-2 py-2 sticky left-0 bg-white" />
              {data.options.map((o) => (
                <td key={o.id} className="px-2 py-2 text-right">
                  {o.isRateSelected ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold">
                      AWARDED
                    </span>
                  ) : o.actions?.selectRates ? (
                    <button
                      type="button"
                      onClick={() => onAward(o.id)}
                      disabled={busy}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Award
                    </button>
                  ) : (
                    <span className="text-[9px] text-slate-400">
                      {STATUS_LABELS[o.vendorRateStatus] || o.vendorRateStatus}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    )}
  </div>
);

// Raising requests: pick a quotation, pick the vendors, one request each.
const NewRequest = ({ onClose, onCreated }) => {
  const [quotes, setQuotes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [quotationId, setQuotationId] = useState('');
  const [agentIds, setAgentIds] = useState([]);
  const [validityDate, setValidityDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [chargeCount, setChargeCount] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [q, v] = await Promise.all([
          quotationsAPI.getAll({ limit: 100 }),
          organizationsAPI.getAll({ limit: 'all' }),
        ]);
        setQuotes(unwrap(q));
        setVendors(unwrap(v));
      } catch {
        toast.error('Could not load the quotations and vendors');
      }
    })();
  }, []);

  // Show how many charges the vendors will be asked to price, so an empty
  // quotation is obvious before the request goes out.
  useEffect(() => {
    if (!quotationId) { setChargeCount(null); return; }
    (async () => {
      try {
        const res = await chargeLinesAPI.getAll({ parentType: 'quote', parentId: quotationId, limit: 'all' });
        setChargeCount((res.data?.data?.lines || []).length);
      } catch { setChargeCount(null); }
    })();
  }, [quotationId]);

  const toggle = (id) => setAgentIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const create = async () => {
    if (!quotationId) { toast.error('Choose the quotation to be priced'); return; }
    if (!agentIds.length) { toast.error('Choose at least one vendor'); return; }
    setBusy(true);
    try {
      const res = await rateRequestsAPI.create({
        quotationId, agentIds, validityDate: validityDate || null, remarks,
      });
      toast.success(res.data?.message || 'Rate requests raised');
      onCreated(quotationId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not raise the requests');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Request rates from vendors</h2>
        <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Quotation to price
          </label>
          <select
            value={quotationId}
            onChange={(e) => setQuotationId(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          >
            <option value="">Choose a quotation</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quoteNumber} · {q.transportMode} · {q.originCountry || '?'} to {q.destinationCountry || '?'}
              </option>
            ))}
          </select>
          {chargeCount !== null && (
            <p className={`mt-1 text-[10px] ${chargeCount ? 'text-slate-400' : 'text-red-600'}`}>
              {chargeCount
                ? `${chargeCount} charge line(s) will be sent for pricing.`
                : 'This quotation has no charge lines yet. Add them before requesting rates.'}
            </p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Rates valid until
          </label>
          <input
            type="date"
            value={validityDate}
            onChange={(e) => setValidityDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Vendors ({agentIds.length} selected) — one request each, so they can be compared
        </label>
        <div className="max-h-44 overflow-y-auto border border-slate-200 rounded p-2 grid grid-cols-1 md:grid-cols-3 gap-1">
          {vendors.map((v) => (
            <label key={v.id} className="flex items-center gap-2 px-1.5 py-1 text-xs hover:bg-slate-50 rounded">
              <input type="checkbox" checked={agentIds.includes(v.id)} onChange={() => toggle(v.id)} />
              <span className="truncate text-slate-700">{v.companyName || v.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Note to the vendors
        </label>
        <input
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Rates required by Friday. Please confirm space and transit time."
          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
        />
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={create}
          disabled={busy || !chargeCount}
          title={!chargeCount ? 'The quotation needs charge lines first' : 'Raise one request per vendor'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Plus size={13} /> {busy ? 'Raising…' : `Raise ${agentIds.length || ''} request(s)`}
        </button>
      </div>
    </div>
  );
};

export default RateRequests;
