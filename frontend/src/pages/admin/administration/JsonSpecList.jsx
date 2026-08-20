import React, { useState } from 'react';
import { X, Download, ChevronLeft } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { useAuth } from '../../../context/AuthContext';

// Generic "Display Name / Model" list used for the Freight Masters JSON
// specification screens (Product JSON Specifications, FIATA eBL Json
// Specifications, Carrier Booking JSON Specifications, TMS JSON
// Specifications). Mirrors CargoFlo ERP: a "Main Spec" filter chip and a
// table of Display Name / Model. Some records are restricted to specific
// departments/groups (set up under Administration > Companies & Users >
// Departments/Groups) - clicking one when the current user isn't a member of
// an allowed group shows the same access-denied "Warning" dialog as the live
// ERP.
const JsonSpecList = ({ data }) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [warning, setWarning] = useState(null);

  const filtered = data.rows.filter((row) =>
    !search || row.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const hasAccess = (row) => {
    if (!row.restricted) return true;
    const deptName = user?.department?.name;
    return !!deptName && row.allowedGroups.some((g) => g.toLowerCase().includes(deptName.toLowerCase()));
  };

  const handleRowClick = (row) => {
    if (!hasAccess(row)) {
      setWarning(row);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{data.title}</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {data.filterChip && (
              <span className="flex items-center gap-1.5 bg-primary-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-md">
                {data.filterChip}
                <X className="w-3 h-3 cursor-pointer" />
              </span>
            )}
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{filtered.length}/{filtered.length}</span>
            <button className="p-1.5 text-slate-400 hover:text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="text-left px-4 py-3">Display Name</th>
                <th className="text-left px-4 py-3">Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr
                  key={row.displayName}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-4 py-3 font-medium text-primary-600">{row.displayName}</td>
                  <td className="px-4 py-3 text-primary-600">{row.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access-denied warning dialog */}
      {warning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-primary-600">Warning</h3>
              <button onClick={() => setWarning(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-700 mb-4">
              You are not allowed to access {warning.restrictedResource} records.
            </p>
            <p className="text-sm text-slate-700 mb-2">This operation is allowed for the following groups:</p>
            <ul className="text-sm text-slate-700 mb-4 list-none">
              {warning.allowedGroups.map((g) => (
                <li key={g} className="pl-4">- {g}</li>
              ))}
            </ul>
            <p className="text-sm text-slate-700 mb-4">Contact your administrator to request access if necessary.</p>
            <button
              onClick={() => setWarning(null)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
            >
              Ok
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JsonSpecList;
