import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, Plus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';
import { PF_STATE } from './ProFormaList';
import { PRODUCTS, TAXES, CURRENCIES, money, num, recalcLine, totalsFor } from './constants';

// To Approve › Approved › Invoiced, with Cancel replacing the tail.
const STATUSBAR = ['to_approve', 'approved', 'invoiced'];

const BLANK = {
  state: 'to_approve', currency: 'AED', companyCurrency: 'AED',
  lines: [], serviceJobRefs: [], houseShipmentRefs: [], taxes: 0, total: 0, activityLog: [],
};

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[9rem_1fr] items-start gap-3 py-1">
    <label className="text-sm font-semibold text-gray-700 pt-1">{label}</label>
    <div className="min-w-0">{children}</div>
  </div>
);

const inputCls = 'w-full text-sm px-1 py-0.5 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';
const cellCls = 'w-full text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-600';

const ProFormaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const isNew = !id || id === 'create';
  const base = '/admin/accounting/customers/pro-forma';

  const [rec, setRec] = useState(isNew ? BLANK : null);
  const [draft, setDraft] = useState(isNew ? BLANK : null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setEditing(isNew);
    if (isNew) { setRec(BLANK); setDraft(BLANK); setLoading(false); return; }
    setLoading(true);
    const res = await guard(() => accountingAPI.proForma(id));
    if (res) { setRec(res.data.data); setDraft(res.data.data); }
    else navigate(base);
    setLoading(false);
  }, [id, isNew, guard, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading || !rec) return <PageLoader />;

  const view = editing ? draft : rec;
  const readOnly = !editing;
  const a = rec.actions || {};
  const lines = view.lines || [];
  const totals = totalsFor(lines);
  const cur = view.currency || 'AED';

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (i, key, value) =>
    set({ lines: lines.map((l, x) => (x === i ? recalcLine({ ...l, [key]: value }) : l)) });
  const addRow = () => set({
    lines: [...lines, recalcLine({
      product: PRODUCTS[0], label: PRODUCTS[0].replace(/^\[\w+\]\s*/, ''),
      houseShipment: (view.houseShipmentRefs || [])[0] || '',
      quantity: 1, price: 0, taxes: 'VAT 0%',
    })],
  });
  const removeRow = (i) => set({ lines: lines.filter((_, x) => x !== i) });

  const run = async (fn, okMsg) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const res = await fn();
      const d = res.data.data;
      setRec(d); setDraft(d); setEditing(false);
      toast.success(okMsg);
      // Creating the invoice hands back the real account.move — go look at it.
      if (res.data.data?.invoice) navigate(`/admin/accounting/customers/invoices/${res.data.data.invoice.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally { busyRef.current = false; setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await accountingAPI.createProForma(draft);
        toast.success('Pro forma created');
        navigate(`${base}/${res.data.data.id}`);
      } else {
        const res = await accountingAPI.updateProForma(id, draft);
        setRec(res.data.data); setDraft(res.data.data); setEditing(false);
        toast.success('Saved');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  const steps = view.state === 'cancel' ? ['to_approve', 'cancel'] : STATUSBAR;
  const btn = 'px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded disabled:opacity-50';
  const ghost = 'px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50';

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate(base)} className="text-blue-700 hover:underline">Pro Forma Invoice</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">{isNew ? 'New' : rec.name}</span>
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
              {a.edit && can('pro.forma.invoice', 'write') && (
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
              {PF_STATE[s]}
            </span>
          ))}
        </div>
      </div>

      {!editing && !isNew && (
        <div className="flex items-center gap-2 mb-3">
          {a.approve && (
            <button onClick={() => run(() => accountingAPI.approveProForma(id), 'Pro forma approved')}
              disabled={busy} className={btn}>Approve</button>
          )}
          {a.createInvoice && (
            <button onClick={() => run(() => accountingAPI.proFormaCreateInvoice(id), 'Invoice created')}
              disabled={busy} className={btn}>Create Invoice</button>
          )}
          {a.cancel && (
            <button onClick={() => run(() => accountingAPI.cancelProForma(id), 'Pro forma cancelled')}
              disabled={busy} className={ghost}>Cancel</button>
          )}
          {a.resetToDraft && (
            <button onClick={() => run(() => accountingAPI.resetProForma(id), 'Reset')}
              disabled={busy} className={ghost}>Reset to Draft</button>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {/* The invoice this pro forma became. */}
        {a.openInvoice && (
          <div className="flex justify-end mb-4">
            <button onClick={() => navigate(`/admin/accounting/customers/invoices/${rec.invoiceId}`)}
              className="px-4 py-2 border border-gray-200 rounded text-sm text-left hover:bg-gray-50">
              <span className="flex items-center gap-1 text-blue-700"><ExternalLink className="w-3.5 h-3.5" /> Invoice</span>
              <span className="text-gray-600 text-xs">{rec.invoiceName || 'View'}</span>
            </button>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">{isNew ? 'New' : view.name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10">
          <div>
            <Field label="Customer">
              <input className={inputCls} disabled={readOnly} value={view.customer || ''}
                onChange={(e) => set({ customer: e.target.value })} />
            </Field>
            <Field label="House Shipment">
              <input className={inputCls} disabled={readOnly}
                value={(view.houseShipmentRefs || []).join(', ')}
                onChange={(e) => set({ houseShipmentRefs: e.target.value })} />
            </Field>
            <Field label="Service Jobs">
              <input className={inputCls} disabled={readOnly}
                value={(view.serviceJobRefs || []).join(', ')}
                onChange={(e) => set({ serviceJobRefs: e.target.value })} />
            </Field>
          </div>
          <div>
            <Field label="Currency">
              <select className={inputCls} disabled={readOnly} value={cur}
                onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Company Currency">
              <input className={inputCls} disabled value={view.companyCurrency || 'AED'} />
            </Field>
            <Field label="Company">
              <input className={inputCls} disabled value={view.company || ''} />
            </Field>
          </div>
        </div>

        {/* Charge lines */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <p className="text-sm font-semibold text-gray-800 mb-2">Invoice Lines</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200">
                <tr>
                  {['House Shipment', 'Product', 'Label', 'Quantity', 'Price', 'Taxes', 'VAT Amount', 'Subtotal'].map((h) => (
                    <th key={h} className="text-left px-1 py-1.5 font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                  ))}
                  {editing && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-gray-400">No lines</td></tr>
                ) : lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-1 py-1 text-gray-700">{l.houseShipment}</td>
                    <td className="px-1 py-1">
                      {editing ? (
                        <select className={cellCls} value={l.product || ''} onChange={(e) => setLine(i, 'product', e.target.value)}>
                          {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      ) : l.product}
                    </td>
                    <td className="px-1 py-1">
                      {editing ? (
                        <input className={cellCls} value={l.label || ''} onChange={(e) => setLine(i, 'label', e.target.value)} />
                      ) : l.label}
                    </td>
                    <td className="px-1 py-1">
                      {editing ? (
                        <input type="number" step="0.01" className={cellCls} value={l.quantity ?? ''}
                          onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                      ) : num(l.quantity)}
                    </td>
                    <td className="px-1 py-1">
                      {editing ? (
                        <input type="number" step="0.01" className={cellCls} value={l.price ?? ''}
                          onChange={(e) => setLine(i, 'price', e.target.value)} />
                      ) : num(l.price)}
                    </td>
                    <td className="px-1 py-1">
                      {editing ? (
                        <select className={cellCls} value={l.taxes || 'VAT 0%'} onChange={(e) => setLine(i, 'taxes', e.target.value)}>
                          {TAXES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      ) : l.taxes}
                    </td>
                    <td className="px-1 py-1 text-right">{num(l.vatAmount)}</td>
                    <td className="px-1 py-1 text-right font-medium">{num(l.subtotal)}</td>
                    {editing && (
                      <td className="px-1 py-1">
                        <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editing && (
            <button onClick={addRow} className="mt-2 flex items-center gap-1 text-xs text-blue-700 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add a line
            </button>
          )}

          <div className="flex justify-end mt-4">
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1 text-gray-700">
                <span>Untaxed Amount:</span><span>{money(editing ? totals.untaxed : Number(view.total) - Number(view.taxes), cur)}</span>
              </div>
              <div className="flex justify-between py-1 text-gray-700">
                <span>Taxes:</span><span>{money(editing ? totals.tax : view.taxes, cur)}</span>
              </div>
              <div className="flex justify-between py-1 font-semibold text-gray-900 border-t border-gray-200 mt-1 pt-1">
                <span>Total:</span><span>{money(editing ? totals.total : view.total, cur)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isNew && (
        <div className="mt-4">
          <OrganizationChatter organizationId={rec.id} entries={rec.activityLog || []}
            followerCount={rec.followerCount || 1}
            api={{ addActivity: accountingAPI.addProFormaActivity }}
            onPosted={(e) => setRec((r) => ({ ...r, activityLog: [e, ...(r.activityLog || [])] }))} />
        </div>
      )}
    </div>
  );
};

export default ProFormaDetail;
