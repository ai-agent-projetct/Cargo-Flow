import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, Plus, Trash2, X, AlertTriangle, FileEdit } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';
import { exportCsv } from '../../../utils/exportCsv';
import {
  STATE, STATUSBAR, CHARGE_SOURCES, FORM_TABS, LINE_COLUMNS, PRODUCTS, ACCOUNTS,
  TAXES, CURRENCIES, fmtDate, money, num, recalcLine, totalsFor,
} from './constants';

const TITLE_BY_TYPE = {
  out_invoice: 'Customer Invoice', out_refund: 'Customer Credit Note',
  out_debit: 'Customer Debit Note', in_invoice: 'Vendor Bill',
  in_refund: 'Vendor Credit Note', in_debit: 'Vendor Debit Note', entry: 'Journal Entry',
};

const BLANK = {
  moveType: 'out_invoice', state: 'draft', paymentState: 'not_paid',
  currency: 'AED', companyCurrency: 'AED', lines: [], journalItems: [],
  journal: 'Customer Invoices', activityLog: [],
};

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[9rem_1fr] items-start gap-3 py-1">
    <label className="text-sm font-semibold text-gray-700 pt-1">{label}</label>
    <div className="min-w-0">{children}</div>
  </div>
);

const inputCls = 'w-full text-sm px-1 py-0.5 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';
const cellCls = 'w-full text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-600';

