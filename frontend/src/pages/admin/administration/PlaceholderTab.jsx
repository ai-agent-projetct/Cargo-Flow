import React, { useState } from 'react';
import { Plus, Download, Inbox } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import toast from 'react-hot-toast';

const PlaceholderTab = ({ title }) => {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast('Coming soon')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button onClick={() => toast('Coming soon')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="max-w-md" />
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
          <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
          <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Inbox className="w-10 h-10 mb-2" />
          <p className="text-sm">No records found</p>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderTab;
