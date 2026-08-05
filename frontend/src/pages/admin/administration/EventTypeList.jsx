import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronLeft } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { EVENT_TYPES } from './eventTypeData';

// "Administration > Freight Masters > Event Type" list, mirroring SeaRates
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
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('new')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg"
            >
              Create
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
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