const MoveDetail = ({ menu = 'invoices' }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  // Vendor documents live under /vendors and the debit-note URL segment differs
  // from its menu key, so both are derived rather than assumed.
  const VENDOR_MENUS = ['bills', 'refunds', 'vendor-debit-notes'];
  const section = VENDOR_MENUS.includes(menu) ? 'vendors' : 'customers';
  const segment = menu === 'vendor-debit-notes' ? 'debit-notes' : menu;
  const isNew = !id || id === 'create';

  const [rec, setRec] = useState(isNew ? BLANK : null);
  const [draft, setDraft] = useState(isNew ? BLANK : null);
  const [credit, setCredit] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [tab, setTab] = useState('Invoice Lines');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(null); // { kind, options, chosen[] }
  const [limitPrompt, setLimitPrompt] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const busyRef = useRef(false);
  const actionRef = useRef(null);

  // Close the Action menu on an outside click.
  useEffect(() => {
    const away = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  // Copy the record as a fresh draft and open it.
  const duplicate = async () => {
    setActionOpen(false);
    const src = rec || {};
    const res = await guard(() => accountingAPI.create({
      partner: src.partner,
      partnerAddress: src.partnerAddress,
      invoiceDate: src.invoiceDate,
      invoiceDateDue: src.invoiceDateDue,
      currency: src.currency,
      companyCurrency: src.companyCurrency,
      lines: src.lines || [],
      narration: src.narration,
    }, menu));
    if (res) {
      toast.success('Duplicated as a new draft');
      navigate(`/admin/accounting/${section}/${segment}/${res.data.data.id}`);
    }
  };

  const remove = async () => {
    setActionOpen(false);
    if (rec?.state !== 'draft') { toast.error('Only a draft can be deleted'); return; }
    const res = await guard(() => accountingAPI.delete(id));
    if (res) { toast.success('Deleted'); navigate(`/admin/accounting/${section}/${segment}`); }
  };

  const onExportOne = () => {
    setActionOpen(false);
    const lines = rec?.lines || [];
    if (!lines.length) { toast.error('This document has no lines to export'); return; }
    exportCsv(lines, [
      { key: 'product', label: 'Product' },
      { key: 'label', label: 'Label' },
      { key: 'account', label: 'Account' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'price', label: 'Price' },
      { key: 'taxes', label: 'Taxes' },
      { key: 'vatAmount', label: 'Tax Amount' },
      { key: 'subtotal', label: 'Subtotal' },
    ], (rec.name || 'document').replace(/\//g, '-'));
    toast.success('Exported document lines');
  };

  const load = useCallback(async () => {
    setEditing(isNew);
    setTab('Invoice Lines');
    if (isNew) { setRec(BLANK); setDraft(BLANK); setLoading(false); return; }
    setLoading(true);
    const res = await guard(() => accountingAPI.getById(id));
    if (res) {
      const d = res.data.data;
      setRec(d); setDraft(d); setCredit(d.creditLimit || null);
    } else navigate(`/admin/accounting/${section}/${segment}`);
    setLoading(false);
  }, [id, isNew, guard, navigate, section, segment]);

  useEffect(() => { load(); }, [load]);

  if (loading || !rec) return <PageLoader />;

  const view = editing ? draft : rec;
  const readOnly = !editing;
  const a = rec.actions || {};
  const lines = view.lines || [];
  const fromShipment = !!view.addChargesFrom;
  const cols = LINE_COLUMNS.filter((c) => !c.shipmentOnly || fromShipment);
  const totals = totalsFor(lines);
  const cur = view.currency || 'AED';
  const related = rec.related || { creditNotes: [], debitNotes: [], creditTotal: 0, debitTotal: 0 };

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (i, key, value) =>
    set({ lines: lines.map((l, x) => (x === i ? recalcLine({ ...l, [key]: value }) : l)) });

  const addRow = (kind) => set({
    lines: [...lines, kind === 'line'
      ? recalcLine({ kind: 'line', product: PRODUCTS[0], label: PRODUCTS[0].replace(/^\[\w+\]\s*/, ''),
        account: ACCOUNTS[0], quantity: 1, price: 0, discount: 0, taxes: 'VAT 0%',
        analyticAccount: '', analyticTags: [], exRate: 1, amountQty: 0, chargeCurrency: cur, houseShipment: '' })
      : { kind, label: kind === 'section' ? 'Section' : 'Note' }],
  });

  const removeRow = (i) => set({ lines: lines.filter((_, x) => x !== i) });

  const run = async (fn, okMsg) => {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true);
    try {
      const res = await fn();
      const d = res.data.data;
      setRec(d); setDraft(d); setCredit(d.creditLimit || credit); setEditing(false);
      toast.success(okMsg);
      return res;
    } catch (err) {
      const body = err.response?.data;
      // The credit-limit refusal comes back as a 400 carrying the limit.
      if (body?.creditLimit?.exceeded) { setLimitPrompt({ message: body.message, limit: body.creditLimit }); return null; }
      toast.error(body?.message || 'Action failed');
      return null;
    } finally { busyRef.current = false; setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await accountingAPI.create(draft, menu);
        toast.success('Invoice created');
        navigate(`/admin/accounting/${section}/${segment}/${res.data.data.id}`);
      } else {
        const res = await accountingAPI.update(id, draft);
        setRec(res.data.data); setDraft(res.data.data); setEditing(false);
        toast.success('Saved');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  const openPicker = async (kind) => {
    const res = await guard(() => accountingAPI.sources(kind));
    if (res) setPicker({ kind, options: res.data.data, chosen: [] });
  };

  const applyPicker = async () => {
    if (!picker.chosen.length) { toast.error('Select at least one'); return; }
    await run(() => accountingAPI.pullCharges(id, picker.kind, picker.chosen), 'Charges added');
    setPicker(null);
  };

  const steps = view.state === 'cancel' ? ['draft', 'cancel'] : STATUSBAR;
  const btn = 'px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded disabled:opacity-50';
  const ghost = 'px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50';

  return (
    <div className="px-6 pb-6">
      {/* Breadcrumb + pager */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate(`/admin/accounting/${section}/${segment}`)} className="text-blue-700 hover:underline">
            {menu === 'invoices' ? 'Invoices' : menu === 'credit-notes' ? 'Credit Notes' : 'Debit Notes'}
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">
            {isNew ? 'New' : `${STATE[rec.state]} ${TITLE_BY_TYPE[rec.moveType]?.split(' ').pop() || ''} ${rec.name === '/' ? '' : rec.name}`.trim()}
            {rec.ref ? ` (${rec.ref})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <button onClick={save} disabled={busy} className={btn}>Save</button>
              <button onClick={() => { if (isNew) navigate(`/admin/accounting/${section}/${segment}`); else { setDraft(rec); setEditing(false); } }}
                className={ghost}>Discard</button>
            </>
          ) : (
            <>
              {a.edit && can('invoice', 'write') && <button onClick={() => setEditing(true)} className={btn}>Edit</button>}
              <button onClick={() => window.print()} className={`${ghost} flex items-center gap-1.5`}>
                <Printer className="w-4 h-4" /> Print
              </button>
              <div className="relative" ref={actionRef}>
                <button onClick={() => setActionOpen((o) => !o)} className={ghost}>⚙ Action</button>
                {actionOpen && (
                  <div className="absolute left-0 top-9 z-30 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    <button onClick={duplicate}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">Duplicate</button>
                    <button onClick={onExportOne}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">Export</button>
                    {/* Only a draft can be deleted; a posted document must be
                        cancelled and reset first, same as the source system. */}
                    <button onClick={remove} disabled={rec?.state !== 'draft'}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-white">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center">
          {steps.map((s, i) => (
            <span key={s} className={`px-4 py-1.5 text-sm ${
              view.state === s ? 'bg-blue-700 text-white font-medium' : 'bg-white text-gray-500 border-y border-gray-300'
            } ${i === 0 ? 'border-l rounded-l' : ''} ${i === steps.length - 1 ? 'border-r rounded-r' : ''}`}>
              {STATE[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Workflow buttons */}
      {!editing && !isNew && (
        <div className="flex items-center gap-2 mb-3">
          {a.confirm && <button onClick={() => run(() => accountingAPI.confirm(id), 'Entry posted')} disabled={busy} className={btn}>Confirm</button>}
          <button onClick={() => window.print()} className={ghost}>Preview</button>
          {a.cancel && <button onClick={() => run(() => accountingAPI.cancel(id), 'Entry cancelled')} disabled={busy} className={ghost}>Cancel</button>}
          {a.resetToDraft && <button onClick={() => run(() => accountingAPI.resetToDraft(id), 'Reset to draft')} disabled={busy} className={ghost}>Reset to Draft</button>}
        </div>
      )}

      {/* Credit-limit banner */}
      {credit?.exceeded && (
        <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            This customer has reached his Credit Limit of :{' '}
            <span className="font-semibold">
              {Number(credit.limit).toLocaleString('en-US', { minimumFractionDigits: 2 })} {credit.currency}
            </span> .
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {/* Stat buttons */}
        {!isNew && (
          <div className="flex justify-end gap-2 mb-4 flex-wrap">
            {(view.houseShipmentRefs || []).length > 0 && (
              <button onClick={() => navigate('/admin/house-shipments')}
                className="px-4 py-2 border border-gray-200 rounded text-sm text-left hover:bg-gray-50">
                <span className="block text-gray-500 text-xs">House</span>
                <span className="text-gray-800">Shipment</span>
              </button>
            )}
            {/* Credit and debit notes raised against this document. The figures
                come from the records themselves, and the button opens them. */}
            <button
              onClick={() => navigate(`/admin/accounting/${section}/credit-notes?search=${encodeURIComponent(rec.name || '')}`)}
              disabled={!related.creditNotes.length}
              className="px-4 py-2 border border-gray-200 rounded text-sm text-left hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-white">
              <span className="block text-blue-700">{money(related.creditTotal, cur)}</span>
              <span className="text-gray-600 text-xs">
                Credit Note{related.creditNotes.length ? ` (${related.creditNotes.length})` : ''}
              </span>
            </button>
            <button
              onClick={() => navigate(`/admin/accounting/${section}/debit-notes?search=${encodeURIComponent(rec.name || '')}`)}
              disabled={!related.debitNotes.length}
              className="px-4 py-2 border border-gray-200 rounded text-sm text-left hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-white">
              <span className="block text-blue-700">{money(related.debitTotal, cur)}</span>
              <span className="text-gray-600 text-xs">
                Debit Notes{related.debitNotes.length ? ` (${related.debitNotes.length})` : ''}
              </span>
            </button>
          </div>
        )}

        <p className="text-sm font-semibold text-gray-700">{TITLE_BY_TYPE[view.moveType] || 'Customer Invoice'}</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {rec.name && rec.name !== '/' ? rec.name : STATE[view.state]}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12">
          <div>
            <Field label="Customer">
              {readOnly ? (
                <div>
                  <span className="text-blue-700 text-sm">{view.partner || ''}</span>
                  {view.partnerAddress && view.partnerAddress !== view.partner && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{view.partnerAddress}</p>
                  )}
                </div>
              ) : (
                <input value={view.partner || ''} onChange={(e) => set({ partner: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Payment Reference">
              <input disabled={readOnly} value={view.paymentReference || ''}
                onChange={(e) => set({ paymentReference: e.target.value })} className={inputCls} />
            </Field>

            <Field label="Add Charges From">
              <div className="flex items-center gap-5 pt-1">
                {CHARGE_SOURCES.map((s) => (
                  <label key={s.key} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="chargesFrom" className="accent-blue-600"
                      disabled={readOnly && !a.edit}
                      checked={view.addChargesFrom === s.key}
                      onChange={() => { set({ addChargesFrom: s.key }); if (!isNew && a.edit) openPicker(s.key); }} />
                    {s.label}
                  </label>
                ))}
              </div>
            </Field>

            {view.addChargesFrom && (
              <Field label={`Charge ${CHARGE_SOURCES.find((s) => s.key === view.addChargesFrom)?.label} Shipment`}>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(view.addChargesFrom === 'house' ? view.chargeHouseShipments
                    : view.addChargesFrom === 'master' ? view.chargeMasterShipments
                      : view.chargeServiceJobs || []).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700">{s}</span>
                  ))}
                  {a.edit && (
                    <button onClick={() => openPicker(view.addChargesFrom)}
                      className="px-2 py-0.5 border border-dashed border-gray-300 rounded-full text-xs text-blue-700 hover:bg-gray-50">
                      + Add
                    </button>
                  )}
                </div>
              </Field>
            )}
          </div>

          <div>
            <Field label="Invoice Date">
              {readOnly ? <span className="text-sm text-gray-800">{fmtDate(view.invoiceDate)}</span> : (
                <input type="date" value={view.invoiceDate ? String(view.invoiceDate).slice(0, 10) : ''}
                  onChange={(e) => set({ invoiceDate: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Due Date">
              {readOnly ? (
                <span className="text-sm text-blue-700">{view.paymentTermLabel || fmtDate(view.invoiceDateDue)}</span>
              ) : (
                <input type="date" value={view.invoiceDateDue ? String(view.invoiceDateDue).slice(0, 10) : ''}
                  onChange={(e) => set({ invoiceDateDue: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Journal">
              <span className="text-sm">
                <span className="text-blue-700">{view.journal || 'Customer Invoices'}</span>
                <span className="text-gray-600"> in </span>
                {readOnly ? <span className="text-blue-700">{cur}</span> : (
                  <select value={cur} onChange={(e) => set({ currency: e.target.value })}
                    className="text-sm border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent">
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                )}
              </span>
            </Field>
            <Field label="Label">
              <input disabled={readOnly} value={view.label || ''} onChange={(e) => set({ label: e.target.value })} className={inputCls} />
            </Field>
            {view.reversedEntryName && (
              <Field label="Invoice"><span className="text-sm text-blue-700">{view.reversedEntryName}</span></Field>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-6 border-b border-gray-200 flex-wrap">
          {FORM_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? 'border-blue-700 text-blue-700 font-medium' : 'border-transparent text-blue-700 hover:text-blue-900'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Invoice Lines' && (
          <div className="pt-4">
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-300">
                  <tr>
                    {cols.map((c) => (
                      <th key={c.key} className={`text-left px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${c.width}`}>
                        {c.label}
                      </th>
                    ))}
                    {editing && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.length === 0 ? (
                    <tr><td colSpan={cols.length + 1} className="text-center py-6 text-gray-400 text-xs">No invoice lines</td></tr>
                  ) : lines.map((l, i) => {
                    const kind = l.kind || 'line';
                    if (kind !== 'line') {
                      return (
                        <tr key={i} className={kind === 'section' ? 'bg-gray-50' : ''}>
                          <td colSpan={cols.length} className="px-2 py-1.5">
                            {readOnly ? (
                              <span className={kind === 'section' ? 'font-semibold text-gray-800 text-xs' : 'italic text-gray-600 text-xs'}>
                                {l.label}
                              </span>
                            ) : (
                              <input value={l.label || ''} onChange={(e) => setLine(i, 'label', e.target.value)}
                                className={`${cellCls} ${kind === 'section' ? 'font-semibold' : 'italic'}`} />
                            )}
                          </td>
                          {editing && (
                            <td className="px-1 py-1.5">
                              <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      );
                    }
                    return (
                      <tr key={i}>
                        {cols.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">
                            {c.derived || readOnly || c.shipmentOnly ? (
                              <span className="text-gray-800 text-xs">
                                {c.key === 'analyticTags' ? (l.analyticTags || []).map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] mr-1">{t}</span>
                                )) : c.dp ? num(l[c.key], c.dp) : (l[c.key] ?? '')}
                              </span>
                            ) : c.type === 'select' ? (
                              <select value={l[c.key] || ''} onChange={(e) => setLine(i, c.key, e.target.value)} className={cellCls}>
                                {(c.key === 'product' ? PRODUCTS : ACCOUNTS).map((o) => <option key={o}>{o}</option>)}
                              </select>
                            ) : c.type === 'tax' ? (
                              <select value={l.taxes || 'VAT 0%'} onChange={(e) => setLine(i, 'taxes', e.target.value)} className={cellCls}>
                                {TAXES.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            ) : c.type === 'number' ? (
                              <input type="number" value={l[c.key] ?? ''} onChange={(e) => setLine(i, c.key, Number(e.target.value))} className={cellCls} />
                            ) : (
                              <input value={l[c.key] ?? ''} onChange={(e) => setLine(i, c.key, e.target.value)} className={cellCls} />
                            )}
                          </td>
                        ))}
                        {editing && (
                          <td className="px-1 py-1.5">
                            <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {editing && (
              <div className="flex items-center gap-4 mt-2 text-sm">
                <button onClick={() => addRow('line')} className="text-blue-700 hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add a line
                </button>
                <button onClick={() => addRow('section')} className="text-blue-700 hover:underline">Add a section</button>
                <button onClick={() => addRow('note')} className="text-blue-700 hover:underline">Add a note</button>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Untaxed Amount:</span>
                  <span className="text-gray-900">{money(totals.untaxed, cur)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">VAT {lines.find((l) => l.taxRate)?.taxRate || 0}%:</span>
                  <span className="text-gray-900">{money(totals.tax, cur)}</span></div>
                <div className="flex justify-between border-t border-gray-900 pt-1 font-bold">
                  <span>Total:</span><span>{money(totals.total, cur)}</span></div>
                {view.moveType === 'out_refund' && (
                  <div className="flex justify-between border-t border-gray-300 pt-1 mt-2 font-semibold">
                    <span>Amount Due:</span><span>{money(view.amountResidual, cur)}</span></div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'Journal Items' && (
          <div className="pt-4 overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-300">
                <tr>{['Account', 'Label', 'Partner', 'Debit', 'Credit', 'Currency'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-800 text-xs">{h}</th>))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(view.journalItems || []).length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-xs">
                    Journal items appear once the entry is posted
                  </td></tr>
                ) : view.journalItems.map((j, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-800 text-xs">{j.account}</td>
                    <td className="px-3 py-1.5 text-gray-700 text-xs">{j.label}</td>
                    <td className="px-3 py-1.5 text-gray-700 text-xs">{j.partner}</td>
                    <td className="px-3 py-1.5 text-gray-800 text-xs text-right">{num(j.debit)}</td>
                    <td className="px-3 py-1.5 text-gray-800 text-xs text-right">{num(j.credit)}</td>
                    <td className="px-3 py-1.5 text-gray-600 text-xs">{j.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Other Info' && (
          <div className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-12 max-w-4xl">
            <div>
              <Field label="Company"><span className="text-sm text-gray-800">{view.company || ''}</span></Field>
              <Field label="Company Currency"><span className="text-sm text-gray-800">{view.companyCurrency}</span></Field>
              <Field label="Reference"><span className="text-sm text-gray-800">{view.ref || ''}</span></Field>
            </div>
            <div>
              <Field label="Payment Status"><span className="text-sm text-gray-800">{view.paymentState}</span></Field>
              <Field label="Amount Due"><span className="text-sm text-gray-800">{money(view.amountResidual, cur)}</span></Field>
              <Field label="To Check">
                <input type="checkbox" disabled={readOnly} checked={!!view.toCheck}
                  onChange={(e) => set({ toCheck: e.target.checked })} className="rounded border-gray-300 mt-1" />
              </Field>
            </div>
          </div>
        )}

        {tab === 'Terms & Conditions' && (
          <div className="pt-4">
            {readOnly ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{view.narration || '—'}</p>
            ) : (
              <textarea rows={5} value={view.narration || ''} onChange={(e) => set({ narration: e.target.value })}
                className="w-full text-sm px-2 py-2 border border-gray-300 rounded focus:border-blue-600 focus:outline-none resize-none" />
            )}
          </div>
        )}

        {tab === 'WMS Invoice Integration' && (
          <div className="pt-4">
            <p className="text-sm text-gray-500">No WMS integration configured for this entry.</p>
          </div>
        )}
      </div>

      {!isNew && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl px-6 py-4">
          <OrganizationChatter organizationId={rec.id} entries={rec.activityLog || []}
            followerCount={rec.followerCount || 1} api={accountingAPI}
            onPosted={(e) => setRec((r) => ({ ...r, activityLog: [e, ...(r.activityLog || [])] }))} />
        </div>
      )}

      {/* Shipment picker for Add Charges From */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileEdit className="w-4 h-4" />
                Add charges from {CHARGE_SOURCES.find((s) => s.key === picker.kind)?.label}
              </h3>
              <button onClick={() => setPicker(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
              {picker.options.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Nothing available to charge from</p>
              ) : picker.options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={picker.chosen.includes(o.ref)}
                    onChange={() => setPicker((p) => ({
                      ...p,
                      chosen: p.chosen.includes(o.ref) ? p.chosen.filter((x) => x !== o.ref) : [...p.chosen, o.ref],
                    }))} />
                  {o.label}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={() => setPicker(null)} className={ghost}>Cancel</button>
              <button onClick={applyPicker} disabled={busy} className={btn}>Add charges</button>
            </div>
          </div>
        </div>
      )}

      {/* Credit-limit refusal */}
      {limitPrompt && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-32">
          <div className="bg-white rounded w-full max-w-2xl shadow-2xl">
            <div className="px-8 pt-6 pb-2">
              <h2 className="text-2xl font-bold text-blue-700">Warning</h2>
            </div>
            <div className="px-8 pb-4">
              <p className="text-base text-gray-800">{limitPrompt.message}</p>
              <p className="text-sm text-gray-600 mt-3">
                Outstanding {money(limitPrompt.limit.outstanding, limitPrompt.limit.currency)} of{' '}
                {money(limitPrompt.limit.limit, limitPrompt.limit.currency)} — this entry would take exposure to{' '}
                {money(limitPrompt.limit.exposure, limitPrompt.limit.currency)}.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-8 pb-6">
              <button onClick={() => setLimitPrompt(null)} className={ghost}>Ok</button>
              <button
                onClick={async () => {
                  setLimitPrompt(null);
                  await run(() => accountingAPI.confirm(id, { overrideCreditLimit: true }), 'Posted over the credit limit');
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded">
                Post anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoveDetail;
