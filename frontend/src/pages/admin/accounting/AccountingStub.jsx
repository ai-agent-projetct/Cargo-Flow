import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { MENU_INDEX } from './menu';

// Placeholder for menu entries whose module has not been built yet. The full
// 118-node menu is wired from the start so navigation is complete and each
// build wave simply replaces stubs — nothing 404s in the meantime.
const AccountingStub = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const entry = MENU_INDEX.find((m) => pathname.startsWith(m.href));

  return (
    <div className="px-6 pb-6">
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center max-w-2xl mx-auto mt-8">
        <Construction className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900">{entry?.label || 'Accounting'}</h2>
        {entry?.group && (
          <p className="text-sm text-gray-500 mt-1">{entry.menu} › {entry.group}</p>
        )}
        <p className="text-sm text-gray-600 mt-4">
          This screen is mapped from the ERP menu but has not been built yet.
          It arrives in a later build wave.
        </p>
        <button
          onClick={() => navigate('/admin/accounting/dashboard')}
          className="mt-6 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default AccountingStub;
