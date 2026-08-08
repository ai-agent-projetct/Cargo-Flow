import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { freightBookingsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';
import {
  AIR_STATUS, SEA_STATUS, AIR_STATUSBAR, SEA_STATUSBAR, statusLabel, statusKey,
  PAYMENT_TERMS, INCOTERMS, SERVICE_MODES, SHIPMENT_TYPES, CARGO_TYPES,
  CARGO_COLUMNS, FLIGHT_COLUMNS, WEIGHT_TYPES, fmtDate, fmtDateTime, toLocalInput, fmtNum,
} from './constants';

const BLANK = {
  transportCode: 'AIR', airStatus: 'created', status: 'init',
  transportMode: '[AIR] Air Freight', cargoLines: [], flightLines: [], activityLog: [],
};

// A titled block with the demo's blue heading and underline.
const Section = ({ title, children, className = '' }) => (
  <div className={className}>
    <h3 className="text-lg font-semibold text-blue-700 border-b border-gray-300 pb-1 mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[10rem_1fr] items-start gap-3">
    <label className="text-sm font-semibold text-gray-700 pt-1">{label}</label>
    <div className="min-w-0 border-l border-gray-200 pl-4">{children}</div>
  </div>
);

const inputCls = 'w-full text-sm px-1 py-0.5 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';
const linkCls = 'text-sm text-blue-700';

const FreightBookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [rec, setRec] = useState(isNew ? BLANK : null);
  const [draft, setDraft] = useState(isNew ? BLANK : null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [tab, setTab] = useState('Cargo Details');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setEditing(isNew);
    setTab('Cargo Details');
    setCancelOpen(false);
    if (isNew) { setRec(BLANK); setDraft(BLANK); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await freightBookingsAPI.getById(id);
      setRec(res.data.data);
      setDraft(res.data.data);
    } catch {
      toast.error('Booking not found');
      navigate('/admin/freight-bookings');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading || !rec) return <PageLoader />;

  const view = editing ? draft : rec;
  const readOnly = !editing;
  const a = rec.actions || {};
  const air = view.transportCode === 'AIR';
  const bar = air ? AIR_STATUSBAR : SEA_STATUSBAR;
  const labels = air ? AIR_STATUS : SEA_STATUS;
  const current = statusKey(view);
  // A terminal state replaces the last step rather than adding a chevron.
  const steps = bar.includes(current) ? bar : [...bar.slice(0, -1), current];

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const lines = view.cargoLines || [];
  const flights = view.flightLines || [];

  const setLine = (i, key, value) =>
    set({ cargoLines: lines.map((l, x) => (x === i ? { ...l, [key]: value } : l)) });

  const addLine = () => set({
    cargoLines: [...lines, {
      commodity: '[GCR] General Cargo', quantity: 1, weight: 1, volume: 1, chargeableWeight: 0,
      height: 10, length: 10, width: 10, stackable: false, tillable: false, topLoadable: false,
      weightType: 'total',
    }],
  });

  const removeLine = (i) => set({ cargoLines: lines.filter((_, x) => x !== i) });

  // Every workflow call adopts the returned booking so the buttons re-derive.
  const run = async (fn, okMsg) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fn();
      const next = res.data.data.booking || res.data.data;
      setRec(next);
      setDraft(next);
      setEditing(false);
      toast.success(okMsg);
      return res;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await freightBookingsAPI.create(draft);
        toast.success('Booking created');
        navigate(`/admin/freight-bookings/${res.data.data.id}`);
      } else {
        const res = await freightBookingsAPI.update(id, draft);
        setRec(res.data.data); setDraft(res.data.data); setEditing(false);
        toast.success('Booking saved');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const btn = 'px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded disabled:opacity-50';

  return (
    <div className="px-6 pb-6">
      {/* Breadcrumb + pager */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/admin/freight-bookings')} className="text-blue-700 hover:underline">Bookings</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">{isNew ? 'New' : rec.bookingReference}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Header: buttons left, statusbar right */}
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <button onClick={save} disabled={busy} className={btn}>Save</button>
              <button
                onClick={() => { if (isNew) navigate('/admin/freight-bookings'); else { setDraft(rec); setEditing(false); } }}
                className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
              >Discard</button>
            </>
          ) : (
            <>
              {a.edit && <button onClick={() => setEditing(true)} className={btn}>Edit</button>}

              {/* AIR */}
              {a.directBook && <button onClick={() => run(() => freightBookingsAPI.directBook(id), 'Direct booking placed')} disabled={busy} className={btn}>Direct Book</button>}
              {a.bookNow && <button onClick={() => run(() => freightBookingsAPI.bookNow(id), 'Booking placed')} disabled={busy} className={btn}>Book Now</button>}
              {a.cancelBookingAir && <button onClick={() => setCancelOpen(true)} disabled={busy} className={btn}>Cancel Booking</button>}
              {a.checkStatusAir && <button onClick={() => run(() => freightBookingsAPI.checkStatus(id), 'Status refreshed')} disabled={busy} className={btn}>Check Status</button>}
              {a.createHouseShipment && (
                <button
                  onClick={async () => {
                    const r = await run(() => freightBookingsAPI.createHouseShipment(id), 'House shipment created');
                    if (r) toast.success(`Job ${r.data.data.shipment.jobNumber} created`);
                  }}
                  disabled={busy} className={btn}
                >Create House Shipment</button>
              )}
              {a.createMasterShipment && (
                <button
                  onClick={async () => {
                    const r = await run(() => freightBookingsAPI.createMasterShipment(id), 'Master shipment created');
                    if (r) toast.success(`Master ${r.data.data.shipment.masterShipmentNumber} created`);
                  }}
                  disabled={busy} className={btn}
                >Create Master Shipment</button>
              )}

              {/* SEA */}
              {a.book && <button onClick={() => run(() => freightBookingsAPI.book(id), 'Booking sent to carrier')} disabled={busy} className={btn}>Book</button>}
              {a.checkStatusSea && <button onClick={() => run(() => freightBookingsAPI.checkStatusSea(id), 'Status refreshed')} disabled={busy} className={btn}>Check Status</button>}
              {a.updateBooking && <button onClick={() => run(() => freightBookingsAPI.updateBooking(id), 'Booking updated')} disabled={busy} className={btn}>Update Booking</button>}
              {a.cancelBookingSea && <button onClick={() => setCancelOpen(true)} disabled={busy} className={btn}>Cancel Booking</button>}
              {a.searchFreightSea && <button onClick={() => run(() => freightBookingsAPI.searchFreight(id), 'Freight search complete')} disabled={busy} className={btn}>Search Freight</button>}
              {a.amendDetails && <button onClick={() => run(() => freightBookingsAPI.amend(id), 'Amendment submitted')} disabled={busy} className={btn}>Update Booking</button>}
            </>
          )}
        </div>

        {/* Statusbar */}
        <div className="flex items-center">
          {steps.map((s, i) => {
            const active = s === current;
            return (
              <span
                key={s}
                className={`px-4 py-1.5 text-sm relative ${
                  active ? 'bg-blue-700 text-white font-medium' : 'bg-white text-gray-600 border-y border-gray-300'
                } ${i === 0 ? 'border-l rounded-l' : ''} ${i === steps.length - 1 ? 'border-r rounded-r' : ''}`}
              >
                {labels[s] || s}
              </span>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {/* Provider status pill */}
        {view.providerStatus && (
          <div className="flex justify-end mb-2">
            <span className="px-3 py-1 rounded bg-cyan-100 text-cyan-900 text-sm">{view.providerStatus}</span>
          </div>
        )}

        <p className="text-sm font-semibold text-gray-700">Booking Reference</p>
        {editing && isNew ? (
          <input value={view.bookingReference || ''} onChange={(e) => set({ bookingReference: e.target.value })}
            placeholder="auto-generated" className="text-3xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-600 focus:outline-none py-1 mb-6" />
        ) : (
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{rec.bookingReference}</h1>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
          <Section title="Basic Details">
            <Field label="Booking Number"><span className="text-sm text-gray-800">{view.bookingNumber || ''}</span></Field>
            <Field label="Payment Terms">
              <select disabled={readOnly} value={view.paymentTerms || ''} onChange={(e) => set({ paymentTerms: e.target.value })} className={inputCls}>
                <option value="" />
                {PAYMENT_TERMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Incoterms">
              {readOnly ? <span className={linkCls}>{view.incoterm || ''}</span> : (
                <select value={view.incoterm || ''} onChange={(e) => set({ incoterm: e.target.value })} className={inputCls}>
                  <option value="" />{INCOTERMS.map((i) => <option key={i}>{i}</option>)}
                </select>
              )}
            </Field>
            <Field label="Company"><span className={linkCls}>{view.company || ''}</span></Field>
          </Section>

          <Section title="Transport Details">
            <Field label="Transport Mode"><span className="text-sm text-gray-800">{view.transportMode || ''}</span></Field>
            <Field label="Service Provider">
              {readOnly ? <span className={linkCls}>{view.carrier || ''}</span> : (
                <input value={view.carrier || ''} onChange={(e) => set({ carrier: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Shipping Mode">
              {readOnly ? <span className={linkCls}>{view.cargoType || ''}</span> : (
                <select value={view.cargoType || ''} onChange={(e) => set({ cargoType: e.target.value })} className={inputCls}>
                  <option value="" />{CARGO_TYPES.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </Field>
            <Field label="Assigned To">
              <span className="inline-flex items-center gap-2">
                <span className="text-sm text-gray-800">{view.assignedTo || ''}</span>
                {view.assignedToVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-600 text-white text-xs font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </span>
            </Field>
          </Section>

          <Section title={air ? 'Air Details' : 'Sea Details'}>
            {air ? (
              <>
                <Field label="AWB Number"><span className="text-sm text-gray-800">{view.trackingNumber || ''}</span></Field>
                <Field label="Airline">
                  {readOnly ? <span className="text-sm text-gray-800">{view.airline || ''}</span> : (
                    <input value={view.airline || ''} onChange={(e) => set({ airline: e.target.value })} className={inputCls} />
                  )}
                </Field>
                <Field label="Flight No">
                  {readOnly ? <span className="text-sm text-gray-800">{view.flightNo || ''}</span> : (
                    <input value={view.flightNo || ''} onChange={(e) => set({ flightNo: e.target.value })} className={inputCls} />
                  )}
                </Field>
              </>
            ) : (
              <>
                <Field label="MBL Number"><span className="text-sm text-gray-800">{view.trackingNumber || ''}</span></Field>
                <Field label="Vessel">
                  {readOnly ? <span className="text-sm text-gray-800">{view.vessel || ''}</span> : (
                    <input value={view.vessel || ''} onChange={(e) => set({ vessel: e.target.value })} className={inputCls} />
                  )}
                </Field>
                <Field label="Voyage Number">
                  {readOnly ? <span className="text-sm text-gray-800">{view.voyageNumber || ''}</span> : (
                    <input value={view.voyageNumber || ''} onChange={(e) => set({ voyageNumber: e.target.value })} className={inputCls} />
                  )}
                </Field>
              </>
            )}
          </Section>

          <Section title="&nbsp;" className="lg:pt-0">
            <Field label="Service Mode">
              {readOnly ? <span className={linkCls}>{view.serviceMode || ''}</span> : (
                <select value={view.serviceMode || ''} onChange={(e) => set({ serviceMode: e.target.value })} className={inputCls}>
                  <option value="" />{SERVICE_MODES.map((s) => <option key={s}>{s}</option>)}
                </select>
              )}
            </Field>
            <Field label="Shipment Type">
              {readOnly ? <span className={linkCls}>{view.shipmentType || ''}</span> : (
                <select value={view.shipmentType || ''} onChange={(e) => set({ shipmentType: e.target.value })} className={inputCls}>
                  <option value="" />{SHIPMENT_TYPES.map((s) => <option key={s}>{s}</option>)}
                </select>
              )}
            </Field>
            <Field label="Cargo Type"><span className={linkCls}>{view.commodityType || ''}</span></Field>
          </Section>

          <Section title="Origin">
            <Field label="Origin">
              {readOnly ? <span className="text-sm text-gray-800">{view.origin || ''}</span> : (
                <input value={view.origin || ''} onChange={(e) => set({ origin: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Origin Port">
              {readOnly ? <span className={linkCls}>{view.originPort || ''}</span> : (
                <input value={view.originPort || ''} onChange={(e) => set({ originPort: e.target.value })} className={inputCls} />
              )}
            </Field>
          </Section>

          <Section title="Destination">
            <Field label="Destination">
              {readOnly ? <span className="text-sm text-gray-800">{view.destination || ''}</span> : (
                <input value={view.destination || ''} onChange={(e) => set({ destination: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Destination Port">
              {readOnly ? <span className={linkCls}>{view.destinationPort || ''}</span> : (
                <input value={view.destinationPort || ''} onChange={(e) => set({ destinationPort: e.target.value })} className={inputCls} />
              )}
            </Field>
            <Field label="Departure Date">
              {readOnly ? <span className="text-sm text-gray-800">{fmtDate(view.departureDate)}</span> : (
                <input type="date" value={view.departureDate ? String(view.departureDate).slice(0, 10) : ''}
                  onChange={(e) => set({ departureDate: e.target.value })} className={inputCls} />
              )}
            </Field>
            {!air && (
              <>
                <Field label="ETD">
                  {readOnly ? <span className="text-sm text-gray-800">{fmtDateTime(view.etdTime)}</span> : (
                    <input type="datetime-local" value={toLocalInput(view.etdTime)} onChange={(e) => set({ etdTime: e.target.value })} className={inputCls} />
                  )}
                </Field>
                <Field label="ETA">
                  {readOnly ? <span className="text-sm text-gray-800">{fmtDateTime(view.etaTime)}</span> : (
                    <input type="datetime-local" value={toLocalInput(view.etaTime)} onChange={(e) => set({ etaTime: e.target.value })} className={inputCls} />
                  )}
                </Field>
              </>
            )}
          </Section>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-8 mt-8">
          {[
            { title: 'Customer', name: 'client', addr: 'clientAddress' },
            { title: 'Shipper', name: 'shipper', addr: 'shipperAddress', acct: 'shipperAccountNumbers' },
            { title: 'Consignee', name: 'consignee', addr: 'consigneeAddress', acct: 'consigneeAccountNumbers' },
          ].map((p) => (
            <Section key={p.title} title={p.title}>
              <Field label={p.title}>
                {readOnly ? <span className="text-sm text-gray-800 break-words">{view[p.name] || ''}</span> : (
                  <input value={view[p.name] || ''} onChange={(e) => set({ [p.name]: e.target.value })} className={inputCls} />
                )}
              </Field>
              <Field label={`${p.title} Address`}>
                {readOnly ? <span className="text-sm text-gray-800 break-words whitespace-pre-wrap">{view[p.addr] || ''}</span> : (
                  <textarea rows={3} value={view[p.addr] || ''} onChange={(e) => set({ [p.addr]: e.target.value })}
                    className="w-full text-sm px-1 py-0.5 border border-gray-300 rounded focus:border-blue-600 focus:outline-none resize-none" />
                )}
              </Field>
              {p.acct && (
                <Field label={`${p.title} Account Numbers`}>
                  {readOnly ? <span className="text-sm text-gray-800">{view[p.acct] || ''}</span> : (
                    <input value={view[p.acct] || ''} onChange={(e) => set({ [p.acct]: e.target.value })} className={inputCls} />
                  )}
                </Field>
              )}
            </Section>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-8 border-b border-gray-200">
          {['Cargo Details', 'Cargo Charge Detail'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? 'border-blue-700 text-blue-700 font-medium' : 'border-transparent text-blue-700 hover:text-blue-900'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Cargo Details' && (
          <div className="pt-4">
            {(a.searchFreight || a.searchFreightSea) && !editing && (
              <button
                onClick={() => run(() => freightBookingsAPI.searchFreight(id), 'Freight search complete').then((r) => r && setTab('Cargo Charge Detail'))}
                disabled={busy}
                className="mb-3 flex items-center gap-2 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Search Freight
              </button>
            )}
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-300">
                  <tr>
                    {CARGO_COLUMNS.map((c) => (
                      <th key={c.key} className={`text-left px-3 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${c.width}`}>{c.label}</th>
                    ))}
                    {editing && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.length === 0 ? (
                    <tr><td colSpan={CARGO_COLUMNS.length + 1} className="text-center py-6 text-gray-400 text-xs">No cargo lines</td></tr>
                  ) : lines.map((l, i) => (
                    <tr key={i}>
                      {CARGO_COLUMNS.map((c) => (
                        <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                          {c.type === 'check' ? (
                            <input type="checkbox" disabled={readOnly} checked={!!l[c.key]}
                              onChange={(e) => setLine(i, c.key, e.target.checked)} className="rounded border-gray-300" />
                          ) : readOnly ? (
                            <span className="text-gray-800 text-xs">
                              {c.key === 'weightType'
                                ? (WEIGHT_TYPES.find((w) => w.key === l[c.key])?.label || l[c.key])
                                : c.decimals ? fmtNum(l[c.key], c.decimals) : l[c.key]}
                            </span>
                          ) : c.type === 'select' ? (
                            <select value={l[c.key] || ''} onChange={(e) => setLine(i, c.key, e.target.value)}
                              className="w-full text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-600">
                              {c.options.map((o) => (
                                <option key={o} value={o}>
                                  {c.key === 'weightType' ? (WEIGHT_TYPES.find((w) => w.key === o)?.label || o) : o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="number" value={l[c.key] ?? ''} onChange={(e) => setLine(i, c.key, Number(e.target.value))}
                              className="w-full text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-600" />
                          )}
                        </td>
                      ))}
                      {editing && (
                        <td className="px-2 py-2">
                          <button onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-600" title="Remove line">
                            <Trash2 className="w-4 h-4" />
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
          </div>
        )}

        {tab === 'Cargo Charge Detail' && (
          <div className="pt-4">
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-300">
                  <tr>
                    {FLIGHT_COLUMNS.map((c) => (
                      <th key={c.key} className="text-left px-3 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap">{c.label}</th>
                    ))}
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {flights.length === 0 ? (
                    <tr><td colSpan={FLIGHT_COLUMNS.length + 1} className="text-center py-6 text-gray-400 text-xs">
                      No rate options — run Search Freight
                    </td></tr>
                  ) : flights.map((f, i) => (
                    <tr key={i} className={i === 0 ? 'bg-blue-50' : ''}>
                      {FLIGHT_COLUMNS.map((c) => (
                        <td key={c.key} className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
                          {c.type === 'datetime' ? fmtDateTime(f[c.key]) : (f[c.key] ?? '')}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {a.bookNow && i !== 0 && (
                          <button
                            onClick={() => run(() => freightBookingsAPI.selectFlight(id, i), 'Rate selected')}
                            className="px-2 py-0.5 border border-blue-300 text-blue-700 text-[11px] rounded hover:bg-blue-50"
                          >Select</button>
                        )}
                        {i === 0 && flights.length > 0 && (
                          <span className="text-[11px] text-blue-700 font-medium">Selected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {!isNew && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl px-6 py-4">
          <OrganizationChatter
            organizationId={rec.id}
            entries={rec.activityLog || []}
            followerCount={rec.followerCount || 1}
            api={freightBookingsAPI}
            onPosted={(entry) => setRec((r) => ({ ...r, activityLog: [entry, ...(r.activityLog || [])] }))}
          />
        </div>
      )}

      {/* Cancel Booking */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Cancel Booking</h3>
              <button onClick={() => setCancelOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4">
              <label className="text-xs font-medium text-gray-600">Reason</label>
              <textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this booking being cancelled?"
                className="w-full mt-1 text-sm px-2 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-600 resize-none" />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50">Discard</button>
              <button
                onClick={async () => {
                  const fn = air ? freightBookingsAPI.cancel : freightBookingsAPI.cancelSea;
                  const r = await run(() => fn(id, { reason: cancelReason }), 'Booking cancelled');
                  if (r) { setCancelOpen(false); setCancelReason(''); }
                }}
                disabled={busy}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded disabled:opacity-50"
              >Cancel Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightBookingDetail;
