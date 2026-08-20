import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PARTY_TYPES, PARTY_TYPE_COLORS } from './partyTypeData';
import MasterListToolbar from './MasterListToolbar';

// "Administration > Freight Masters > Party Type" list, mirroring CargoFlo
// ERP's "Party Type" screen: a "Create" button, Name / Code / Is Vendor /
// Color columns. Clicking a row opens its detail page.
const PartyTypeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const items = PARTY_TYPES.map((pt, i) => ({ ...pt, idx: i }));
  const filtered = items.filter((pt) =>
    !search ||
    pt.name.toLowerCase().includes(search.toLowerCase()) ||
    pt.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Party Type</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="party-type"
          search={search}
          onSearch={setSearch}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="px-2 py-3 w-8"></th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Is Vendor</th>
                <th className="text-left px-4 py-3">Color</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((pt) => (
                <tr
                  key={pt.idx}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`${pt.idx}`)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-3 text-slate-300">⋮</td>
                  <td className="px-4 py-3 font-medium text-primary-600">{pt.name}</td>
                  <td className="px-4 py-3 text-slate-700">{pt.code}</td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={pt.isVendor} readOnly className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded border border-slate-200"
                      style={{ backgroundColor: PARTY_TYPE_COLORS[pt.color] }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PartyTypeList;
