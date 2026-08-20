import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown } from 'lucide-react';
import { CONTAINER_SERVICE_MODES } from './freightMastersData';
import MasterListToolbar from './MasterListToolbar';

// "Administration > Freight Masters > Container Service Mode" list,
// mirroring CargoFlo ERP's "Container Service Mode" screen (drag handle,
// Code, Name, Active toggle columns). Clicking a row opens its own detail
// page.
const ContainerServiceModeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = CONTAINER_SERVICE_MODES.filter((csm) =>
    !search ||
    csm.name.toLowerCase().includes(search.toLowerCase()) ||
    csm.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Container Service Mode</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="container-service-mode"
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
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((csm) => (
                <tr
                  key={csm.code}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(encodeURIComponent(csm.code))}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-3 text-slate-300">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-4 py-3 font-medium text-primary-600">{csm.code}</td>
                  <td className="px-4 py-3 text-primary-600">{csm.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-9 h-5 rounded-full ${csm.active ? 'bg-primary-600' : 'bg-slate-300'}`}>
                      <span className="text-[10px] text-white">{csm.active ? '✓' : ''}</span>
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

export default ContainerServiceModeList;
