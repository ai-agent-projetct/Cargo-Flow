import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Ship, Send, AlertTriangle, CheckCircle2, XCircle, Clock, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorPortalAPI } from '../services/api';

// The vendor portal: a page a vendor opens from an emailed link to quote buy
// rates, with no ERP login.
//
// The token in the URL is the credential and grants access to exactly one
// request. The payload the server returns is deliberately narrow — the cargo
// and the charges they were asked to price, and nothing about our sell rates,
// our margin or who the customer is.

const money = (v, cur = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
};

const VendorRatePortal = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState({});
  const [transitDays, setTransitDays] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorPortalAPI.get(token);
      const d = res.data?.data;
      setData(d);
      setTransitDays(d?.transitDays ?? '');
      setValidityDate(d?.validityDate ?? '');
      setRemarks(d?.remarks ?? '');
      const seeded = {};
      for (const l of d?.lines || []) {
        seeded[l.id] = { buyRate: l.buyRate || '', minAmount: l.minAmount || '' };
      }
      setRates(seeded);
    } catch (err) {
      // 404 / 410 here are expected states (bad or expired link), not faults,
      // so they are shown as a page rather than a toast.
      setError(err.response?.data?.message || 'This rate request link could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setRate = (id, field) => (e) => {
    setRates((r) => ({ ...r, [id]: { ...(r[id] || {}), [field]: e.target.value } }));
  };

  const lineTotal = (l) => {
    const rate = Number(rates[l.id]?.buyRate) || 0;
    const min = Number(rates[l.id]?.minAmount) || 0;
    const qty = Number(l.quantity) || 1;
    return Math.max(rate * qty, min);
  };

  const grandTotal = (data?.lines || []).reduce((s, l) => s + lineTotal(l), 0);
  const pricedCount = (data?.lines || []).filter((l) => Number(rates[l.id]?.buyRate) > 0).length;

  const submit = async () => {
    if (!pricedCount) {
      toast.error('Enter your rate against at least one charge before submitting');
      return;
    }
    const ok = window.confirm(
      `Submit your rates for ${data.requestNumber}?\n\n`
      + `${pricedCount} of ${data.lines.length} charge(s) priced\n`
      + `Total ${money(grandTotal, data.currency)}\n`
      + `${transitDays ? `Transit ${transitDays} day(s)\n` : ''}`
      + '\nYou will not be able to change them afterwards without being asked to revise.',
    );
    if (!ok) return;

    setBusy(true);
    try {
      const lines = (data.lines || []).map((l) => ({
        id: l.id,
        buyRate: Number(rates[l.id]?.buyRate) || 0,
        minAmount: Number(rates[l.id]?.minAmount) || 0,
      }));
      const res = await vendorPortalAPI.submit(token, {
        lines,
        transitDays: transitDays === '' ? null : Number(transitDays),
        validityDate: validityDate || null,
        remarks,
      });
      setDone(res.data?.data || { submitted: pricedCount });
      toast.success(res.data?.message || 'Rates submitted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit your rates');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    const reason = window.prompt('Let us know why you are not quoting this enquiry:');
    if (!reason) return;
    setBusy(true);
    try {
      await vendorPortalAPI.decline(token, reason);
      setDone({ declined: true });
      toast.success('Thank you for letting us know');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record that');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <p className="text-center text-slate-500 text-sm py-12">Opening your rate request…</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="text-center py-10">
          <XCircle className="mx-auto mb-3 text-red-400" size={36} />
          <h2 className="text-base font-semibold text-slate-800">Link not available</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{error}</p>
          <p className="mt-3 text-xs text-slate-400">
            Ask your contact to resend the request if you still need to quote it.
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center py-10">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={36} />
          <h2 className="text-base font-semibold text-slate-800">
            {done.declined ? 'Thank you' : 'Rates received'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            {done.declined
              ? 'We have recorded that you are not quoting this enquiry.'
              : `We have your rates for ${data.requestNumber}. Our pricing team will come `
                + 'back to you if anything needs revising.'}
          </p>
          {!done.declined && done.rateTotal != null && (
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Total submitted: {money(done.rateTotal, data.currency)}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  const e = data.enquiry;

  return (
    <Shell>
      {/* What is being asked */}
      <div className="border-b border-slate-200 pb-4 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-800">Rate request</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{data.requestNumber}</p>
            {data.vendor && (
              <p className="text-xs text-slate-600 mt-1">For: <strong>{data.vendor}</strong></p>
            )}
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Requested {data.requestDate}</p>
            {data.validityDate && <p>Rates needed valid to {data.validityDate}</p>}
            <p className="mt-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold">
                {data.canSubmit ? 'Awaiting your rates' : 'Rates already submitted'}
              </span>
            </p>
          </div>
        </div>

        {data.isRenegotiate && data.renegotiateNote && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Please revise your rates.</strong>
              <p className="mt-0.5">{data.renegotiateNote}</p>
            </div>
          </div>
        )}

        {data.remarks && !data.isRenegotiate && (
          <div className="mt-3 px-3 py-2 bg-slate-50 rounded text-xs text-slate-600 flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
            <span>{data.remarks}</span>
          </div>
        )}

        {e && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-xs">
            <Detail label="Mode" value={e.transportMode} />
            <Detail label="From" value={e.originCountry} />
            <Detail label="To" value={e.destinationCountry} />
            <Detail label="Commodity" value={e.commodity} />
            <Detail
              label="Gross weight"
              value={Number(e.grossWeight) ? `${Number(e.grossWeight).toLocaleString()} kg` : null}
            />
            <Detail
              label="Volume"
              value={Number(e.volume) ? `${Number(e.volume).toLocaleString()} m3` : null}
            />
          </div>
        )}
      </div>

      {/* The charges to price */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
        Your rates
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-slate-200 rounded">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Charge</th>
              <th className="px-3 py-2 text-left font-semibold">Basis</th>
              <th className="px-3 py-2 text-right font-semibold">Quantity</th>
              <th className="px-3 py-2 text-left font-semibold">Currency</th>
              <th className="px-3 py-2 text-right font-semibold">Your rate</th>
              <th className="px-3 py-2 text-right font-semibold">Minimum</th>
              <th className="px-3 py-2 text-right font-semibold">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-slate-800">
                  {l.chargeDescription}
                  {l.counterRate != null && (
                    <div className="text-[10px] text-amber-700">
                      Our counter-offer: {Number(l.counterRate).toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{l.measurementBasis || '-'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(l.quantity).toLocaleString()} {l.uom || ''}
                </td>
                <td className="px-3 py-2 text-slate-500">{l.currency}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={rates[l.id]?.buyRate ?? ''}
                    onChange={setRate(l.id, 'buyRate')}
                    disabled={!data.canSubmit || busy}
                    placeholder="0.00"
                    className="w-28 px-2 py-1.5 border border-slate-300 rounded text-right disabled:bg-slate-100"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates[l.id]?.minAmount ?? ''}
                    onChange={setRate(l.id, 'minAmount')}
                    disabled={!data.canSubmit || busy}
                    placeholder="0.00"
                    title="Leave at zero if there is no minimum charge"
                    className="w-24 px-2 py-1.5 border border-slate-300 rounded text-right disabled:bg-slate-100"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {money(lineTotal(l), l.currency || data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td colSpan={6} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {money(grandTotal, data.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Transit and validity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Transit time (days)
          </label>
          <input
            type="number"
            min="0"
            value={transitDays}
            onChange={(ev) => setTransitDays(ev.target.value)}
            disabled={!data.canSubmit || busy}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Your rates valid until
          </label>
          <input
            type="date"
            value={validityDate || ''}
            onChange={(ev) => setValidityDate(ev.target.value)}
            disabled={!data.canSubmit || busy}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Notes for us
          </label>
          <input
            value={remarks}
            onChange={(ev) => setRemarks(ev.target.value)}
            disabled={!data.canSubmit || busy}
            placeholder="Subject to space and equipment availability"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100"
          />
        </div>
      </div>

      {data.canSubmit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-200">
          <p className="text-[11px] text-slate-500">
            {pricedCount} of {data.lines.length} charge(s) priced.
            Leave a charge at zero if it does not apply.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={decline}
              disabled={busy}
              className="px-3 py-2 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Not quoting this one
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !pricedCount}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Send size={13} /> {busy ? 'Submitting…' : 'Submit my rates'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
          <Clock size={14} className="text-slate-400" />
          Your rates are with our pricing team. We will be in touch if anything
          needs revising.
        </div>
      )}
    </Shell>
  );
};

const Shell = ({ children }) => (
  <div className="min-h-screen bg-slate-100 py-8 px-4">
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
          <Ship className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="block font-bold text-base leading-none text-slate-800">CargoFlo</span>
          <p className="text-slate-500 text-xs mt-0.5">Vendor Portal</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        {children}
      </div>
      <p className="text-center text-[10px] text-slate-400 mt-4">
        This link is personal to your company and this enquiry. Please do not forward it.
      </p>
    </div>
  </div>
);

const Detail = ({ label, value }) => (
  <div>
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="text-slate-700">{value || <span className="text-slate-300">-</span>}</dd>
  </div>
);

export default VendorRatePortal;
