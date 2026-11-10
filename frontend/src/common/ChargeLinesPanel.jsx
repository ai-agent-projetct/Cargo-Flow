import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, RefreshCw, Download, Copy, Save, X, Pencil, AlertTriangle, Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { chargeLinesAPI } from '../services/api';
import { exportCsv } from '../utils/exportCsv';

// The charge grid shared by quotes, house and master shipments, service jobs
// and pro formas. `side` decides which columns are shown:
//
//   'both'    a quote line, buy and sell on one row with the margin between
//   'cost'    a cost charge, what we owe a vendor
//   'revenue' a revenue charge, what we bill the customer
//
// Quantities for a basis-driven charge are computed by the server from the
// record's cargo, so changing a shipment's weight and pressing Recalculate
// reprices every per-kg and per-CBM charge without anyone retyping anything.

const MEASUREMENT_BASES = [
  'Chargeable Weight', 'Gross Weight', 'Net Weight', 'Volume', 'W/M',
  'Container', 'Per Truck', 'Per Package', 'Per Shipment', 'Per BL', 'TEU',
];

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'OMR', 'CNY'];

const BILLING_LABELS = {
  no: 'Not billed',
  partial: 'Partially billed',
  fully_billed: 'Fully billed',
  fully_invoiced: 'Fully invoiced',
  pro_forma: 'On pro forma',
  pro_forma_cancel: 'Pro forma cancelled',
};

const BILLING_STYLES = {
  no: 'bg-slate-100 text-slate-600',
  partial: 'bg-amber-100 text-amber-700',
  fully_billed: 'bg-emerald-100 text-emerald-700',
  fully_invoiced: 'bg-emerald-100 text-emerald-700',
  pro_forma: 'bg-blue-100 text-blue-700',
  pro_forma_cancel: 'bg-slate-100 text-slate-500',
};

