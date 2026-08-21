import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Star, Trash2, Copy, Printer, Share2,
  FileText, Receipt, Plus, X, Send, BellRing, BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { purchaseOrdersAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';
import {
  STATE_LABELS, STATUSBAR_STATES, CHARGE_COLUMNS, PRODUCTS, UOMS, CURRENCIES,
  CANCEL_REASONS, fmtDate, fmtMoney, recalcLine, linesTotal,
} from './constants';

const BLANK = {
  poDate: new Date().toISOString(),
  state: 'draft',
  priority: 0,
  vendor: '',
  vendorInvoiceNo: '',
  vendorInvoiceDate: '',
  contact: '',
  shipmentNo: '',
  purchaseApprover: '',
  currency: 'AED',
  chargeLines: [],
  activityLog: [],
  billCount: 0,
  documentCount: 0,
  followerCount: 1,
};

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[11rem_1fr] items-center gap-3 py-1.5">
    <label className="text-sm text-gray-500">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full text-sm px-2 py-1 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // The literal `/create` route binds no :id param, so `id` is undefined there.
  const isNew = !id || id === 'create';

  const [po, setPo] = useState(isNew ? BLANK : null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState(isNew ? BLANK : null);
  const [busy, setBusy] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelForm, setCancelForm] = useState({ cancelReason: CANCEL_REASONS[0], cancelRemark: '' });
  const [billsOpen, setBillsOpen] = useState(false);
  const [bills, setBills] = useState([]);
  const actionRef = useRef(null);

  const load = useCallback(async () => {
    // React Router reuses this component when only :id changes, so every
    // transient bit of form state has to be reset explicitly.
    setEditing(isNew);
    setActionOpen(false);
    setCancelOpen(false);
    setBillsOpen(false);
    setBills([]);
    setCancelForm({ cancelReason: CANCEL_REASONS[0], cancelRemark: '' });
    if (isNew) { setPo(BLANK); setDraft(BLANK); return; }
    setLoading(true);
    try {
      const res = await purchaseOrdersAPI.getById(id);
      setPo(res.data.data);
      setDraft(res.data.data);
    } catch {
      toast.error('Purchase order not found');
      navigate('/admin/procurement/purchase-orders');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const away = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  if (loading || !po) return <PageLoader />;

  const view = editing ? draft : po;
  const actions = po.actions || {};
  const lines = view.chargeLines || [];
  const readOnly = !editing;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const setLine = (idx, key, value) => {
    const next = lines.map((l, i) => (i === idx ? recalcLine({ ...l, [key]: value }) : l));
    set({ chargeLines: next });
  };

  const addLine = () => set({
    chargeLines: [...lines, recalcLine({
      sNo: lines.length + 1, product: PRODUCTS[0], uom: 'Shipment', noOfUnit: 1,
      chargeCurrency: view.currency || 'AED', exchangeRate: 1, amountPerUnit: 0,
    })],
  });

  const removeLine = (idx) => set({
    chargeLines: lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sNo: i + 1 })),
  });

  // Workflow calls all follow the same shape: run it, adopt the returned PO.
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      const next = res.data.data.purchaseOrder || res.data.data;
      setPo(next);
      setDraft(next);
      setEditing(false);
      toast.success(okMsg);
      return res;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
      return null;
    } finally {
      setBusy(false);
      setActionOpen(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...draft, amountTotal: linesTotal(draft.chargeLines) };
      if (isNew) {
        const res = await purchaseOrdersAPI.create(payload);
        toast.success('Purchase order created');
        navigate(`/admin/procurement/purchase-orders/${res.data.data.id}`);
      } else {
        const res = await purchaseOrdersAPI.update(id, payload);
        setPo(res.data.data);
        setDraft(res.data.data);
        setEditing(false);
        toast.success('Purchase order saved');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleStar = async () => {
    const next = po.priority ? 0 : 1;
    setPo((p) => ({ ...p, priority: next }));
    setDraft((d) => ({ ...d, priority: next }));
    if (!isNew) await purchaseOrdersAPI.setPriority(id, next);
  };

  const openBills = async () => {
    try {
      const res = await purchaseOrdersAPI.getBills(id);
      setBills(res.data.data || []);
      setBillsOpen(true);
    } catch {
      toast.error('Could not load bills');
    }
  };

  const doDelete = async () => {
    if (!window.confirm(`Delete ${po.poNumber}?`)) return;
    try {
      await purchaseOrdersAPI.delete(id);
      toast.success('Purchase order deleted');
      navigate('/admin/procurement/purchase-orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const duplicate = async () => {
    try {
      const res = await purchaseOrdersAPI.duplicate(id);
      toast.success(`Duplicated as ${res.data.data.poNumber}`);
      navigate(`/admin/procurement/purchase-orders/${res.data.data.id}`);
    } catch {
      toast.error('Duplicate failed');
    }
  };

  // Recomputed live while lines are being edited; falls back to the stored
  // amount for POs whose lines aren't captured.
  const total = lines.length ? linesTotal(lines) : Number(view.amountTotal || 0);

  return (
    <div className="p-6">
      {/* Breadcrumb + record pager */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/admin/procurement/purchase-orders')} className="text-blue-700 hover:underline">
            Purchase Order
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700 font-medium">{isNew ? 'New' : po.poNumber}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={busy}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => { if (isNew) navigate('/admin/procurement/purchase-orders'); else { setDraft(po); setEditing(false); } }}
                  className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
                >
                  Discard
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  disabled={!['draft', 'to_approve'].includes(po.state)}
                  title={['draft', 'to_approve'].includes(po.state) ? '' : `A ${STATE_LABELS[po.state]} purchase order is read-only`}
                  className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Edit
                </button>

                {/* State-gated workflow buttons — same rules as the demo's attrs. */}
                {actions.sendForApproval && (
                  <button
                    onClick={() => run(() => purchaseOrdersAPI.sendForApproval(id), 'Sent for approval')}
                    disabled={busy}
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded disabled:opacity-50"
                  >
                    Send for Approval
                  </button>
                )}
                {actions.approve && (
                  <button
                    onClick={() => run(() => purchaseOrdersAPI.approve(id), 'Purchase order approved')}
                    disabled={busy}
                    className="px-4 py-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {actions.reject && (
                  <button
                    onClick={() => run(() => purchaseOrdersAPI.reject(id), 'Purchase order rejected')}
                    disabled={busy}
                    className="px-4 py-1.5 border border-red-300 text-red-700 text-sm font-semibold rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {actions.createVendorBill && (
                  <button
                    onClick={async () => {
                      const res = await run(() => purchaseOrdersAPI.createVendorBill(id), 'Vendor bill created');
                      if (res) { setBills([res.data.data.bill]); setBillsOpen(true); }
                    }}
                    disabled={busy}
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded disabled:opacity-50"
                  >
                    Create Vendor Bill
                  </button>
                )}
                {actions.cancelPO && (
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={busy}
                    className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel PO
                  </button>
                )}

                {!isNew && (
                  <>
                    <button onClick={() => window.print()}
                      className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50 flex items-center gap-1.5">
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <div className="relative" ref={actionRef}>
                      <button
                        onClick={() => setActionOpen((o) => !o)}
                        className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
                      >
                        Action ▾
                      </button>
                      {actionOpen && (
                        <div className="absolute left-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                          <button onClick={duplicate} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Copy className="w-4 h-4" /> Duplicate
                          </button>
                          <button
                            onClick={() => { setActionOpen(false); toast('Accrued expense entry queued'); }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <BookOpen className="w-4 h-4" /> Accrued Expense Entry
                          </button>
                          <button
                            onClick={() => run(
                              () => purchaseOrdersAPI.addActivity(id, { kind: 'note', body: `${po.poNumber} shared` }),
                              'Shared',
                            ).then(load)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Share2 className="w-4 h-4" /> Share
                          </button>
                          <button
                            onClick={async () => {
                              if (!actions.createVendorBill) { toast.error('Create Vendor Bills is not available for this purchase order'); setActionOpen(false); return; }
                              const res = await run(() => purchaseOrdersAPI.createVendorBill(id), 'Vendor bill created');
                              if (res) { setBills([res.data.data.bill]); setBillsOpen(true); }
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Receipt className="w-4 h-4" /> Create Vendor Bills
                          </button>
                          <button
                            onClick={() => run(
                              () => purchaseOrdersAPI.addActivity(id, { kind: 'message', body: `Reminder sent to ${po.vendor || 'vendor'}` }),
                              'Reminder sent',
                            ).then(load)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <BellRing className="w-4 h-4" /> Send Reminder
                          </button>
                          <button
                            onClick={doDelete}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Statusbar */}
          <div className="flex items-center">
            {STATUSBAR_STATES.map((s, i) => {
              const active = view.state === s;
              return (
                <span
                  key={s}
                  className={`px-3 py-1 text-xs font-medium border ${i === 0 ? 'rounded-l' : ''} ${
                    i === STATUSBAR_STATES.length - 1 ? 'rounded-r' : ''
                  } ${i > 0 ? 'border-l-0' : ''} ${
                    active ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {STATE_LABELS[s]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Stat buttons */}
        {!isNew && (
          <div className="flex items-center gap-3 px-5 pt-4">
            {/* Opens the documents filed against this purchase order. */}
            <button onClick={() => navigate(`/admin/documents?purchaseOrder=${encodeURIComponent(po.poNumber || '')}`)}
              disabled={!po.documentCount}
              title={po.documentCount ? 'Open the documents on this order' : 'No documents on this order yet'}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-white">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-800">{po.documentCount || 0}</span>
              <span className="text-gray-500">Documents</span>
            </button>
            <button onClick={openBills} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <Receipt className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-800">{po.billCount || 0}</span>
              <span className="text-gray-500">Bills</span>
            </button>
          </div>
        )}

        {/* Title */}
        <div className="px-5 pt-4">
          <p className="text-xs text-gray-500 font-medium">Purchase Order</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New' : po.poNumber}</h1>
            {!isNew && (
              <button onClick={toggleStar} title="Favourite">
                <Star className={`w-5 h-5 ${po.priority ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-amber-400'}`} />
              </button>
            )}
          </div>
        </div>

        {/* Field grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 px-5 py-4">
          <div>
            <Field label="PO Date">
              <input
                type="datetime-local"
                disabled={readOnly}
                value={view.poDate ? new Date(view.poDate).toISOString().slice(0, 16) : ''}
                onChange={(e) => set({ poDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Vendor">
              <input disabled={readOnly} value={view.vendor || ''} onChange={(e) => set({ vendor: e.target.value })} className={inputCls} placeholder="Select vendor" />
            </Field>
            <Field label="Vendor Invoice No">
              <input disabled={readOnly} value={view.vendorInvoiceNo || ''} onChange={(e) => set({ vendorInvoiceNo: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Vendor Invoice Date">
              <input
                type="date"
                disabled={readOnly}
                value={view.vendorInvoiceDate ? String(view.vendorInvoiceDate).slice(0, 10) : ''}
                onChange={(e) => set({ vendorInvoiceDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Contact">
              <input disabled={readOnly} value={view.contact || ''} onChange={(e) => set({ contact: e.target.value })} className={inputCls} />
            </Field>
          </div>

          <div>
            <Field label="Shipment No">
              <input disabled={readOnly} value={view.shipmentNo || ''} onChange={(e) => set({ shipmentNo: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Created by">
              <span className="text-sm text-gray-800">{view.createdByName || '-'}</span>
            </Field>
            <Field label="Approved By">
              <span className="text-sm text-gray-800">{view.approvedByName || '-'}</span>
            </Field>
            <Field label="Purchase Approver">
              <input disabled={readOnly} value={view.purchaseApprover || ''} onChange={(e) => set({ purchaseApprover: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Approved Date">
              <span className="text-sm text-gray-800">{fmtDate(view.approvedDate) || '-'}</span>
            </Field>

            {/* Cancellation details only surface once the PO is cancelled. */}
            {view.state === 'cancel' && (
              <>
                <Field label="Reason">
                  <span className="text-sm text-gray-800">{view.cancelReason || '-'}</span>
                </Field>
                <Field label="Remarks">
                  <span className="text-sm text-gray-800">{view.cancelRemark || '-'}</span>
                </Field>
              </>
            )}
          </div>
        </div>

        {/* Charge Detail tab */}
        <div className="border-t border-gray-200 mt-2">
          <div className="px-5 pt-3">
            <span className="inline-block px-4 py-2 text-sm font-medium border-b-2 border-blue-700 text-blue-700">Charge Detail</span>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-500">Currency</label>
              <select
                disabled={readOnly}
                value={view.currency || 'AED'}
                onChange={(e) => set({ currency: e.target.value })}
                className="text-sm px-2 py-1 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent"
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {CHARGE_COLUMNS.map((c) => (
                      <th key={c.key} className={`text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap ${c.width}`}>
                        {c.label}
                      </th>
                    ))}
                    {editing && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={CHARGE_COLUMNS.length + 1} className="text-center py-6 text-gray-400 text-xs">
                        No charge lines
                      </td>
                    </tr>
                  ) : lines.map((line, idx) => (
                    <tr key={idx}>
                      {CHARGE_COLUMNS.map((c) => {
                        // amount / totals are computed, never keyed in.
                        const derived = ['amount', 'currencyTotalAmount', 'orderCurrencyTotalAmount'].includes(c.key);
                        if (readOnly || derived) {
                          return (
                            <td key={c.key} className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
                              {derived ? fmtMoney(line[c.key]) : (line[c.key] ?? '')}
                            </td>
                          );
                        }
                        if (c.key === 'product' || c.key === 'uom' || c.key === 'chargeCurrency') {
                          const opts = c.key === 'product' ? PRODUCTS : c.key === 'uom' ? UOMS : CURRENCIES;
                          return (
                            <td key={c.key} className="px-3 py-2">
                              <select
                                value={line[c.key] || ''}
                                onChange={(e) => setLine(idx, c.key, e.target.value)}
                                className="w-full text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-600"
                              >
                                {opts.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            </td>
                          );
                        }
                        return (
                          <td key={c.key} className="px-3 py-2">
                            <input
                              type={c.type}
                              value={line[c.key] ?? ''}
                              onChange={(e) => setLine(idx, c.key, c.type === 'number' ? Number(e.target.value) : e.target.value)}
                              className="w-full text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-600"
                            />
                          </td>
                        );
                      })}
                      {editing && (
                        <td className="px-1 py-2">
                          <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-600" title="Remove line">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editing && (
              <button onClick={addLine} className="mt-2 flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
                <Plus className="w-4 h-4" /> Add a line
              </button>
            )}

            <div className="flex justify-end mt-4">
              <div className="flex items-center gap-6 border-t border-gray-300 pt-2 min-w-[16rem] justify-between">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-sm font-bold text-gray-900">{fmtMoney(total)} {view.currency || 'AED'}</span>
              </div>
            </div>
          </div>
        </div>

        {!isNew && (
          <div className="px-5 pb-6">
            <OrganizationChatter
              organizationId={po.id}
              entries={po.activityLog || []}
              followerCount={po.followerCount || 1}
              api={purchaseOrdersAPI}
              onPosted={(entry) => setPo((p) => ({ ...p, activityLog: [entry, ...(p.activityLog || [])] }))}
            />
          </div>
        )}
      </div>

      {/* Cancel PO — the demo asks for a reason and remarks before cancelling. */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Cancel Purchase Order</h3>
              <button onClick={() => setCancelOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Reason</label>
                <select
                  value={cancelForm.cancelReason}
                  onChange={(e) => setCancelForm((f) => ({ ...f, cancelReason: e.target.value }))}
                  className="w-full mt-1 text-sm px-2 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-600"
                >
                  {CANCEL_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Remarks</label>
                <textarea
                  rows={3}
                  value={cancelForm.cancelRemark}
                  onChange={(e) => setCancelForm((f) => ({ ...f, cancelRemark: e.target.value }))}
                  className="w-full mt-1 text-sm px-2 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50">Discard</button>
              <button
                onClick={async () => {
                  const res = await run(() => purchaseOrdersAPI.cancel(id, cancelForm), 'Purchase order cancelled');
                  if (res) setCancelOpen(false);
                }}
                disabled={busy}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded disabled:opacity-50"
              >
                Cancel PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bills raised off this PO */}
      {billsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Purchase Order / {po.poNumber} / Vendor Bills
              </h3>
              <button onClick={() => setBillsOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Bill Number', 'Bill Date', 'Vendor', 'Total', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bills.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-xs">No vendor bills yet</td></tr>
                  ) : bills.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">{b.billNumber}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{fmtDate(b.billDate)}</td>
                      <td className="px-4 py-2 text-gray-700 text-xs">{b.vendorName || '-'}</td>
                      <td className="px-4 py-2 text-gray-800 text-xs">{fmtMoney(b.totalAmount)} {b.currency}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 capitalize">{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button
                onClick={() => { setBillsOpen(false); navigate('/admin/vendor-bills'); }}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded"
              >
                <Send className="w-4 h-4" /> Open Vendor Bills
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetail;
