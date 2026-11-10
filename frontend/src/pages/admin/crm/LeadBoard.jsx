import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Download, RefreshCw, LayoutGrid, List, Save, X, Pencil,
  Trash2, ArrowRight, Flame, Snowflake, Thermometer, ExternalLink, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { crmAPI, portsAPI, usersAPI, masterDataAPI } from '../../../services/api';
import { exportCsv } from '../../../utils/exportCsv';

// Sales & CRM > Sales > Leads.
//
// A lead is the first record in the whole chain: the enquiry. It carries the
// lane, the commodity and the expected annual volume, which is what the sales
// target reports measure against. Once its stage allows it, Convert promotes
// it to an opportunity, carrying the lane and cargo detail across so nobody
// retypes anything.

const MODES = ['SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'];
const SHIPMENT_TYPES = ['FCL', 'LCL', 'Air Freight', 'FTL', 'LTL', 'BREAKBULK', 'RORO', 'BULK', 'Courier'];
const DIRECTIONS = ['EXPORT', 'IMPORT', 'LOCAL', 'CROSS_TRADE'];
const CATEGORY_META = {
  hot: { label: 'Hot', icon: Flame, className: 'bg-red-100 text-red-700' },
  warm: { label: 'Warm', icon: Thermometer, className: 'bg-amber-100 text-amber-700' },
  cold: { label: 'Cold', icon: Snowflake, className: 'bg-sky-100 text-sky-700' },
};
const LOCATION_TYPES = ['Factory', 'Warehouse', 'Port', 'Airport', 'Door', 'CFS', 'Yard'];

