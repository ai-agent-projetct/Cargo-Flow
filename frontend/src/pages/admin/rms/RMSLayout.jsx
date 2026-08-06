import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import ImportRMSModal from './ImportRMSModal';

// RMS top tab bar: Tariff | Import RMS. "Import RMS" opens a modal rather than
// navigating, matching the demo where its action has target="new".
const RMSLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [importOpen, setImportOpen] = useState(false);

  const onTariff = pathname.startsWith('/admin/rms/tariffs');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-1 px-3 overflow-visible flex-wrap">
          <button
            onClick={() => navigate('/admin/rms/tariffs')}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              onTariff ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Tariff
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              importOpen ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Import RMS
          </button>
        </div>
      </div>

      <Outlet />

      {importOpen && <ImportRMSModal onClose={() => setImportOpen(false)} />}
    </div>
  );
};

export default RMSLayout;
