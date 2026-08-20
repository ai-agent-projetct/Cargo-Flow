import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { MEASUREMENT_BASES } from './measurementBasisData';
import { TRANSPORT_MODES } from './freightMastersData';
import MasterListToolbar from './MasterListToolbar';

// "Administration > Freight Masters > Measurement Basis" list, mirroring
// CargoFlo ERP's "Measurement Basis" screen: Name / Transport Mode (tags) /
// Package Group / Is Job Measurement / Is Slab Based / Active columns.
// Clicking a row opens its detail page.
const MeasurementBasisList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const modeLabel = (code) => {
    const tm = TRANSPORT_MODES.find((t) => t.code === code);
    return tm ? `[${tm.code}] ${tm.name}` : code;
  };

  const items = MEASUREMENT_BASES.map((mb, i) => ({ ...mb, idx: i }));
  const filtered = items.filter((mb) =>
    !search || mb.name.toLowerCase().includes(search.toLowerCase())
  );

  const Toggle = ({ value }) => (
    <span className={`relative inline-flex items-center w-11 h-6 rounded-full ${value ? 'bg-primary-600' : 'bg-slate-300'}`}>
      <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-[10px] ${value ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
        {value ? '✓' : '✕'}
      </span>
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Measurement Basis</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="measurement-basis"
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
                <th className="text-left px-4 py-3">Transport Mode</th>
                <th className="text-left px-4 py-3">Package Group</th>
                <th className="text-left px-4 py-3">Is Job Measurement</th>
                <th className="text-left px-4 py-3">Is Slab Based</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="px-2 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((mb) => (
                <tr
                  key={mb.idx}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`${mb.idx}`)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-3 text-slate-300">⋮</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{mb.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {mb.transportModes.map((code) => (
                        <span key={code} className="px-2 py-0.5 text-xs border border-slate-200 rounded-full text-slate-600 whitespace-nowrap">
                          {modeLabel(code)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{mb.packageGroup}</td>
                  <td className="px-4 py-3"><Toggle value={mb.isJobMeasurement} /></td>
                  <td className="px-4 py-3"><Toggle value={mb.isSlabBased} /></td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={mb.active} readOnly className="rounded border-slate-300" />
                  </td>
                  <td className="px-2 py-3 text-slate-300">
                    <MoreVertical className="w-4 h-4" />
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

export default MeasurementBasisList;