const money = (v, cur = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '-';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${cur}`;
};

const unwrap = (res) => {
  const d = res.data?.data;
  if (Array.isArray(d)) return d;
  return d?.rows || d?.users || d?.ports || [];
};

const LeadBoard = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(params.get('view') === 'board' ? 'board' : 'list');

  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [stages, setStages] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [ports, setPorts] = useState([]);
  const [sources, setSources] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(params.get('search') || '');
  const [filters, setFilters] = useState({
    status: params.get('status') || '',
    stageId: params.get('stageId') || '',
    transportMode: params.get('transportMode') || '',
    leadCategory: params.get('leadCategory') || '',
    assignedTo: params.get('assignedTo') || '',
    salesTeamId: params.get('salesTeamId') || '',
  });
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);

  // Reference data is read once; it changes far less often than the leads.
  useEffect(() => {
    (async () => {
      try {
        const [st, pr, tm, us, po, so] = await Promise.all([
          crmAPI.stages.getAll({ kind: 'lead', limit: 'all' }),
          crmAPI.prospects.getAll({ limit: 'all' }),
          crmAPI.teams.getAll({ limit: 'all' }),
          usersAPI.getAll({ limit: 'all' }),
          portsAPI.getAll({ limit: 'all' }),
          masterDataAPI.getAll('lead-source', { limit: 'all' }),
        ]);
        setStages(unwrap(st));
        setProspects(unwrap(pr));
        setTeams(unwrap(tm));
        setUsers(unwrap(us));
        setPorts(unwrap(po));
        setSources(unwrap(so));
      } catch {
        // The board still works without the lookups; the selects just show
        // fewer options.
      }
    })();
  }, []);

  const queryParams = useMemo(() => {
    const q = { limit: 'all' };
    if (search) q.search = search;
    for (const [k, v] of Object.entries(filters)) if (v) q[k] = v;
    return q;
  }, [search, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'board') {
        const res = await crmAPI.leads.kanban(queryParams);
        setColumns(res.data?.data || []);
      } else {
        const res = await crmAPI.leads.getAll(queryParams);
        setRows(res.data?.data || []);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(err.response.data?.message || 'You do not have access to leads');
      } else {
        toast.error(err.response?.data?.message || 'Could not load the leads');
      }
    } finally {
      setLoading(false);
    }
  }, [view, queryParams]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // The filters live in the URL so a filtered board can be shared or bookmarked.
  useEffect(() => {
    const next = {};
    if (view === 'board') next.view = 'board';
    if (search) next.search = search;
    for (const [k, v] of Object.entries(filters)) if (v) next[k] = v;
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search, filters]);

  const blank = () => ({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    prospectId: '',
    stageId: stages[0]?.id || '',
    leadCategory: 'warm',
    transportMode: 'SEA',
    shipmentType: 'FCL',
    direction: 'EXPORT',
    originCountry: '',
    destinationCountry: '',
    portOfLoadingId: '',
    portOfDischargeId: '',
    pickupLocationType: '',
    deliveryLocationType: '',
    commodity: '',
    leadSource: 'inbound',
    leadSourceId: '',
    expectedAnnualRevenue: '',
    annualRevenueCurrency: 'AED',
    expectedAnnualVolume: '',
    volumeUom: 'TEU',
    targetDate: '',
    assignedTo: '',
    salesTeamId: '',
    contactName: '',
    email: '',
    phone: '',
    remarks: '',
    notes: '',
  });

  const startAdd = () => { setDraft(blank()); setEditingId(null); setDetail(null); };
  const startEdit = (lead) => { setDraft({ ...lead }); setEditingId(lead.id); setDetail(null); };
  const cancel = () => { setDraft(null); setEditingId(null); };

  const setField = (name) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((d) => {
      const next = { ...d, [name]: v };
      // Picking the prospect fills the contact block, so a lead raised from
      // the prospect list opens already complete.
      if (name === 'prospectId') {
        const p = prospects.find((x) => x.id === v);
        if (p) {
          next.contactName = next.contactName || p.contactName || '';
          next.email = next.email || p.email || '';
          next.phone = next.phone || p.phone || '';
          next.originCountry = next.originCountry || p.country || '';
        }
      }
      return next;
    });
  };

  const save = async () => {
    if (!draft.name?.trim()) { toast.error('Give the enquiry a name'); return; }
    if (!draft.prospectId) { toast.error('A lead must belong to a prospect'); return; }
    setBusy(true);
    try {
      const payload = {
        ...draft,
        expectedAnnualRevenue: Number(draft.expectedAnnualRevenue) || 0,
        expectedAnnualVolume: Number(draft.expectedAnnualVolume) || 0,
        portOfLoadingId: draft.portOfLoadingId || null,
        portOfDischargeId: draft.portOfDischargeId || null,
        leadSourceId: draft.leadSourceId || null,
        assignedTo: draft.assignedTo || null,
        salesTeamId: draft.salesTeamId || null,
        targetDate: draft.targetDate || null,
      };
      if (editingId) {
        await crmAPI.leads.update(editingId, payload);
        toast.success('Lead updated');
      } else {
        const res = await crmAPI.leads.create(payload);
        toast.success(`Lead ${res.data?.data?.leadNumber || ''} created`);
      }
      cancel();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the lead');
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (lead, stageId) => {
    const stage = stages.find((s) => s.id === stageId);
    let lostReason;
    if (stage?.isLost) {
      lostReason = window.prompt(`Moving "${lead.name}" to ${stage.name}. Why was it lost?`);
      if (lostReason === null) return;
    }
    setBusy(true);
    try {
      await crmAPI.leads.setStage(lead.id, { stageId, lostReason });
      toast.success('Lead stage updated');
      await load();
      if (detail?.id === lead.id) await openDetail(lead.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not move the lead');
    } finally {
      setBusy(false);
    }
  };

  const convert = async (lead) => {
    const ok = window.confirm(
      `Convert "${lead.name}" into an opportunity?\n\n`
      + 'The lane, commodity and expected revenue will be carried across. '
      + 'The lead stays as pipeline history.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await crmAPI.leads.convert(lead.id, {});
      toast.success(res.data?.message || 'Converted');
      await load();
      const opp = res.data?.data?.opportunity;
      if (opp?.id) navigate(`/admin/opportunities?highlight=${opp.id}`);
    } catch (err) {
      // The stage gate refuses with an explanation, which is worth showing.
      toast.error(err.response?.data?.message || 'Could not convert the lead');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (lead) => {
    if (!window.confirm(`Delete lead ${lead.leadNumber}?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await crmAPI.leads.delete(lead.id);
      toast.success('Lead deleted');
      if (detail?.id === lead.id) setDetail(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete the lead');
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const res = await crmAPI.leads.getById(id);
      setDetail(res.data?.data || null);
      setDraft(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open the lead');
    }
  };

  const exportSpec = [
    { label: 'Lead', key: 'leadNumber' },
    { label: 'Enquiry', key: 'name' },
    { label: 'Date', key: 'date' },
    { label: 'Prospect', key: (r) => r.prospect?.name || '' },
    { label: 'Stage', key: (r) => r.stage?.name || '' },
    { label: 'Status', key: 'status' },
    { label: 'Category', key: 'leadCategory' },
    { label: 'Mode', key: 'transportMode' },
    { label: 'Type', key: 'shipmentType' },
    { label: 'Direction', key: 'direction' },
    { label: 'From', key: 'originCountry' },
    { label: 'To', key: 'destinationCountry' },
    { label: 'Commodity', key: 'commodity' },
    { label: 'Expected Revenue', key: 'expectedAnnualRevenue' },
    { label: 'Expected Volume', key: 'expectedAnnualVolume' },
    { label: 'Volume UoM', key: 'volumeUom' },
    { label: 'Owner', key: (r) => r.assignedUser?.name || '' },
    { label: 'Team', key: (r) => r.salesTeam?.name || '' },
  ];

  const allLeads = view === 'board' ? columns.flatMap((c) => c.leads) : rows;

  const onExport = () => {
    if (exportCsv(allLeads, exportSpec, 'leads')) toast.success(`Exported ${allLeads.length} leads`);
    else toast.error('Nothing to export');
  };

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Leads</h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Trade enquiries against your prospects. A lead becomes an opportunity
            once it reaches a stage that allows it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`px-2.5 py-1.5 text-xs font-medium ${
                view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => setView('board')}
              title="Pipeline board"
              className={`px-2.5 py-1.5 text-xs font-medium ${
                view === 'board' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <LayoutGrid size={13} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lead no., enquiry, contact, commodity…"
              className="pl-8 pr-3 py-1.5 w-64 border border-slate-300 rounded text-xs"
            />
          </div>
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
            onClick={onExport}
            disabled={!allLeads.length}
            title={allLeads.length ? 'Export what is on screen' : 'Nothing to export'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={13} /> Export
          </button>
          <button
            type="button"
            onClick={startAdd}
            disabled={!!draft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus size={13} /> New lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <Select value={filters.status} onChange={setFilter('status')} label="Any status"
          options={[['open', 'Open'], ['converted', 'Converted'], ['lost', 'Lost']]} />
        <Select value={filters.stageId} onChange={setFilter('stageId')} label="Any stage"
          options={stages.map((s) => [s.id, s.name])} />
        <Select value={filters.leadCategory} onChange={setFilter('leadCategory')} label="Any temperature"
          options={[['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold']]} />
        <Select value={filters.transportMode} onChange={setFilter('transportMode')} label="Any mode"
          options={MODES.map((m) => [m, m])} />
        <Select value={filters.salesTeamId} onChange={setFilter('salesTeamId')} label="Any team"
          options={teams.map((t) => [t.id, t.name])} />
        <Select value={filters.assignedTo} onChange={setFilter('assignedTo')} label="Any owner"
          options={users.map((u) => [u.id, u.name || u.email])} />
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={() => setFilters({
              status: '', stageId: '', transportMode: '', leadCategory: '',
              assignedTo: '', salesTeamId: '',
            })}
            className="px-2 py-1 text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {draft && (
        <LeadForm
          draft={draft}
          setField={setField}
          editingId={editingId}
          busy={busy}
          onSave={save}
          onCancel={cancel}
          stages={stages}
          prospects={prospects}
          teams={teams}
          users={users}
          ports={ports}
          sources={sources}
        />
      )}

      {detail && (
        <LeadDetail
          lead={detail}
          onClose={() => setDetail(null)}
          onEdit={() => startEdit(detail)}
          onConvert={() => convert(detail)}
          onStage={(stageId) => setStage(detail, stageId)}
          stages={stages}
          busy={busy}
          navigate={navigate}
        />
      )}

      {loading && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
          Loading leads…
        </div>
      )}

      {!loading && view === 'board' && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div key={col.stage.id || 'unstaged'} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100 rounded-t-lg">
                <span className="text-xs font-semibold text-slate-700">{col.stage.name}</span>
                <span className="text-[10px] text-slate-500">
                  {col.count} · {money(col.expectedRevenue)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-b-lg p-2 space-y-2 min-h-[120px]">
                {!col.leads.length && (
                  <p className="text-[11px] text-slate-400 text-center py-4">Empty</p>
                )}
                {col.leads.map((l) => {
                  const cat = CATEGORY_META[l.leadCategory];
                  const Icon = cat?.icon;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => openDetail(l.id)}
                      className="w-full text-left bg-white border border-slate-200 rounded-lg p-2.5 hover:border-blue-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                          {l.name}
                        </span>
                        {cat && (
                          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold ${cat.className}`}>
                            <Icon size={9} className="inline mr-0.5" />{cat.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">{l.leadNumber}</p>
                      <p className="text-[10px] text-slate-500 truncate">{l.prospect?.name}</p>
                      <div className="flex items-center justify-between mt-1.5 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {l.transportMode} {l.direction}
                        </span>
                        <span className="font-medium text-slate-700">
                          {money(l.expectedAnnualRevenue)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'list' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Lead</th>
                <th className="px-3 py-2 text-left font-semibold">Enquiry</th>
                <th className="px-3 py-2 text-left font-semibold">Prospect</th>
                <th className="px-3 py-2 text-left font-semibold">Stage</th>
                <th className="px-3 py-2 text-left font-semibold">Lane</th>
                <th className="px-3 py-2 text-right font-semibold">Expected</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows.length && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400">
                  {search || Object.values(filters).some(Boolean)
                    ? 'No leads match those filters.'
                    : 'No leads yet. Raise one against a prospect to start the funnel.'}
                </td></tr>
              )}
              {rows.map((l) => {
                const cat = CATEGORY_META[l.leadCategory];
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openDetail(l.id)}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {l.leadNumber}
                      </button>
                      <div className="text-[10px] text-slate-400">{l.date}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 max-w-[220px] truncate">{l.name}</div>
                      <div className="text-[10px] text-slate-400">{l.commodity}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate">
                      {l.prospect?.name || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={l.stageId || ''}
                        onChange={(e) => setStage(l, e.target.value)}
                        disabled={busy || l.status === 'converted'}
                        title={l.status === 'converted'
                          ? 'Converted leads are moved on the opportunity'
                          : 'Move this lead to another stage'}
                        className="px-1.5 py-0.5 border border-slate-200 rounded text-[11px] disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium mr-1">
                        {l.transportMode}
                      </span>
                      {l.originCountry || '?'} <ArrowRight size={9} className="inline text-slate-300" /> {l.destinationCountry || '?'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(l.expectedAnnualRevenue, l.annualRevenueCurrency)}
                      <div className="text-[10px] text-slate-400">
                        {Number(l.expectedAnnualVolume) ? `${Number(l.expectedAnnualVolume).toLocaleString()} ${l.volumeUom || ''}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">
                      {l.assignedUser?.name || '-'}
                      {cat && <div className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${cat.className}`}>{cat.label}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={l.status} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {l.status === 'open' && l.stage?.isCreateOpportunity && (
                        <button
                          type="button"
                          onClick={() => convert(l)}
                          disabled={busy}
                          title="Convert this lead into an opportunity"
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 mr-1"
                        >
                          Convert
                        </button>
                      )}
                      {l.opportunityId && (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/opportunities?highlight=${l.opportunityId}`)}
                          title="Open the opportunity this lead became"
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <ExternalLink size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(l)}
                        disabled={l.status === 'converted'}
                        title={l.status === 'converted'
                          ? 'Converted leads are edited on the opportunity'
                          : 'Edit this lead'}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(l)}
                        disabled={busy || !!l.opportunityId}
                        title={l.opportunityId
                          ? 'This lead produced an opportunity — mark it lost instead'
                          : 'Delete this lead'}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <p className="text-[11px] text-slate-400">
          {allLeads.length} lead(s)
          {allLeads.length > 0 && ` · expected ${money(
            allLeads.reduce((s, l) => s + (Number(l.expectedAnnualRevenue) || 0), 0),
          )}`}
        </p>
      )}
    </div>
  );
};

