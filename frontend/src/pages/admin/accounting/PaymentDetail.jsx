import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';
import { money, CURRENCIES } from './constants';

const PSTATE = {
  draft: 'Draft', posted: 'Posted', sent: 'Sent',
  reconciled: 'Reconciled', cancel: 'Cancelled',
};
// The statusbar walks Draft › Posted › Sent › Reconciled; Cancelled replaces
// the tail once reached.
const STATUSBAR = ['draft', 'posted', 'sent', 'reconciled'];

const METHODS = ['Manual', 'PDC Payment', 'Cheque', 'Bank Transfer', 'Electronic'];

const BLANK = {
  paymentType: 'inbound', state: 'draft', currency: 'AED',
  paymentMethod: 'Manual', invoiceNumbers: [], amount: 0, activityLog: [],
};

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[9rem_1fr] items-start gap-3 py-1">
    <label className="text-sm font-semibold text-gray-700 pt-1">{label}</label>
    <div className="min-w-0">{children}</div>
  </div>
);

const inputCls = 'w-full text-sm px-1 py-0.5 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';

const PaymentDetail = ({ menu = 'payments' }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const isNew = !id || id === 'create';
  const vendor = menu === 'vendor-payments';
  const base = vendor ? '/admin/accounting/vendors/payments' : '/admin/accounting/customers/payments';

  const [rec, setRec] = useState(isNew ? BLANK : null);
  const [draft, setDraft] = useState(isNew ? BLANK : null);
  const [invoices, setInvoices] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setEditing(isNew);
    setInvoices([]);
    if (isNew) {
      const blank = { ...BLANK, paymentType: vendor ? 'outbound' : 'inbound' };
      setRec(blank); setDraft(blank); setLoading(false); return;
    }
    setLoading(true);
    const res = await guard(() => accountingAPI.payment(id));
    if (res) {
      const d = res.data.data;
      setRec(d); setDraft(d); setInvoices(d.invoices || []);
    } else navigate(base);
    setLoading(false);
  }, [id, isNew, vendor, guard, navigate, base]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    accountingAPI.journals({ limit: 100 }).then((r) => setJournals(r.data.data || [])).catch(() => {});
  }, []);

  if (loading || !rec) return <PageLoader />;

  const view = editing ? draft : rec;
  const readOnly = !editing;
  const a = rec.actions || {};
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const run = async (fn, okMsg) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const res = await fn();
      const d = res.data.data;
      setRec(d); setDraft(d); setEditing(false);
      toast.success(okMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally { busyRef.current = false; setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await accountingAPI.createPayment(draft, menu);
        toast.success('Payment created');
        navigate(`${base}/${res.data.data.id}`);
      } else {
        const res = await accountingAPI.updatePayment(id, draft);
        setRec(res.data.data); setDraft(res.data.data); setEditing(false);
        toast.success('Saved');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  const steps = view.state === 'cancel' ? ['draft', 'cancel'] : STATUSBAR;
  const btn = 'px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded disabled:opacity-50';
  const ghost = 'px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50';

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate(base)} className="text-blue-700 hover:underline">Payments</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">{isNew ? 'New' : (rec.name === '/' ? 'Draft Payment' : rec.name)}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <button onClick={save} disabled={busy} className={btn}>Save</button>
              <button onClick={() => { if (isNew) navigate(base); else { setDraft(rec); setEditing(false); } }}
                className={ghost}>Discard</button>
            </>
          ) : (
            <>
              {a.edit && can('account.payment', 'write') && (
                <button onClick={() => setEditing(true)} className={btn}>Edit</button>
              )}
              <button className={`${ghost} flex items-center gap-1.5`}><Printer className="w-4 h-4" /> Print</button>
              <button className={ghost}>⚙ Action</button>
            </>
          )}
        </div>
        <div className="flex items-center">
          {steps.map((s, i) => (
            <span key={s} className={`px-4 py-1.5 text-sm ${
              view.state === s ? 'bg-blue-700 text-white font-medium' : 'bg-white text-gray-500 border-y border-gray-300'
            } ${i === 0 ? 'border-l rounded-l' : ''} ${i === steps.length - 1 ? 'border-r rounded-r' : ''}`}>
              {PSTATE[s]}
            </span>
          ))}
        </div>
      </div>

      {!editing && !isNew && (
        <div className="flex items-center gap-2 mb-3">
          {a.confirm && (
            <button onClick={() => run(() => accountingAPI.confirmPayment(id), 'Payment confirmed')}
              disabled={busy} className={btn}>Confirm</button>
          )}
          {a.cancel && (
            <button onClick={() => run(() => accountingAPI.cancelPayment(id), 'Payment cancelled')}
              disabled={busy} className={ghost}>Cancel</button>
          )}
          {a.resetToDraft && (
            <button onClick={() => run(() => accountingAPI.resetPayment(id), 'Reset to draft')}
              disabled={busy} className={ghost}>Reset to Draft</button>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isNew ? 'New Payment' : (view.name === '/' ? 'Draft' : view.name)}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {vendor ? 'Send Money' : 'Receive Money'} · {money(view.amount, view.currency)}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10">
          <div>
            <Field label={vendor ? 'Vendor' : 'Customer'}>
              <input className={inputCls} disabled={readOnly} value={view.partner || ''}
                onChange={(e) => set({ partner: e.target.value })} placeholder="e.g. A-13: Ashish" />
            </Field>
            <Field label="Amount">
              <div className="flex items-center gap-2">
                <input type="number" step="0.01" className={inputCls} disabled={readOnly}
                  value={view.amount ?? ''} onChange={(e) => set({ amount: e.target.value })} />
                <select className={`${inputCls} w-24`} disabled={readOnly} value={view.currency || 'AED'}
                  onChange={(e) => set({ currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Date">
              <input type="date" className={inputCls} disabled={readOnly}
                value={(view.paymentDate || '').slice(0, 10)}
                onChange={(e) => set({ paymentDate: e.target.value })} />
            </Field>
            <Field label="Memo">
              <input className={inputCls} disabled={readOnly} value={view.memo || ''}
                onChange={(e) => set({ memo: e.target.value })} />
            </Field>
          </div>

          <div>
            <Field label="Journal">
              <select className={inputCls} disabled={readOnly} value={view.journal || ''}
                onChange={(e) => set({ journal: e.target.value })}>
                <option value="" />
                {journals.map((j) => (
                  <option key={j.id} value={j.bankAccNumber || j.name}>
                    {j.bankAccNumber ? `${j.name} (${j.bankAccNumber})` : j.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment Method">
              <select className={inputCls} disabled={readOnly} value={view.paymentMethod || 'Manual'}
                onChange={(e) => set({ paymentMethod: e.target.value })}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Invoice Number">
              <input className={inputCls} disabled={readOnly}
                value={(view.invoiceNumbers || []).join(', ')}
                onChange={(e) => set({ invoiceNumbers: e.target.value })}
                placeholder="INV/2025/00341, INV/2026/00014" />
            </Field>
            <Field label="Company">
              <input className={inputCls} disabled value={view.company || ''} />
            </Field>
          </div>
        </div>

        {/* Settled invoices resolve to real records, so they link through. */}
        {invoices.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-800 mb-2">Settled Invoices</p>
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  {['Number', 'Total', 'Amount Due', 'Status'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/accounting/customers/invoices/${inv.id}`)}>
                    <td className="px-3 py-2 text-xs text-blue-700 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> {inv.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-800">{money(inv.amountTotal)}</td>
                    <td className="px-3 py-2 text-xs text-gray-800">{money(inv.amountResidual)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{inv.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isNew && (
        <div className="mt-4">
          <OrganizationChatter organizationId={rec.id} entries={rec.activityLog || []}
            followerCount={rec.followerCount || 1}
            api={{ addActivity: accountingAPI.addPaymentActivity }}
            onPosted={(e) => setRec((r) => ({ ...r, activityLog: [e, ...(r.activityLog || [])] }))} />
        </div>
      )}
    </div>
  );
};

export default PaymentDetail;