const money = (v, currency = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const qty = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

const blankLine = (side, currency) => ({
  chargeCode: '',
  chargeDescription: '',
  measurementBasis: 'Per Shipment',
  uom: 'unit',
  quantity: 1,
  costCurrency: currency,
  costAmountRate: 0,
  costConversionRate: 1,
  sellCurrency: currency,
  sellAmountRate: 0,
  sellConversionRate: 1,
  useMargin: false,
  marginType: 'percentage',
  marginPercentage: 0,
  marginAmount: 0,
  remarks: '',
  side,
});

const ChargeLinesPanel = ({
  parentType,
  parentId,
  side = 'both',
  currency = 'AED',
  legId = null,
  legLabel = null,
  partners = [],
  readOnly = false,
  title,
  onTotalsChange,
}) => {
  const [lines, setLines] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState(false);

  const showCost = side === 'cost' || side === 'both';
  const showSell = side === 'revenue' || side === 'both';

  // `onTotalsChange` is almost always an inline arrow, so it is a new function
  // on every render of the parent. Holding it in a ref keeps it out of
  // `load`'s dependency list - with it in there, loading triggered the
  // parent to re-render, which produced a new callback, which reloaded, and
  // the panel never left its loading state.
  const notifyRef = useRef(onTotalsChange);
  useEffect(() => { notifyRef.current = onTotalsChange; }, [onTotalsChange]);

  const load = useCallback(async () => {
    if (!parentId) { setLines([]); setLoading(false); return; }
    setLoading(true);
    try {
      const params = { parentType, parentId, limit: 'all' };
      if (side !== 'both') params.side = side;
      if (legId) params.multimodalLineId = legId;
      const res = await chargeLinesAPI.getAll(params);
      const payload = res.data?.data || {};
      setLines(payload.lines || []);
      setTotals(payload.totals || null);
    } catch (err) {
      // A 403 here means the user may see the record but not its costing,
      // which is a legitimate configuration rather than a failure.
      if (err.response?.status === 403) setLines([]);
      else toast.error(err.response?.data?.message || 'Could not load charges');
    } finally {
      setLoading(false);
    }
  }, [parentType, parentId, side, legId]);

  useEffect(() => { load(); }, [load]);

  // Reload, then tell the parent its header totals have moved. Only a real
  // change calls this - reading the grid is not a change, and treating it as
  // one is what caused the loop described above.
  const reloadAndNotify = useCallback(async () => {
    await load();
    if (notifyRef.current) notifyRef.current();
  }, [load]);

  const startAdd = () => {
    setDraft(blankLine(side, currency));
    setAdding(true);
    setEditingId(null);
  };

  const startEdit = (line) => {
    setDraft({ ...line });
    setEditingId(line.id);
    setAdding(false);
  };

  const cancelEdit = () => { setDraft(null); setEditingId(null); setAdding(false); };

  const setField = (field) => (e) => {
    const raw = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((d) => ({ ...d, [field]: raw }));
  };

  const save = async () => {
    if (!draft.chargeDescription?.trim()) {
      toast.error('Enter what the charge is for');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...draft,
        parentType,
        parentId,
        side,
        multimodalLineId: legId || draft.multimodalLineId || null,
        quantity: Number(draft.quantity) || 0,
        costAmountRate: Number(draft.costAmountRate) || 0,
        sellAmountRate: Number(draft.sellAmountRate) || 0,
        costConversionRate: Number(draft.costConversionRate) || 1,
        sellConversionRate: Number(draft.sellConversionRate) || 1,
        marginPercentage: Number(draft.marginPercentage) || 0,
        marginAmount: Number(draft.marginAmount) || 0,
      };
      if (adding) {
        await chargeLinesAPI.create(payload);
        toast.success('Charge added');
      } else {
        await chargeLinesAPI.update(editingId, payload);
        toast.success('Charge updated');
      }
      cancelEdit();
      await reloadAndNotify();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the charge');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (line) => {
    // Spelled out rather than a bare "Are you sure?" so the consequence is
    // visible before the click.
    const ok = window.confirm(
      `Delete "${line.chargeDescription}"?\n\n`
      + `${showSell ? `Revenue ${money(line.totalSellAmount, line.sellCurrency || currency)}\n` : ''}`
      + `${showCost ? `Cost ${money(line.totalCostAmount, line.costCurrency || currency)}\n` : ''}`
      + '\nThis cannot be undone.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await chargeLinesAPI.delete(line.id);
      toast.success('Charge removed');
      await reloadAndNotify();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the charge');
    } finally {
      setBusy(false);
    }
  };

  const recalculate = async () => {
    setBusy(true);
    try {
      const res = await chargeLinesAPI.recalculate({ parentType, parentId });
      toast.success(res.data?.message || 'Charges repriced');
      await reloadAndNotify();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reprice the charges');
    } finally {
      setBusy(false);
    }
  };

  const copyFromQuote = async () => {
    const quotationId = window.prompt(
      'Paste the quotation id whose charges should be copied onto this record:',
    );
    if (!quotationId) return;
    setBusy(true);
    try {
      const res = await chargeLinesAPI.copyFromQuote({
        quotationId: quotationId.trim(), parentType, parentId, append: lines.length > 0,
      });
      toast.success(res.data?.message || 'Charges copied');
      await reloadAndNotify();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not copy the quote charges');
    } finally {
      setBusy(false);
    }
  };

  const exportSpec = useMemo(() => {
    const spec = [
      { label: 'Code', key: 'chargeCode' },
      { label: 'Charge', key: 'chargeDescription' },
      { label: 'Basis', key: 'measurementBasis' },
      { label: 'Qty', key: 'quantity' },
    ];
    if (showCost) {
      spec.push(
        { label: 'Buy Currency', key: 'costCurrency' },
        { label: 'Buy Rate', key: 'costAmountRate' },
        { label: 'Total Cost', key: 'totalCostAmount' },
        { label: 'Cost incl. Tax', key: 'totalCostAmountIncl' },
      );
    }
    if (showSell) {
      spec.push(
        { label: 'Sell Currency', key: 'sellCurrency' },
        { label: 'Sell Rate', key: 'sellAmountRate' },
        { label: 'Total Sell', key: 'totalSellAmount' },
        { label: 'Sell incl. Tax', key: 'totalSellAmountIncl' },
      );
    }
    if (side === 'both') {
      spec.push(
        { label: 'Margin', key: 'estimatedMargin' },
        { label: 'Margin %', key: 'estimatedMarginPercentage' },
      );
    }
    spec.push(
      { label: 'Billing', key: (r) => BILLING_LABELS[r.billingStatus] || r.billingStatus },
      { label: 'Chargeable Wt', key: 'chargeableWeight' },
    );
    return spec;
  }, [showCost, showSell, side]);

  const onExport = () => {
    if (exportCsv(lines, exportSpec, `charges-${parentType}-${parentId}`)) {
      toast.success(`Exported ${lines.length} charges`);
    } else {
      toast.error('Nothing to export');
    }
  };

  const sum = (field) => lines.reduce((s, l) => s + (Number(l[field]) || 0), 0);
  const totalCost = sum('totalCostAmountIncl') || sum('totalCostAmount');
  const totalSell = sum('totalSellAmountIncl') || sum('totalSellAmount');
  const margin = totalSell - totalCost;
  const marginPct = totalSell ? (margin / totalSell) * 100 : 0;

  const colCount = 4
    + (showCost ? 4 : 0)
    + (showSell ? 4 : 0)
    + (side === 'both' ? 2 : 0)
    + 2;

  const heading = title
    || (side === 'cost' ? 'Cost Charges' : side === 'revenue' ? 'Revenue Charges' : 'Charges');

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{heading}</h3>
          <span className="text-xs text-slate-500">
            {lines.length} line{lines.length === 1 ? '' : 's'}
          </span>
          {legLabel && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
              {legLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={recalculate}
            disabled={busy || !lines.length}
            title={lines.length
              ? 'Recompute every quantity from the cargo figures and reprice'
              : 'Add a charge before repricing'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <RefreshCw size={13} /> Recalculate
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!lines.length}
            title={lines.length ? 'Export these charges to CSV' : 'Nothing to export yet'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={13} /> Export
          </button>
          {parentType !== 'quote' && !readOnly && (
            <button
              type="button"
              onClick={copyFromQuote}
              disabled={busy}
              title="Copy the charges from a quotation onto this record"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Copy size={13} /> From Quote
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={startAdd}
              disabled={busy || adding}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Plus size={13} /> Add a line
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Charge</th>
              <th className="px-3 py-2 text-left font-semibold">Basis</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              {showCost && <>
                <th className="px-3 py-2 text-left font-semibold">Buy Cur.</th>
                <th className="px-3 py-2 text-right font-semibold">Buy Rate</th>
                <th className="px-3 py-2 text-left font-semibold">Vendor</th>
                <th className="px-3 py-2 text-right font-semibold">Total Cost</th>
              </>}
              {showSell && <>
                <th className="px-3 py-2 text-left font-semibold">Sell Cur.</th>
                <th className="px-3 py-2 text-right font-semibold">Sell Rate</th>
                <th className="px-3 py-2 text-left font-semibold">Customer</th>
                <th className="px-3 py-2 text-right font-semibold">Total Sell</th>
              </>}
              {side === 'both' && <>
                <th className="px-3 py-2 text-right font-semibold">Margin</th>
                <th className="px-3 py-2 text-right font-semibold">%</th>
              </>}
              <th className="px-3 py-2 text-left font-semibold">Billing</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={colCount} className="px-3 py-6 text-center text-slate-400">
                Loading charges…
              </td></tr>
            )}

            {!loading && !lines.length && !adding && (
              <tr><td colSpan={colCount} className="px-3 py-8 text-center text-slate-400">
                No charges yet.
                {!readOnly && ' Use "Add a line" to price this record.'}
              </td></tr>
            )}

            {!loading && lines.map((l) => (
              editingId === l.id ? (
                <EditRow
                  key={l.id}
                  draft={draft}
                  setField={setField}
                  showCost={showCost}
                  showSell={showSell}
                  side={side}
                  partners={partners}
                  colCount={colCount}
                  busy={busy}
                  onSave={save}
                  onCancel={cancelEdit}
                />
              ) : (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-500">{l.chargeCode || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{l.chargeDescription}</div>
                    {l.modeTypeSequence && (
                      <div className="text-[10px] text-slate-400">
                        Leg {l.modeTypeSequence}
                        {l.transportMode ? ` · ${l.transportMode}` : ''}
                      </div>
                    )}
                    {l.chargeSource === 'vendor_portal' && (
                      <div className="text-[10px] text-indigo-600">Rate from the vendor portal</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {l.measurementBasis || '-'}
                    {Number(l.chargeableWeight) > 0 && (
                      <span
                        className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-slate-400"
                        title={`Chargeable weight ${qty(l.chargeableWeight)} kg`}
                      >
                        <Scale size={10} />{qty(l.chargeableWeight)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{qty(l.quantity)}</td>

                  {showCost && <>
                    <td className="px-3 py-2 text-slate-500">{l.costCurrency || currency}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(l.costAmountRate)}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">
                      {l.creditor ? (l.creditor.companyName || l.creditor.name) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(l.totalCostAmount, currency)}
                    </td>
                  </>}

                  {showSell && <>
                    <td className="px-3 py-2 text-slate-500">{l.sellCurrency || currency}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(l.sellAmountRate)}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">
                      {l.debtor ? (l.debtor.companyName || l.debtor.name) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(l.totalSellAmount, currency)}
                    </td>
                  </>}

                  {side === 'both' && <>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                      Number(l.estimatedMargin) < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                    >
                      {money(l.estimatedMargin, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {Number(l.estimatedMarginPercentage || 0).toFixed(1)}%
                      {Number(l.estimatedMargin) < 0 && (
                        <AlertTriangle
                          size={11}
                          className="inline ml-1 text-red-500"
                          title="This charge is being sold below cost"
                        />
                      )}
                    </td>
                  </>}

                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      BILLING_STYLES[l.billingStatus] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {BILLING_LABELS[l.billingStatus] || l.billingStatus}
                    </span>
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {readOnly ? (
                      <span className="text-slate-300 text-[10px]">Read only</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(l)}
                          title="Edit this charge"
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(l)}
                          disabled={l.billingStatus !== 'no'}
                          title={l.billingStatus === 'no'
                            ? 'Delete this charge'
                            : `Already ${BILLING_LABELS[l.billingStatus]} — raise a credit note instead`}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            ))}

            {adding && (
              <EditRow
                draft={draft}
                setField={setField}
                showCost={showCost}
                showSell={showSell}
                side={side}
                partners={partners}
                colCount={colCount}
                busy={busy}
                onSave={save}
                onCancel={cancelEdit}
              />
            )}
          </tbody>

          {!!lines.length && (
            <tfoot className="bg-slate-50 font-semibold text-slate-800">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                {showCost && (
                  <td colSpan={4} className="px-3 py-2 text-right tabular-nums">
                    {money(totalCost, currency)}
                  </td>
                )}
                {showSell && (
                  <td colSpan={4} className="px-3 py-2 text-right tabular-nums">
                    {money(totalSell, currency)}
                  </td>
                )}
                {side === 'both' && (
                  <>
                    <td className={`px-3 py-2 text-right tabular-nums ${
                      margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                    >
                      {money(margin, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {marginPct.toFixed(1)}%
                    </td>
                  </>
                )}
                <td colSpan={2} className="px-3 py-2 text-right text-[10px] font-normal text-slate-500">
                  {totals ? 'Totals include tax where applicable' : ''}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// The inline editor. Kept in the same file because it only ever edits a
// charge line and exists purely to serve the grid above it.
const EditRow = ({
  draft, setField, showCost, showSell, side, partners, colCount, busy, onSave, onCancel,
}) => (
  <tr className="bg-blue-50/40">
    <td colSpan={colCount} className="px-3 py-3">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Field label="Code">
          <input
            value={draft.chargeCode || ''}
            onChange={setField('chargeCode')}
            placeholder="OFR"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          />
        </Field>
        <Field label="Charge" wide>
          <input
            value={draft.chargeDescription || ''}
            onChange={setField('chargeDescription')}
            placeholder="Ocean Freight"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          />
        </Field>
        <Field label="Measurement basis">
          <select
            value={draft.measurementBasis || ''}
            onChange={setField('measurementBasis')}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          >
            <option value="">Fixed quantity</option>
            {MEASUREMENT_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field
          label="Quantity"
          hint={draft.measurementBasis
            ? 'Recomputed from the cargo figures on save'
            : 'Entered by hand'}
        >
          <input
            type="number"
            step="0.001"
            value={draft.quantity ?? ''}
            onChange={setField('quantity')}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
          />
        </Field>

        {showCost && <>
          <Field label="Buy currency">
            <select
              value={draft.costCurrency || 'AED'}
              onChange={setField('costCurrency')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Buy rate">
            <input
              type="number"
              step="0.0001"
              value={draft.costAmountRate ?? ''}
              onChange={setField('costAmountRate')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
            />
          </Field>
          <Field label="FX to company currency">
            <input
              type="number"
              step="0.000001"
              value={draft.costConversionRate ?? 1}
              onChange={setField('costConversionRate')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
            />
          </Field>
          <Field label="Vendor (creditor)">
            <select
              value={draft.creditorPartnerId || ''}
              onChange={setField('creditorPartnerId')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              <option value="">Not set</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.companyName || p.name}</option>
              ))}
            </select>
          </Field>
        </>}

        {showSell && <>
          <Field label="Sell currency">
            <select
              value={draft.sellCurrency || 'AED'}
              onChange={setField('sellCurrency')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field
            label="Sell rate"
            hint={draft.useMargin ? 'Derived from the buy rate and margin' : undefined}
          >
            <input
              type="number"
              step="0.0001"
              value={draft.sellAmountRate ?? ''}
              onChange={setField('sellAmountRate')}
              disabled={!!draft.useMargin}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right disabled:bg-slate-100"
            />
          </Field>
          <Field label="FX to company currency">
            <input
              type="number"
              step="0.000001"
              value={draft.sellConversionRate ?? 1}
              onChange={setField('sellConversionRate')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
            />
          </Field>
          <Field label="Customer (debtor)">
            <select
              value={draft.debtorPartnerId || ''}
              onChange={setField('debtorPartnerId')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              <option value="">Not set</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.companyName || p.name}</option>
              ))}
            </select>
          </Field>
        </>}

        {side === 'both' && <>
          <Field label="Price from margin">
            <label className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <input
                type="checkbox"
                checked={!!draft.useMargin}
                onChange={setField('useMargin')}
              />
              <span className="text-slate-600">Derive the sell rate</span>
            </label>
          </Field>
          <Field label="Margin type">
            <select
              value={draft.marginType || 'percentage'}
              onChange={setField('marginType')}
              disabled={!draft.useMargin}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100"
            >
              <option value="percentage">Percentage</option>
              <option value="amount">Fixed amount</option>
            </select>
          </Field>
          <Field label={draft.marginType === 'amount' ? 'Margin amount' : 'Margin %'}>
            <input
              type="number"
              step="0.01"
              value={draft.marginType === 'amount'
                ? (draft.marginAmount ?? '')
                : (draft.marginPercentage ?? '')}
              onChange={setField(draft.marginType === 'amount' ? 'marginAmount' : 'marginPercentage')}
              disabled={!draft.useMargin}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right disabled:bg-slate-100"
            />
          </Field>
        </>}

        <Field label="Remarks" wide>
          <input
            value={draft.remarks || draft.sellRemarks || ''}
            onChange={setField(side === 'cost' ? 'costRemarks' : 'sellRemarks')}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <X size={13} /> Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Save size={13} /> {busy ? 'Saving…' : 'Save charge'}
        </button>
      </div>
    </td>
  </tr>
);

const Field = ({ label, hint, wide, children }) => (
  <div className={wide ? 'col-span-2' : ''}>
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

export default ChargeLinesPanel;
