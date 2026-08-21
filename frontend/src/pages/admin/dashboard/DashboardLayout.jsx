import React from 'react';
import { exportCsv } from '../../../utils/exportCsv';
import toast from 'react-hot-toast';
import { RefreshCw, X, Filter, Star, Search } from 'lucide-react';

export const TABS = [
  { key: 'quotes', label: 'Quote Dashboard' },
  { key: 'shipments', label: 'Shipment Dashboard' },
  { key: 'carrier-bookings', label: 'Carrier Booking Dashboard' },
  { key: 'activity', label: 'Activity Dashboard' },
  { key: 'credit-limit-overdue', label: 'Credit Limit Overdue' },
];

/**
 * Shared chrome for all 5 Dashboard tabs:
 *  - Page title "Dashboard" + tab links
 *  - Sub-title for the active tab
 *  - Toolbar: refresh button + (optional) filter chip / search / Filters / Favorites
 */
const PERIODS = ['Today', 'Current Week', 'Current Month', 'Current Quarter', 'Current Year', 'All Time'];

const DashboardLayout = ({
  activeTab,
  onTabChange,
  subtitle,
  onRefresh,
  showFullToolbar = false,
  showSearch = false,
  search,
  onSearchChange,
  children,
}) => {
  const [filterChip, setFilterChip] = React.useState('Current Month');
  const [periodOpen, setPeriodOpen] = React.useState(false);
  // The period chip is the dashboard's filter; remember the chosen one.
  const [favorite, setFavorite] = React.useState(() => !!localStorage.getItem('cargoflo.fav.dashboard'));

  const toggleFavorite = () => {
    if (favorite) { localStorage.removeItem('cargoflo.fav.dashboard'); setFavorite(false); toast('Removed from favourites'); return; }
    localStorage.setItem('cargoflo.fav.dashboard', JSON.stringify({ filterChip, activeTab }));
    setFavorite(true);
    toast.success('Saved this dashboard view');
  };

  return (
    <div className="p-6 space-y-4">
      {/* Title row + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-title */}
      {subtitle && <h2 className="text-lg font-semibold text-gray-800">{subtitle}</h2>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onRefresh}
          title="Refresh"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {showFullToolbar && (
          <div className="flex flex-wrap items-center gap-3">
            {filterChip && (
              <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full">
                {filterChip}
                <button onClick={() => setFilterChip('')} className="hover:text-blue-900">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {showSearch && (
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Search"
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}
            <div className="relative">
              <button onClick={() => setPeriodOpen((o) => !o)}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-3.5 h-3.5" />
                Filters
              </button>
              {periodOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-30">
                  {PERIODS.map((p) => (
                    <button key={p} onClick={() => { setFilterChip(p); setPeriodOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${filterChip === p ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFavorite}
              className={`flex items-center gap-1.5 border text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                favorite ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} />
              Favorites
            </button>
          </div>
        )}

        {!showFullToolbar && showSearch && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="relative">
              <button onClick={() => setPeriodOpen((o) => !o)}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-3.5 h-3.5" />
                Filters
              </button>
              {periodOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-30">
                  {PERIODS.map((p) => (
                    <button key={p} onClick={() => { setFilterChip(p); setPeriodOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${filterChip === p ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFavorite}
              className={`flex items-center gap-1.5 border text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                favorite ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} />
              Favorites
            </button>
          </div>
        )}
      </div>

      {children}
    </div>
  );
};

/** Generic stat card: big number + label below */
export const StatCard = ({ label, value }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
  </div>
);

/** Table widget header with "0-0 / 0" pagination + small icon buttons */
export const WidgetHeader = ({ title, count, onDownload, view = 'table', onView }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">{count}</span>
      {/* Switch the widget between a table and a chart drawn from the same rows. */}
      {[['table', '≡', 'Table'], ['bar', '▤', 'Bar chart'], ['pie', '◔', 'Pie chart']].map(([k, glyph, label]) => (
        <button key={k} type="button" title={label}
          onClick={() => onView?.(k)}
          className={`w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 ${
            view === k ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
          }`}>
          <span className="text-[10px]">{glyph}</span>
        </button>
      ))}
      <button
        onClick={onDownload}
        type="button"
        title="Download"
        className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-400 rounded hover:bg-gray-200"
      >
        <span className="text-[10px]">⬇</span>
      </button>
    </div>
  </div>
);

/** Simple 2-column (label/value) data table widget */
export const DataTableWidget = ({ title, columns, rows, downloadLabel }) => {
  const [view, setView] = React.useState('table');
  const data = rows || [];

  const handleDownload = () => {
    if (exportCsv(data, columns.map((c) => ({ key: c.key, label: c.label })), downloadLabel || title)) {
      toast.success(`Exported ${data.length} rows`);
    } else {
      toast.error('Nothing to export');
    }
  };

  // The chart views read the first right-aligned (numeric) column, which is how
  // these widgets are laid out throughout the dashboard.
  const valueCol = columns.find((c) => c.align === 'right') || columns[columns.length - 1];
  const labelCol = columns.find((c) => c !== valueCol) || columns[0];
  const num = (r) => Number(String(r[valueCol.key] ?? '').replace(/[^0-9.-]/g, '')) || 0;
  const total = data.reduce((a, r) => a + num(r), 0);
  const max = data.reduce((a, r) => Math.max(a, num(r)), 0);

  const SLICE = ['#1d4ed8', '#0891b2', '#f59e0b', '#dc2626', '#7c3aed', '#059669', '#64748b'];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <WidgetHeader
        title={title}
        count={data.length ? `1-${data.length} / ${data.length}` : '0-0 / 0'}
        onDownload={handleDownload}
        view={view}
        onView={setView}
      />

      {data.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">No data</div>
      ) : view === 'bar' ? (
        <div className="space-y-1.5">
          {data.map((row, i) => (
            // Dashboard rows are aggregates with no stable id.
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate text-gray-600" title={String(row[labelCol.key])}>{row[labelCol.key]}</span>
              <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                <div className="h-full bg-blue-600 rounded"
                  style={{ width: max ? `${Math.max(2, (num(row) / max) * 100)}%` : '0%' }} />
              </div>
              <span className="w-20 text-right font-semibold text-gray-900">{row[valueCol.key]}</span>
            </div>
          ))}
        </div>
      ) : view === 'pie' ? (
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 rounded-full flex-shrink-0" style={{
            background: total
              ? `conic-gradient(${data.map((r, i) => {
                const from = data.slice(0, i).reduce((a, x) => a + num(x), 0) / total * 100;
                const to = from + (num(r) / total) * 100;
                return `${SLICE[i % SLICE.length]} ${from}% ${to}%`;
              }).join(', ')})`
              : '#e5e7eb',
          }} />
          <div className="flex-1 space-y-1">
            {data.map((row, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SLICE[i % SLICE.length] }} />
                <span className="flex-1 truncate text-gray-600">{row[labelCol.key]}</span>
                <span className="font-semibold text-gray-900">{row[valueCol.key]}</span>
                <span className="w-10 text-right text-gray-400">
                  {total ? `${Math.round((num(row) / total) * 100)}%` : '0%'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((c) => (
                <th key={c.key}
                  className={`py-2 text-gray-500 font-semibold text-xs ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className={`py-2 text-gray-700 ${c.align === 'right' ? 'text-right font-semibold text-gray-900' : ''}`}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DashboardLayout;
