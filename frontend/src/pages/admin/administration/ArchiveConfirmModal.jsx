import React from 'react';
import { X } from 'lucide-react';

// Shared "Confirmation" dialog shown when a user clicks Action > Archive on a
// detail record, mirroring SeaRates ERP's confirmation popup.
const ArchiveConfirmModal = ({ open, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-primary-600">Confirmation</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">
          Are you sure that you want to archive this record?
        </div>
        <div className="flex items-center gap-2 px-5 py-3">
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded hover:bg-primary-700"
          >
            Ok
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveConfirmModal;
