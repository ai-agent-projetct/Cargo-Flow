import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Download, FileText } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { SIMPLE_MASTER_LISTS } from './freightMastersData';

// Generic reference-data list used for the remaining "Freight Masters"
// dropdown items (Unit of Measures, Transport Modes, Cargo Types, HAZ Class,
// etc.). Each one renders a simple read-only table from static master data,
// matching the look of CargoFlo ERP's settings list screens.
const SimpleMasterList = () => {
  const params = useParams();
  const slug = params['*'] || '';
  const config = SIMPLE_MASTER_LISTS[slug] || { title: slug, columns: ['Name'], rows: [] };
  const [search, setSearch] = useState('');

  const filtered = config.rows.filter((row) =>
    !search || row.some((cell) => String(cell).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{config.title}</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Create
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{filtered.length}/{filtered.length}</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" className="rounded border-slate-300" disabled />
                  </th>
                  {config.columns.map((col) => (
                    <th key={col} className="text-left px-4 py-3">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-slate-300" />
                    </td>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleMasterList;
