import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Calendar } from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

// Every Reporting leaf and the three Ledgers screens render through here. The
// backend returns the column definitions with the rows, so a new report needs
// no frontend change beyond a route.
const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');

const cell = (row, col) => {
  const v = row[col.key];
  if (col.type === 'money') return money(v);
  if (col.type === 'date') return fmtDate(v);
  return v === null || v === undefined ? '' : String(v);
};

const ReportView = ({ reportId, title }) => {
  const { guard } = usePermissions();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => accountingAPI.runReport(reportId, {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }));
    setReport(res ? res.data.data : null);
    setLoading(false);
  }, [reportId, dateFrom, dateTo, guard]);

  useEffect(() => { load(); }, [load]);

  // Export what is on screen, so the file matches the applied filters.
  const exportCsv = () => {
    if (!report) return;
    const head = report.columns.map((c) => `"${c.label}"`).join(',');
    const body = report.rows.map((r) => report.columns
      .map((c) => `"${String(cell(r, c)).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`${head}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${reportId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const columns = report?.columns || [];
  const totals = report?.totals || {};
  const hasTotals = Object.keys(totals).length > 0;

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">{report?.title || title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="w-3.5 h-3.5" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs" />
          </div>
          <button onClick={load}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={exportCsv} disabled={!report?.rows?.length}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {loading ? <PageLoader /> : !report ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          Report unavailable
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 text-xs text-gray-500">
            {report.rows.length} {report.rows.length === 1 ? 'row' : 'rows'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}
                      className={`px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.length === 0 ? (
                  <tr><td colSpan={columns.length} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : report.rows.map((r, i) => (
                  // Report rows are computed aggregates with no stable id.
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={i} className="hover:bg-gray-50">
                    {columns.map((c) => (
                      <td key={c.key}
                        className={`px-2 py-1.5 text-xs whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.type === 'money' ? 'text-gray-900' : 'text-gray-700'}`}>
                        {cell(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {hasTotals && report.rows.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    {columns.map((c, i) => (
                      <td key={c.key}
                        className={`px-2 py-2 text-xs font-semibold text-gray-900 whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                        {totals[c.key] !== undefined
                          ? (c.type === 'money' ? money(totals[c.key]) : totals[c.key])
                          : (i === 0 ? 'Total' : '')}
                      </td>
                    ))}
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

export default ReportView;
