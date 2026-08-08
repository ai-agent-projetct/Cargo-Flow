import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import { TAXES, ACCOUNTS } from './constants';

const BLANK = {
  name: '', internalReference: '', salesPrice: 1, cost: 0,
  customerTaxes: [], vendorTaxes: [], canBeSold: true, canBePurchased: true,
  category: 'Services', uom: 'Units', active: true,
};

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[10rem_1fr] items-start gap-3 py-1">
    <label className="text-sm font-semibold text-gray-700 pt-1">{label}</label>
    <div className="min-w-0">{children}</div>
  </div>
);

const inputCls = 'w-full text-sm px-1 py-0.5 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';

// Taxes are a multi-select chip list, so a checkbox group matches the demo
// better than a single-value <select>.
const TaxPicker = ({ value = [], onChange, disabled }) => (
  <div className="flex flex-wrap gap-2">
    {TAXES.map((t) => {
      const on = value.includes(t);
      return (
        <button key={t} type="button" disabled={disabled}
          onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
          className={`px-2 py-0.5 rounded-full text-[11px] border ${
            on ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-gray-300 text-gray-600'
          } ${disabled ? 'cursor-default' : 'hover:border-blue-400'}`}>
          {t}
        </button>
      );
    })}
  </div>
);

const ProductDetail = ({ menu = 'products' }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const isNew = !id || id === 'create';
  const vendor = menu === 'vendor-products';
  const base = vendor ? '/admin/accounting/vendors/products' : '/admin/accounting/customers/products';

  const [rec, setRec] = useState(isNew ? BLANK : null);
  const [draft, setDraft] = useState(isNew ? BLANK : null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setEditing(isNew);
    if (isNew) { setRec(BLANK); setDraft(BLANK); setLoading(false); return; }
    setLoading(true);
    const res = await guard(() => accountingAPI.product(id));
    if (res) { setRec(res.data.data); setDraft(res.data.data); }
    else navigate(base);
    setLoading(false);
  }, [id, isNew, guard, navigate, base]);

  useEffect(() => { load(); }, [load]);

  if (loading || !rec) return <PageLoader />;

  const view = editing ? draft : rec;
  const readOnly = !editing;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await accountingAPI.createProduct(draft);
        toast.success('Product created');
        navigate(`${base}/${res.data.data.id}`);
      } else {
        const res = await accountingAPI.updateProduct(id, draft);
        setRec(res.data.data); setDraft(res.data.data); setEditing(false);
        toast.success('Saved');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  const archive = async () => {
    setBusy(true);
    try {
      await accountingAPI.deleteProduct(id);
      toast.success('Product archived');
      navigate(base);
    } catch (err) { toast.error(err.response?.data?.message || 'Archive failed'); }
    finally { setBusy(false); }
  };

  const btn = 'px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded disabled:opacity-50';
  const ghost = 'px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50';

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate(base)} className="text-blue-700 hover:underline">Products</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">{isNew ? 'New' : rec.name}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {editing ? (
          <>
            <button onClick={save} disabled={busy} className={btn}>Save</button>
            <button onClick={() => { if (isNew) navigate(base); else { setDraft(rec); setEditing(false); } }}
              className={ghost}>Discard</button>
          </>
        ) : (
          <>
            {can('product', 'write') && <button onClick={() => setEditing(true)} className={btn}>Edit</button>}
            {can('product', 'delete') && (
              <button onClick={archive} disabled={busy} className={`${ghost} flex items-center gap-1.5`}>
                <Archive className="w-4 h-4" /> Archive
              </button>
            )}
          </>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <input className="text-2xl font-bold text-gray-900 mb-6 w-full border-b border-transparent focus:border-blue-600 focus:outline-none disabled:border-transparent"
          disabled={readOnly} value={view.name || ''} placeholder="Product Name"
          onChange={(e) => set({ name: e.target.value })} />

        <div className="flex items-center gap-6 mb-5">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" disabled={readOnly}
              checked={!!view.canBeSold} onChange={(e) => set({ canBeSold: e.target.checked })} />
            Can be Sold
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" disabled={readOnly}
              checked={!!view.canBePurchased} onChange={(e) => set({ canBePurchased: e.target.checked })} />
            Can be Purchased
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10">
          <div>
            <Field label="Internal Reference">
              <input className={inputCls} disabled={readOnly} value={view.internalReference || ''}
                onChange={(e) => set({ internalReference: e.target.value })} />
            </Field>
            <Field label="Sales Price">
              <input type="number" step="0.01" className={inputCls} disabled={readOnly}
                value={view.salesPrice ?? ''} onChange={(e) => set({ salesPrice: e.target.value })} />
            </Field>
            <Field label="Cost">
              <input type="number" step="0.01" className={inputCls} disabled={readOnly}
                value={view.cost ?? ''} onChange={(e) => set({ cost: e.target.value })} />
            </Field>
            <Field label="Unit of Measure">
              <input className={inputCls} disabled={readOnly} value={view.uom || ''}
                onChange={(e) => set({ uom: e.target.value })} />
            </Field>
          </div>
          <div>
            <Field label="Product Category">
              <input className={inputCls} disabled={readOnly} value={view.category || ''}
                onChange={(e) => set({ category: e.target.value })} />
            </Field>
            <Field label="Income Account">
              <select className={inputCls} disabled={readOnly} value={view.incomeAccount || ''}
                onChange={(e) => set({ incomeAccount: e.target.value })}>
                <option value="" />
                {ACCOUNTS.map((acc) => <option key={acc}>{acc}</option>)}
              </select>
            </Field>
            <Field label="Expense Account">
              <select className={inputCls} disabled={readOnly} value={view.expenseAccount || ''}
                onChange={(e) => set({ expenseAccount: e.target.value })}>
                <option value="" />
                {ACCOUNTS.map((acc) => <option key={acc}>{acc}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-200 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Customer Taxes</p>
            <TaxPicker value={view.customerTaxes || []} disabled={readOnly}
              onChange={(v) => set({ customerTaxes: v })} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Vendor Taxes</p>
            <TaxPicker value={view.vendorTaxes || []} disabled={readOnly}
              onChange={(v) => set({ vendorTaxes: v })} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
