import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

// Procurement top tab bar. The demo's Procurement menu currently carries a
// single entry, Purchase.
const TABS = [
  { label: 'Purchase', path: '/admin/procurement/purchase-orders' },
];

const ProcurementLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-1 px-3 overflow-visible flex-wrap">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default ProcurementLayout;
