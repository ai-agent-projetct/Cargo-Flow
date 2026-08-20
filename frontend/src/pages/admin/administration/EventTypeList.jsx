import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EVENT_TYPES } from './eventTypeData';
import MasterListToolbar from './MasterListToolbar';

// "Administration > Freight Masters > Event Type" list, mirroring CargoFlo
// ERP's "Event Type" screen: a "Create" button, Event Code / Event Name
// columns. Clicking a row opens its detail page.
const EventTypeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = EVENT_TYPES.filter((et) =>
    !search ||
    et.name.toLowerCase().includes(search.toLowerCase()) ||
    et.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Event Type</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="event-type"
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
                <th className="text-left px-4 py-3">Event Code</th>
                <th className="text-left px-4 py-3">Event Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((et, i) => (
                <tr
                  key={`${et.code}-${i}`}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(encodeURIComponent(et.code))}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-3 text-slate-300">⋮</td>
                  <td className="px-4 py-3 font-medium text-primary-600">{et.code}</td>
                  <td className="px-4 py-3 text-primary-600">{et.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EventTypeList;
