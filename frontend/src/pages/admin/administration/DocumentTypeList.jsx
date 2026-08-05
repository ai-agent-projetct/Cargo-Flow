import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronLeft } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { DOCUMENT_TYPES } from './documentTypeData';

// "Administration > Freight Masters > Document Type" list, mirroring
// SeaRates ERP's "Document Type" screen: a "Create" button, Document Type /
// Related Model / Document Mode / Active columns. Clicking a row opens its
// detail page.
const DocumentTypeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const items = DOCUMENT_TYPES.map((dt, i) => ({ ...dt, idx: i }));
  const filtered = items.filter((dt) =>
    !search ||
    dt.name.toLowerCase().includes(search.toLowerCase()) ||
    dt.relatedModel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Document Type</h2>
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
                <th className="text-left px-4 py-3">Document Type</th>
                <th className="text-left px-4 py-3">Related Model</th>
                <th className="text-left px-4 py-3">Document Mode</th>
                <th className="text-left px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((dt) => (
                <tr
                  key={dt.idx}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`${dt.idx}`)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-3 text-slate-300">⋮</td>
                  <td className="px-4 py-3 font-medium text-primary-600">{dt.name}</td>
                  <td className="px-4 py-3 text-primary-600">{dt.relatedModel}</td>
                  <td className="px-4 py-3 text-slate-700">{dt.documentMode}</td>
                  <td className="px-4 py-3">
                    <span className={`relative inline-flex items-center w-11 h-6 rounded-full ${dt.active ? 'bg-primary-600' : 'bg-slate-300'}`}>
                      <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-[10px] ${dt.active ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                        {dt.active ? '✓' : ''}
                      </span>
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

export default DocumentTypeList;
