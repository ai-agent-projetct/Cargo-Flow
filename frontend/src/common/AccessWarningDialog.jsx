import React from 'react';
import { X } from 'lucide-react';
import { usePermissions } from '../context/PermissionContext';

// The ERP's access-denied dialog, wording and layout matching CargoFlo:
//
//   Warning
//   Due to security restrictions, you are not allowed to access
//   'House Shipment' (freight.house.shipment) records.
//
//   Contact your administrator to request access if necessary.
//                                                          [ Ok ]
const AccessWarningDialog = () => {
  const { denial, setDenial } = usePermissions();
  if (!denial) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-24">
      <div className="bg-white rounded w-full max-w-3xl shadow-2xl">
        <div className="flex items-start justify-between px-8 pt-6 pb-2">
          <h2 className="text-3xl font-bold text-blue-700">Warning</h2>
          <button onClick={() => setDenial(null)} className="text-gray-500 hover:text-gray-800" aria-label="Close">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="px-8 pb-6 space-y-4">
          {(denial.message || '').split('\n\n').map((para, i) => (
            <p key={i} className="text-base text-gray-800">{para}</p>
          ))}
        </div>
        <div className="px-8 pb-6">
          <button
            onClick={() => setDenial(null)}
            className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white text-base font-medium rounded"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessWarningDialog;
