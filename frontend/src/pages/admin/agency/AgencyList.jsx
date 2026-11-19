import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, RefreshCw, Play, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { agencyAPI } from '../../../services/api';
import { exportCsv } from '../../../utils/exportCsv';
import { displayValue, StateBadge } from './fields';

// The list view of any Liner Agency resource: columns, status chips, search,
// paging, CSV export and - where the resource has them - list-level actions
// such as Operations > Charge Assignment.
const AgencyList = ({ meta, resource, title, basePath, params = {}, bulk = false }) => {
  const r = meta.resources[resource];
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  // Smart buttons link here with ?field=value; those narrow the list too.
  const urlFilters = useMemo(() => Object.fromEntries([...search.entries()]), [search]);
  const columns = useMemo(() => r.fields.filter((f) => f.list), [r]);
  const query = useMemo(() => ({ ...params, ...urlFilters }), [params, urlFilters]);
  const queryKey = JSON.stringify(query);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agencyAPI.list(resource, { ...query, search: q || undefined, state: state || undefined, page, limit: 50 });
      setRows(res.data.data || []);
      setCounts(res.data.stateCounts || null);
      setPagination(res.data.pagination || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the list');
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, queryKey, q, state, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => { setPage(1); setSelected([]); }, [resource, queryKey, q, state]);

  const onExport = () => {
    const shaped = rows.map((row) => Object.fromEntries([
      ...columns.map((c) => [c.name, displayValue(c, row)]),
      ...(r.stateField ? [[r.stateField, displayValue({ type: 'sel', options: r.states }, { v: row[r.stateField] }) || row[r.stateField]]] : []),
    ]));
    const spec = [...columns.map((c) => ({ key: c.name, label: c.label })), ...(r.stateField ? [{ key: r.stateField, label: 'Status' }] : [])];
    if (exportCsv(shaped, spec, title.toLowerCase().replace(/\W+/g, '-'))) toast.success(`Exported ${rows.length} rows`);
  };

  const runBulk = async (action) => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const res = await agencyAPI.bulk(resource, action.key, selected);
      const failed = (res.data.data || []).filter((x) => !x.ok);
      toast.success(res.data.message);
      failed.slice(0, 3).forEach((f) => toast.error(f.message));
      setSelected([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : null;
  const allChecked = rows.length && rows.every((x) => selected.includes(x.id));
  const filterChips = Object.entries(urlFilters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          {filterChips.length > 0 && (
            <div className="flex gap-1 mt-1">
              {filterChips.map(([k]) => (
                <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">
                  Filtered by {(r.fields.find((f) => f.name === k) || { label: k }).label}
                  <button type="button" onClick={() => navigate(basePath)} title="Clear filter"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 w-56 border border-slate-300 rounded text-xs" />
          </div>
          <button type="button" onClick={load} title="Reload" className="p-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50"><RefreshCw size={14} /></button>
          <button type="button" onClick={onExport} disabled={!rows.length} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            <Download size={13} /> Export
          </button>
          {!bulk && (
            <button
              type="button"
              onClick={() => navigate(`${basePath}/new${search.toString() ? `?${search.toString()}` : ''}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus size={13} /> New
            </button>
          )}
        </div>
      </div>

      {bulk && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs">
          <span className="text-amber-800">Select jobs, then apply their approved tariffs as cost and revenue charges.</span>
          {r.bulkActions.map((a) => (
            <button key={a.key} type="button" disabled={!selected.length || busy} onClick={() => runBulk(a)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-600 text-white font-semibold disabled:opacity-40">
              <Play size={12} /> {busy ? 'Working…' : `${a.label} (${selected.length})`}
            </button>
          ))}
        </div>
      )}

      {counts && (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setState('')} className={`px-2.5 py-1 rounded-full text-[11px] border ${!state ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            All {total !== null && <span className="opacity-70">({total})</span>}
          </button>
          {r.states.filter(([v]) => counts[v]).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setState(v)} className={`px-2.5 py-1 rounded-full text-[11px] border ${state === v ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              {l} <span className="opacity-70">({counts[v]})</span>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {bulk && (
                <th className="px-3 py-2 w-6">
                  <input type="checkbox" checked={!!allChecked} onChange={() => setSelected(allChecked ? [] : rows.map((x) => x.id))} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.name} className={`px-3 py-2 font-semibold whitespace-nowrap ${['i', 'f', '$'].includes(c.type) ? 'text-right' : 'text-left'}`}>{c.label}</th>
              ))}
              {r.stateField && <th className="px-3 py-2 text-left font-semibold">Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={columns.length + 2} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && !rows.length && (
              <tr><td colSpan={columns.length + 2} className="px-3 py-8 text-center text-slate-400">{q ? `Nothing matches "${q}".` : 'No records yet.'}</td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50/40 cursor-pointer" onClick={() => (bulk ? setSelected((s) => (s.includes(row.id) ? s.filter((x) => x !== row.id) : [...s, row.id])) : navigate(`${basePath}/${row.id}`))}>
                {bulk && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((s) => (s.includes(row.id) ? s.filter((x) => x !== row.id) : [...s, row.id]))} />
                  </td>
                )}
                {columns.map((c, i) => (
                  <td key={c.name} className={`px-3 py-2 whitespace-nowrap ${['i', 'f', '$'].includes(c.type) ? 'text-right tabular-nums' : ''} ${i === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                    {displayValue(c, row) || <span className="text-slate-300">-</span>}
                  </td>
                ))}
                {r.stateField && <td className="px-3 py-2"><StateBadge meta={r} value={row[r.stateField]} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          <span>{pagination.total} records · page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border border-slate-300 rounded disabled:opacity-40">Prev</button>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border border-slate-300 rounded disabled:opacity-40">Next</button>
        </div>
      )}
      {pagination && pagination.pages <= 1 && !!rows.length && <p className="text-[11px] text-slate-400">{rows.length} record(s)</p>}
    </div>
  );
};

export default AgencyList;
