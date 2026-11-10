import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Ship, Plane, Truck, Train, Package, ChevronUp, ChevronDown,
  Save, X, ArrowRight, Pencil, ExternalLink, Repeat, Thermometer, Flame, Maximize2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quoteLegsAPI, portsAPI, carriersAPI } from '../services/api';
import ChargeLinesPanel from './ChargeLinesPanel';

// Multimodal routing on a quotation.
//
// One quote number, several carriage legs: "truck to Jebel Ali, ocean to Nhava
// Sheva, truck to Gandhinagar" is three legs. Each leg has its own mode,
// route, carrier, cargo and charges; the quote header shows the first leg's
// origin and the last leg's destination, and the transit time is the sum.
//
// The order of carriage matters, so the up/down controls renumber the legs on
// the server rather than only moving them on screen.

const MODES = [
  { value: 'ROAD', label: 'Road', icon: Truck },
  { value: 'SEA', label: 'Sea', icon: Ship },
  { value: 'AIR', label: 'Air', icon: Plane },
  { value: 'RAIL', label: 'Rail', icon: Train },
  { value: 'COURIER', label: 'Courier', icon: Package },
];

const SHIPMENT_TYPES = {
  SEA: ['FCL', 'LCL', 'BREAKBULK', 'RORO', 'BULK'],
  AIR: ['Air Freight'],
  ROAD: ['FTL', 'LTL'],
  RAIL: ['FCL', 'LCL'],
  COURIER: ['Courier'],
};

const LOCATION_TYPES = ['Factory', 'Warehouse', 'Port', 'Airport', 'Rail Terminal', 'Door', 'CFS', 'Yard'];

const iconFor = (mode) => (MODES.find((m) => m.value === mode) || MODES[1]).icon;

