import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronLeft, ArrowUpDown } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { SHIPMENT_TYPES } from './freightMastersData';

// "Administration > Freight Masters > Shipment Type" list, mirroring
// SeaRates ERP's "Shipment Type" screen (drag handle, Code, Name, Active
// toggle columns). Clicking a row opens its own detail page.
const ShipmentTypeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = SHIPMENT_TYPES.filter((st) =>
    !search ||
    st.name.toLowerCase().includes(search.toLowerCase()) ||
    st.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Shipment Type</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>

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
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((st) => (
                <tr
                  key={st.code}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(st.code)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-3 text-slate-300">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-4 py-3 font-medium text-primary-600">{st.code}</td>
                  <td className="px-4 py-3 text-primary-600">{st.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-9 h-5 rounded-full ${st.active ? 'bg-primary-600' : 'bg-slate-300'}`}>
                      <span className="text-[10px] text-white">{st.active ? '✓' : ''}</span>
                    </span>
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

export default ShipmentTypeList;
