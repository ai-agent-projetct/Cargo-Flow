import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const DataTable = ({
  columns,
  data = [],
  loading = false,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon: EmptyIcon,
  className = '',
  rowClassName,
  keyField = 'id',
  serverSide = false,
  sortField,
  sortDir,
  onSort,
}) => {
  const [localSort, setLocalSort] = useState({ field: null, dir: 'asc' });

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (serverSide && onSort) {
      const newDir = sortField === col.key && sortDir === 'asc' ? 'desc' : 'asc';
      onSort(col.key, newDir);
    } else {
      setLocalSort((prev) => ({
        field: col.key,
        dir: prev.field === col.key && prev.dir === 'asc' ? 'desc' : 'asc',
      }));
    }
  };

  const sortedData = useMemo(() => {
    if (serverSide || !localSort.field) return data;
    return [...data].sort((a, b) => {
      const aVal = a[localSort.field];
      const bVal = b[localSort.field];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return localSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, localSort, serverSide]);

  const activeSortField = serverSide ? sortField : localSort.field;
  const activeSortDir = serverSide ? sortDir : localSort.dir;

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (activeSortField === col.key) {
      return activeSortDir === 'asc'
        ? <ChevronUp className="w-3.5 h-3.5" />
        : <ChevronDown className="w-3.5 h-3.5" />;
    }
    return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />;
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                  col.sortable ? 'cursor-pointer hover:text-slate-700 select-none' : ''
                } ${col.headerClass || ''}`}
                style={{ width: col.width }}
                onClick={() => handleSort(col)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <SortIcon col={col} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center">
                <LoadingSpinner size="md" text="Loading..." />
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  {EmptyIcon && <EmptyIcon className="w-12 h-12 text-slate-200" />}
                  <p className="text-slate-400 text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr
                key={row[keyField] || idx}
                className={`border-b border-slate-50 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
                } ${rowClassName?.(row) || ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-700 ${col.cellClass || ''}`}
                    onClick={(e) => {
                      if (col.stopPropagation) e.stopPropagation();
                    }}
                  >
                    {col.render ? col.render(row[col.key], row, idx) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