const StatusPill = ({ status }) => {
  const style = {
    open: 'bg-blue-100 text-blue-700',
    converted: 'bg-emerald-100 text-emerald-700',
    lost: 'bg-slate-100 text-slate-500',
  }[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${style}`}>
      {status}
    </span>
  );
};

const Select = ({ value, onChange, label, options }) => (
  <select
    value={value}
    onChange={onChange}
    className={`px-2 py-1 border rounded text-xs ${
      value ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-300 text-slate-600'}`}
  >
    <option value="">{label}</option>
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);

const Field = ({ label, hint, wide, children }) => (
  <div className={wide ? 'md:col-span-2' : ''}>
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const input = 'w-full px-2 py-1.5 border border-slate-300 rounded text-xs';

const LeadForm = ({
  draft, setField, editingId, busy, onSave, onCancel,
  stages, prospects, teams, users, ports, sources,
}) => (
  <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
    <h2 className="text-sm font-semibold text-slate-800 mb-3">
      {editingId ? `Edit lead ${draft.leadNumber || ''}` : 'New lead'}
    </h2>

    <Section title="The enquiry" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Enquiry name" wide>
        <input value={draft.name || ''} onChange={setField('name')}
          placeholder="Steel coils - UAE to India" className={input} />
      </Field>
      <Field label="Date">
        <input type="date" value={draft.date || ''} onChange={setField('date')} className={input} />
      </Field>
      <Field label="Stage">
        <select value={draft.stageId || ''} onChange={setField('stageId')} className={input}>
          <option value="">First stage</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Prospect" wide hint="A lead always belongs to a prospect">
        <select value={draft.prospectId || ''} onChange={setField('prospectId')} className={input}>
          <option value="">Choose a prospect</option>
          {prospects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.relatedPartnerId ? ' (customer)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Temperature">
        <select value={draft.leadCategory || ''} onChange={setField('leadCategory')} className={input}>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
      </Field>
      <Field label="Source">
        <select value={draft.leadSourceId || ''} onChange={setField('leadSourceId')} className={input}>
          <option value="">Not set</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    </div>

    <Section title="The lane" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Transport mode">
        <select value={draft.transportMode || ''} onChange={setField('transportMode')} className={input}>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="Shipment type">
        <select value={draft.shipmentType || ''} onChange={setField('shipmentType')} className={input}>
          <option value="">Not set</option>
          {SHIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Direction">
        <select value={draft.direction || ''} onChange={setField('direction')} className={input}>
          {DIRECTIONS.map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <Field label="Commodity">
        <input value={draft.commodity || ''} onChange={setField('commodity')} className={input} />
      </Field>
      <Field label="From country">
        <input value={draft.originCountry || ''} onChange={setField('originCountry')} className={input} />
      </Field>
      <Field label="Port of loading">
        <select value={draft.portOfLoadingId || ''} onChange={setField('portOfLoadingId')} className={input}>
          <option value="">Not set</option>
          {ports.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
        </select>
      </Field>
      <Field label="To country">
        <input value={draft.destinationCountry || ''} onChange={setField('destinationCountry')} className={input} />
      </Field>
      <Field label="Port of discharge">
        <select value={draft.portOfDischargeId || ''} onChange={setField('portOfDischargeId')} className={input}>
          <option value="">Not set</option>
          {ports.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
        </select>
      </Field>
      <Field label="Pickup location type">
        <select value={draft.pickupLocationType || ''} onChange={setField('pickupLocationType')} className={input}>
          <option value="">Not set</option>
          {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Delivery location type">
        <select value={draft.deliveryLocationType || ''} onChange={setField('deliveryLocationType')} className={input}>
          <option value="">Not set</option>
          {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
    </div>

    <Section title="The prize" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Expected annual revenue">
        <input type="number" step="0.01" value={draft.expectedAnnualRevenue ?? ''}
          onChange={setField('expectedAnnualRevenue')} className={`${input} text-right`} />
      </Field>
      <Field label="Currency">
        <input value={draft.annualRevenueCurrency || ''} onChange={setField('annualRevenueCurrency')} className={input} />
      </Field>
      <Field label="Expected annual volume" hint="Measured against the sales targets">
        <input type="number" step="0.001" value={draft.expectedAnnualVolume ?? ''}
          onChange={setField('expectedAnnualVolume')} className={`${input} text-right`} />
      </Field>
      <Field label="Volume unit">
        <select value={draft.volumeUom || ''} onChange={setField('volumeUom')} className={input}>
          <option value="TEU">TEU</option>
          <option value="kg">kg</option>
          <option value="m3">m3</option>
          <option value="shipments">shipments</option>
        </select>
      </Field>
      <Field label="Target close date">
        <input type="date" value={draft.targetDate || ''} onChange={setField('targetDate')} className={input} />
      </Field>
      <Field label="Owner">
        <select value={draft.assignedTo || ''} onChange={setField('assignedTo')} className={input}>
          <option value="">Not set</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
      </Field>
      <Field label="Sales team">
        <select value={draft.salesTeamId || ''} onChange={setField('salesTeamId')} className={input}>
          <option value="">Not set</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
    </div>

    <Section title="Contact and notes" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Contact name">
        <input value={draft.contactName || ''} onChange={setField('contactName')} className={input} />
      </Field>
      <Field label="Email">
        <input value={draft.email || ''} onChange={setField('email')} className={input} />
      </Field>
      <Field label="Phone">
        <input value={draft.phone || ''} onChange={setField('phone')} className={input} />
      </Field>
      <Field label="Remarks" wide>
        <input value={draft.remarks || ''} onChange={setField('remarks')} className={input} />
      </Field>
      <Field label="Notes" wide>
        <textarea rows={2} value={draft.notes || ''} onChange={setField('notes')} className={input} />
      </Field>
    </div>

    <div className="flex items-center justify-end gap-2 mt-4">
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
        <Save size={13} /> {busy ? 'Saving…' : 'Save lead'}
      </button>
    </div>
  </div>
);

const Section = ({ title }) => (
  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-2 first:mt-0">
    {title}
  </h3>
);

const LeadDetail = ({ lead, onClose, onEdit, onConvert, onStage, stages, busy, navigate }) => {
  const a = lead.actions || {};
  return (
    <div className="bg-white border-2 border-slate-300 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">{lead.name}</h2>
            <StatusPill status={lead.status} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
            {lead.leadNumber} · {lead.date} · {lead.prospect?.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {a.convertToOpportunity && (
            <button
              type="button"
              onClick={onConvert}
              disabled={busy}
              className="px-2.5 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Convert to opportunity
            </button>
          )}
          {a.openOpportunity && (
            <button
              type="button"
              onClick={() => navigate(`/admin/opportunities?highlight=${lead.opportunityId}`)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink size={12} /> Opportunity
            </button>
          )}
          {a.setStage && (
            <select
              value={lead.stageId || ''}
              onChange={(e) => onStage(e.target.value)}
              disabled={busy}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {a.edit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-slate-400 hover:text-blue-600"
              title="Edit this lead"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-xs">
        <Detail label="Stage" value={lead.stage?.name} />
        <Detail label="Temperature" value={lead.leadCategory} />
        <Detail label="Mode" value={`${lead.transportMode || '-'} ${lead.shipmentType || ''}`} />
        <Detail label="Direction" value={(lead.direction || '').replace('_', ' ')} />
        <Detail label="From" value={`${lead.originCountry || '-'}${lead.portOfLoading ? ` (${lead.portOfLoading.code})` : ''}`} />
        <Detail label="To" value={`${lead.destinationCountry || '-'}${lead.portOfDischarge ? ` (${lead.portOfDischarge.code})` : ''}`} />
        <Detail label="Commodity" value={lead.commodity} />
        <Detail label="Expected revenue" value={money(lead.expectedAnnualRevenue, lead.annualRevenueCurrency)} />
        <Detail label="Expected volume"
          value={Number(lead.expectedAnnualVolume)
            ? `${Number(lead.expectedAnnualVolume).toLocaleString()} ${lead.volumeUom || ''}`
            : null} />
        <Detail label="Target date" value={lead.targetDate} />
        <Detail label="Owner" value={lead.assignedUser?.name} />
        <Detail label="Team" value={lead.salesTeam?.name} />
        <Detail label="Contact" value={lead.contactName} />
        <Detail label="Email" value={lead.email} />
        <Detail label="Phone" value={lead.phone || lead.mobile} />
        <Detail label="Source" value={lead.leadSource} />
      </div>

      {(lead.remarks || lead.notes) && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 whitespace-pre-line">
          {lead.remarks}
          {lead.remarks && lead.notes ? '\n\n' : ''}
          {lead.notes}
        </div>
      )}

      {lead.status === 'lost' && lead.lostReason && (
        <div className="mt-3 px-3 py-2 bg-slate-50 rounded text-xs text-slate-600">
          <strong>Lost:</strong> {lead.lostReason}
        </div>
      )}

      {!a.convertToOpportunity && lead.status === 'open' && (
        <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-1.5">
          <ChevronRight size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            This lead cannot be converted yet. Move it to a stage marked
            &ldquo;allows opportunity creation&rdquo; — by default that is
            <strong> Qualified</strong>.
          </span>
        </div>
      )}
    </div>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="text-slate-700 capitalize-first">{value || <span className="text-slate-300">-</span>}</dd>
  </div>
);

export default LeadBoard;
