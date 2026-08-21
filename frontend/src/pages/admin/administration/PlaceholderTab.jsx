import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Inbox, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchBar from '../../../common/SearchBar';
import { MASTER_DATA_CONFIG } from './manageMastersData';
import { exportCsv } from '../../../utils/exportCsv';

// The landing screen for Administration — what you see before picking a tab.
// It has no records of its own, so rather than a Create button over nothing it
// indexes the master-data lists that do hold records and opens them.
const titleFor = (key, cfg) => cfg?.title
  || key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const PlaceholderTab = ({ title }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const sections = useMemo(() => Object.entries(MASTER_DATA_CONFIG)
    .map(([key, cfg]) => ({
      key,
      title: titleFor(key, cfg),
      fields: (cfg?.fields || []).length,
    }))
    .filter((s) => !search.trim() || s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title)), [search]);

  const handleExport = () => {
    if (exportCsv(sections, [
      { key: 'title', label: 'Section' },
      { key: 'key', label: 'Reference' },
      { key: 'fields', label: 'Fields' },
    ], 'administration-sections')) {
      toast.success(`Exported ${sections.length} sections`);
    } else {
      toast.error('Nothing to export');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button onClick={handleExport} title="Export this index"
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <SearchBar value={search} onChange={setSearch} placeholder="Search sections..." className="max-w-md" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Inbox className="w-10 h-10 mb-2" />
            <p className="text-sm">No section matches “{search}”</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sections.map((s) => (
              <button key={s.key}
                onClick={() => navigate(`/admin/administration/manage/${s.key}`)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.title}</p>
                  <p className="text-xs text-slate-400">
                    {s.fields ? `${s.fields} field${s.fields === 1 ? '' : 's'}` : 'Reference list'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaceholderTab;