const money = (v, currency = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const blankLeg = (mode = 'SEA') => ({
  transportMode: mode,
  shipmentType: SHIPMENT_TYPES[mode]?.[0] || '',
  originCountry: '',
  originLocation: '',
  originPortId: '',
  destinationCountry: '',
  destinationLocation: '',
  destinationPortId: '',
  pickupLocationType: '',
  deliveryLocationType: '',
  carrierId: '',
  transitDays: 1,
  grossWeight: '',
  volume: '',
  containerCount: '',
  truckCount: '',
  transshipment: false,
  transshipmentPort: '',
  isDangerousGood: false,
  isTemperatureControl: false,
  isOutOfGauge: false,
  remarks: '',
});

const QuoteLegsPanel = ({ quotationId, quoteStatus, currency = 'AED', partners = [], onChanged }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [routing, setRouting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [openLegId, setOpenLegId] = useState(null);
  const [ports, setPorts] = useState([]);
  const [carriers, setCarriers] = useState([]);

  const load = useCallback(async () => {
    if (!quotationId) return;
    setLoading(true);
    try {
      const [legsRes, routeRes] = await Promise.all([
        quoteLegsAPI.getAll(quotationId),
        quoteLegsAPI.routing(quotationId),
      ]);
      setData(legsRes.data?.data || null);
      setRouting(routeRes.data?.data || null);
    } catch (err) {
      if (err.response?.status !== 403) {
        toast.error(err.response?.data?.message || 'Could not load the routing');
      }
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => { load(); }, [load]);

  // Ports and carriers are only needed once the user starts editing a leg.
  useEffect(() => {
    if (!draft || ports.length) return;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          portsAPI.getAll({ limit: 'all' }),
          carriersAPI.getAll({ limit: 'all' }),
        ]);
        const unwrap = (r) => {
          const d = r.data?.data;
          return Array.isArray(d) ? d : (d?.ports || d?.carriers || d?.rows || []);
        };
        setPorts(unwrap(p));
        setCarriers(unwrap(c));
      } catch {
        // The leg can still be saved with free-text locations.
      }
    })();
  }, [draft, ports.length]);

  const legs = data?.legs || [];
  const editable = !['converted', 'cancelled', 'expired'].includes(quoteStatus);

  const refresh = async () => {
    await load();
    if (onChanged) onChanged();
  };

  const enable = async () => {
    setBusy(true);
    try {
      const res = await quoteLegsAPI.enable(quotationId);
      toast.success(res.data?.message || 'Multimodal routing enabled');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not enable multimodal routing');
    } finally {
      setBusy(false);
    }
  };

  const startAdd = () => { setDraft(blankLeg()); setEditingId(null); };
  const startEdit = (leg) => { setDraft({ ...leg }); setEditingId(leg.id); };
  const cancel = () => { setDraft(null); setEditingId(null); };

  const setField = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((d) => {
      const next = { ...d, [field]: v };
      // Changing the mode invalidates the shipment type, so it is reset to
      // one that belongs to the new mode rather than left wrong.
      if (field === 'transportMode') {
        next.shipmentType = SHIPMENT_TYPES[v]?.[0] || '';
      }
      return next;
    });
  };

  const save = async () => {
    if (!draft.transportMode) { toast.error('Choose a transport mode for the leg'); return; }
    setBusy(true);
    try {
      const payload = {
        ...draft,
        transitDays: Number(draft.transitDays) || 0,
        grossWeight: draft.grossWeight === '' ? null : Number(draft.grossWeight),
        volume: draft.volume === '' ? null : Number(draft.volume),
        containerCount: draft.containerCount === '' ? null : Number(draft.containerCount),
        truckCount: draft.truckCount === '' ? null : Number(draft.truckCount),
        originPortId: draft.originPortId || null,
        destinationPortId: draft.destinationPortId || null,
        carrierId: draft.carrierId || null,
      };
      if (editingId) {
        await quoteLegsAPI.update(editingId, payload);
        toast.success('Leg updated');
      } else {
        await quoteLegsAPI.create(quotationId, payload);
        toast.success('Leg added');
      }
      cancel();
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the leg');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (leg) => {
    const ok = window.confirm(
      `Remove leg ${leg.legSequence} (${leg.transportMode})?\n\n`
      + `${leg.originLocation || leg.originCountry || '?'} to `
      + `${leg.destinationLocation || leg.destinationCountry || '?'}\n`
      + `${leg.chargeCount || 0} charge line(s) on this leg will be deleted too.\n\n`
      + 'This cannot be undone.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await quoteLegsAPI.delete(leg.id);
      toast.success('Leg removed');
      if (openLegId === leg.id) setOpenLegId(null);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the leg');
    } finally {
      setBusy(false);
    }
  };

  const move = async (index, delta) => {
    const next = [...legs];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      await quoteLegsAPI.reorder(quotationId, next.map((l) => l.id));
      toast.success('Legs reordered');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reorder the legs');
    } finally {
      setBusy(false);
    }
  };

  const convert = async (leg) => {
    const ok = window.confirm(
      `Create a house shipment from leg ${leg.legSequence} (${leg.transportMode})?\n\n`
      + 'Its route, cargo and charges will be copied onto the new shipment.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await quoteLegsAPI.convertToShipment(leg.id, {});
      toast.success(res.data?.message || 'Shipment created');
      await refresh();
      const job = res.data?.data?.shipment;
      if (job?.id) navigate(`/admin/house-shipments/${job.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create the shipment');
    } finally {
      setBusy(false);
    }
  };

  const portOptions = useMemo(
    () => ports.map((p) => ({ id: p.id, label: `${p.name} (${p.code})` })),
    [ports],
  );

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-8 text-center text-slate-400 text-sm">
        Loading the routing…
      </div>
    );
  }

  // A single-mode quote: offer to split it into legs rather than showing an
  // empty grid.
  if (!legs.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-8 text-center">
        <Repeat className="mx-auto mb-3 text-slate-300" size={28} />
        <h3 className="text-sm font-semibold text-slate-800">Single-mode quotation</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
          This quotation carries one route. Enabling multimodal routing turns that
          route into leg 1 and lets you add further legs, each with its own
          carrier, schedule and charges, under this same quote number.
        </p>
        <button
          type="button"
          onClick={enable}
          disabled={busy || !editable}
          title={editable
            ? 'Turn the current routing into leg 1'
            : `A ${quoteStatus} quotation cannot be restructured`}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Plus size={14} /> Enable multimodal routing
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Route summary */}
      {routing && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-800">{routing.origin || '?'}</span>
            {routing.legs.map((l) => {
              const Icon = iconFor(l.transportMode);
              return (
                <React.Fragment key={l.legSequence}>
                  <ArrowRight size={12} className="text-slate-300" />
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                    title={`Leg ${l.legSequence}: ${l.transportMode}, ${l.transitDays} day(s)`}
                  >
                    <Icon size={12} /> {l.transitDays}d
                  </span>
                  <ArrowRight size={12} className="text-slate-300" />
                  <span className="text-slate-600">{l.to || '?'}</span>
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-slate-500">
            <span><strong className="text-slate-700">{routing.legs.length}</strong> legs</span>
            <span><strong className="text-slate-700">{routing.totalTransitDays}</strong> days total transit</span>
            <span><strong className="text-slate-700">{routing.carrierChanges}</strong> carrier(s)</span>
            {routing.transshipments > 0 && (
              <span className="text-amber-700">
                <strong>{routing.transshipments}</strong> transshipment(s)
              </span>
            )}
            <span>Cost <strong className="text-slate-700">{money(routing.totals.cost, currency)}</strong></span>
            <span>Revenue <strong className="text-slate-700">{money(routing.totals.revenue, currency)}</strong></span>
            <span className={routing.totals.margin < 0 ? 'text-red-600' : 'text-emerald-700'}>
              Margin <strong>{money(routing.totals.margin, currency)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Legs */}
      {legs.map((leg, i) => {
        const Icon = iconFor(leg.transportMode);
        const open = openLegId === leg.id;
        return (
          <div key={leg.id} className="bg-white border border-slate-200 rounded-lg">
            <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busy || !editable}
                    title={i === 0 ? 'Already the first leg' : 'Move this leg earlier'}
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">{leg.legSequence}</span>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === legs.length - 1 || busy || !editable}
                    title={i === legs.length - 1 ? 'Already the last leg' : 'Move this leg later'}
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {leg.originLocation || leg.originCountry || '?'}
                      <ArrowRight size={12} className="inline mx-1 text-slate-300" />
                      {leg.destinationLocation || leg.destinationCountry || '?'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {leg.transportMode}{leg.shipmentType ? ` · ${leg.shipmentType}` : ''}
                    </span>
                    {leg.isConverted && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                        Converted
                      </span>
                    )}
                    {leg.transshipment && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium"
                        title={leg.transshipmentPort || 'Transshipment on this leg'}
                      >
                        Transshipment
                      </span>
                    )}
                    {leg.isDangerousGood && (
                      <Flame size={12} className="text-red-500" title="Dangerous goods on this leg" />
                    )}
                    {leg.isTemperatureControl && (
                      <Thermometer size={12} className="text-sky-500" title={leg.temperatureDetails || 'Temperature controlled'} />
                    )}
                    {leg.isOutOfGauge && (
                      <Maximize2 size={12} className="text-orange-500" title={leg.outOfGaugeDetails || 'Out of gauge'} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">
                    <span>{leg.carrier ? leg.carrier.name : 'No carrier'}</span>
                    <span>{leg.transitDays || 0} day(s)</span>
                    {Number(leg.chargeableWeight) > 0 && (
                      <span title={`Basis: ${leg.chargeableBasis || 'weight'}`}>
                        {Number(leg.chargeableWeight).toLocaleString()} kg chargeable
                      </span>
                    )}
                    <span>{leg.chargeCount || 0} charge(s)</span>
                    <span className={Number(leg.estimatedMargin) < 0 ? 'text-red-600' : ''}>
                      Margin {money(leg.estimatedMargin, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpenLegId(open ? null : leg.id)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {open ? 'Hide charges' : 'Charges'}
                </button>
                {leg.actions?.convertToShipment && (
                  <button
                    type="button"
                    onClick={() => convert(leg)}
                    disabled={busy}
                    title="Create a house shipment from this leg"
                    className="px-2.5 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Create shipment
                  </button>
                )}
                {leg.convertedShipmentId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/house-shipments/${leg.convertedShipmentId}`)}
                    title="Open the shipment created from this leg"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink size={12} /> Shipment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(leg)}
                  disabled={busy || leg.isConverted || !editable}
                  title={leg.isConverted
                    ? 'Converted legs are changed on the shipment'
                    : 'Edit this leg'}
                  className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(leg)}
                  disabled={busy || leg.isConverted || legs.length <= 1 || !editable}
                  title={leg.isConverted
                    ? 'A converted leg cannot be removed'
                    : legs.length <= 1
                      ? 'A multimodal quotation needs at least one leg'
                      : 'Remove this leg'}
                  className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {open && (
              <div className="px-4 pb-4">
                <ChargeLinesPanel
                  parentType="quote"
                  parentId={quotationId}
                  side="both"
                  currency={currency}
                  legId={leg.id}
                  legLabel={`Leg ${leg.legSequence} · ${leg.transportMode}`}
                  partners={partners}
                  readOnly={!editable || leg.isConverted}
                  title={`Leg ${leg.legSequence} charges`}
                  onTotalsChange={refresh}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Charges not tied to a leg */}
      {!!data?.unassignedCharges?.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          {data.unassignedCharges.length} charge(s) on this quotation are not attached
          to any leg. They still count towards the quote total but will not be copied
          when a leg is converted to a shipment.
        </div>
      )}

      {/* Add / edit a leg */}
      {draft ? (
        <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-800 mb-3">
            {editingId ? 'Edit leg' : 'Add a leg'}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Transport mode">
              <select
                value={draft.transportMode}
                onChange={setField('transportMode')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Shipment type">
              <select
                value={draft.shipmentType || ''}
                onChange={setField('shipmentType')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                <option value="">Not set</option>
                {(SHIPMENT_TYPES[draft.transportMode] || []).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Carrier">
              <select
                value={draft.carrierId || ''}
                onChange={setField('carrierId')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                <option value="">Not set</option>
                {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Transit days">
              <input
                type="number"
                min="0"
                value={draft.transitDays ?? ''}
                onChange={setField('transitDays')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
              />
            </Field>

            <Field label="From country">
              <input
                value={draft.originCountry || ''}
                onChange={setField('originCountry')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              />
            </Field>
            <Field label="From location">
              <input
                value={draft.originLocation || ''}
                onChange={setField('originLocation')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              />
            </Field>
            <Field label="From port / airport">
              <select
                value={draft.originPortId || ''}
                onChange={setField('originPortId')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                <option value="">Not a port leg</option>
                {portOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Pickup location type">
              <select
                value={draft.pickupLocationType || ''}
                onChange={setField('pickupLocationType')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                <option value="">Not set</option>
                {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="To country">
              <input
                value={draft.destinationCountry || ''}
                onChange={setField('destinationCountry')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              />
            </Field>
            <Field label="To location">
              <input
                value={draft.destinationLocation || ''}
                onChange={setField('destinationLocation')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              />
            </Field>
            <Field label="To port / airport">
              <select
                value={draft.destinationPortId || ''}
                onChange={setField('destinationPortId')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                <option value="">Not a port leg</option>
                {portOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Delivery location type">
              <select
                value={draft.deliveryLocationType || ''}
                onChange={setField('deliveryLocationType')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              >
                <option value="">Not set</option>
                {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Gross weight (kg)" hint="Blank keeps the quote's figure">
              <input
                type="number"
                step="0.001"
                value={draft.grossWeight ?? ''}
                onChange={setField('grossWeight')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
              />
            </Field>
            <Field label="Volume (m3)">
              <input
                type="number"
                step="0.001"
                value={draft.volume ?? ''}
                onChange={setField('volume')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
              />
            </Field>
            <Field label="Containers">
              <input
                type="number"
                min="0"
                value={draft.containerCount ?? ''}
                onChange={setField('containerCount')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
              />
            </Field>
            <Field label="Trucks">
              <input
                type="number"
                min="0"
                value={draft.truckCount ?? ''}
                onChange={setField('truckCount')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
              />
            </Field>

            <Field label="Special handling" wide>
              <div className="flex flex-wrap gap-4 px-1 py-1.5 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!draft.isDangerousGood} onChange={setField('isDangerousGood')} />
                  <span className="text-slate-600">Dangerous goods</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!draft.isTemperatureControl} onChange={setField('isTemperatureControl')} />
                  <span className="text-slate-600">Temperature controlled</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!draft.isOutOfGauge} onChange={setField('isOutOfGauge')} />
                  <span className="text-slate-600">Out of gauge</span>
                </label>
              </div>
            </Field>
            <Field label="Transshipment">
              <label className="flex items-center gap-1.5 px-1 py-1.5 text-xs">
                <input type="checkbox" checked={!!draft.transshipment} onChange={setField('transshipment')} />
                <span className="text-slate-600">Carrier changes mid-route</span>
              </label>
            </Field>
            <Field label="Transshipment port">
              <input
                value={draft.transshipmentPort || ''}
                onChange={setField('transshipmentPort')}
                disabled={!draft.transshipment}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100"
              />
            </Field>

            <Field label="Remarks" wide>
              <input
                value={draft.remarks || ''}
                onChange={setField('remarks')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
              />
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
              <Save size={13} /> {busy ? 'Saving…' : (editingId ? 'Save leg' : 'Add leg')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          disabled={busy || !editable}
          title={editable ? 'Add another carriage leg' : `A ${quoteStatus} quotation cannot take new legs`}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded border-2 border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40"
        >
          <Plus size={14} /> Add a leg
        </button>
      )}
    </div>
  );
};

const Field = ({ label, hint, wide, children }) => (
  <div className={wide ? 'col-span-2' : ''}>
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

export default QuoteLegsPanel;
