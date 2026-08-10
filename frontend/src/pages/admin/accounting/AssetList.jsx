import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

// Assets, Deferred Revenue and Deferred Expenses are the same model split by
// type, so one screen serves all three menus.
const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');

const STATE = { draft: 'Draft', running: 'Running', paused: 'Paused', close: 'Closed', cancel: 'Cancelled' };
const STATE_PILL = {
  draft: 'bg-gray-100 text-gray-700',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  close: 'bg-blue-100 text-blue-700',
  cancel: 'bg-red-100 text-red-700',
};

const AssetList = ({ menu, title }) => {
  const { guard } = usePermissions();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => accountingAPI.assets({ menu, search: search || undefined }));
    if (res) {
      setRows(res.data.data.data || []);
      setMeta(res.data.data.pagination || { total: 0 });
      setTotals(res.data.data.totals || {});
    }
    setLoading(false);
  }, [menu, search, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOpen(null); }, [menu]);

  const act = async (id, action) => {
    const res = await guard(() => accountingAPI.assetAction(id, action));
    if (res) load();
  };

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-72 pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 text-xs text-gray-500">
            {meta.total ? `1-${rows.length} / ${meta.total}` : '0-0 / 0'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="w-6" />
                  {['Name', 'Partner', 'Acquisition Date', 'Duration', 'Original Value',
                    'Depreciated', 'Book Value', 'Status'].map((h) => (
                    <th key={h}
                      className={`px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${['Original Value', 'Depreciated', 'Book Value', 'Duration'].includes(h) ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <td className="px-1 py-1.5 text-gray-400">
                        {open === r.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-medium text-gray-900">{r.name}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-700 max-w-[14rem] truncate">{r.partner}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-700">{fmtDate(r.acquisitionDate)}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-700 text-right">{r.duration} {r.periodicity}</td>
                      <td className="px-2 py-1.5 text-xs text-right text-gray-800">{money(r.original)}</td>
                      <td className="px-2 py-1.5 text-xs text-right text-gray-800">{money(r.depreciated)}</td>
                      <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">{money(r.bookValue)}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATE_PILL[r.state]}`}>
                          {STATE[r.state]}
                        </span>
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr className="bg-gray-50/60">
                        <td />
                        <td colSpan={8} className="px-2 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            {Object.entries(r.availableActions || {})
                              .filter(([k, v]) => v && k !== 'edit')
                              .map(([k]) => (
                                <button key={k}
                                  onClick={(e) => { e.stopPropagation(); act(r.id, k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)); }}
                                  className="px-2.5 py-1 border border-gray-300 rounded text-xs bg-white hover:bg-gray-50 capitalize">
                                  {k.replace(/([A-Z])/g, ' $1')}
                                </button>
                              ))}
                          </div>
                          <div className="text-[11px] font-semibold text-gray-600 mb-1">Depreciation Schedule</div>
                          <div className="max-h-56 overflow-y-auto border border-gray-200 rounded bg-white">
                            <table className="w-full text-[11px]">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  {['#', 'Date', 'Depreciation', 'Cumulative', 'Residual', 'Posted'].map((h) => (
                                    <th key={h} className={`px-2 py-1 font-semibold text-gray-700 ${['Depreciation', 'Cumulative', 'Residual'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {(r.depreciationLines || []).map((l) => (
                                  <tr key={l.sequence}>
                                    <td className="px-2 py-1 text-gray-500">{l.sequence}</td>
                                    <td className="px-2 py-1 text-gray-700">{fmtDate(l.date)}</td>
                                    <td className="px-2 py-1 text-right text-gray-800">{money(l.depreciation)}</td>
                                    <td className="px-2 py-1 text-right text-gray-700">{money(l.cumulative)}</td>
                                    <td className="px-2 py-1 text-right text-gray-700">{money(l.remaining)}</td>
                                    <td className="px-2 py-1 text-gray-600">{l.posted ? 'Posted' : ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} />
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900">{money(totals.original)}</td>
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900">{money(totals.depreciated)}</td>
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900">{money(totals.bookValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetList;
