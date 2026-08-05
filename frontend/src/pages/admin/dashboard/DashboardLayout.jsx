import React from 'react';
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
            <button className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            <button className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Star className="w-3.5 h-3.5" />
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
            <button className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            <button className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Star className="w-3.5 h-3.5" />
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
export const WidgetHeader = ({ title, count, onDownload }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">{count}</span>
      <button className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-400 rounded hover:bg-gray-200" title="Bar chart" type="button">
        <span className="text-[10px]">▤</span>
      </button>
      <button className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-400 rounded hover:bg-gray-200" title="Pie chart" type="button">
        <span className="text-[10px]">◔</span>
      </button>
      <button
        onClick={onDownload}
        className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-400 rounded hover:bg-gray-200"
        title="Download"
        type="button"
      >
        <span className="text-[10px]">⬇</span>
      </button>
    </div>
  </div>
);

/** Simple 2-column (label/value) data table widget */
export const DataTableWidget = ({ title, columns, rows, downloadLabel }) => {
  const handleDownload = () => {
    toast.success(`${downloadLabel || title} export started`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <WidgetHeader title={title} count="0-0 / 0" onDownload={handleDownload} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`py-2 text-gray-500 font-semibold text-xs ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows && rows.length > 0 ? (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className={`py-2 text-gray-700 ${c.align === 'right' ? 'text-right font-semibold text-gray-900' : ''}`}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-gray-400 text-sm">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardLayout;
