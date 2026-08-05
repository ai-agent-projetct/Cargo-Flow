import React from 'react';
import { X } from 'lucide-react';

// Generic Odoo-style "Warning" dialog shown when an operation (e.g.
// Duplicate/Delete) cannot be completed because a field is mandatory or
// another model references the record, mirroring SeaRates ERP's message.
const OperationWarningModal = ({ open, onClose, model, field }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-primary-600">Warning</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-700 mb-1">The operation cannot be completed:</p>
        <p className="text-sm text-slate-700 mb-1">- Create/update: a mandatory field is not set.</p>
        <p className="text-sm text-slate-700 mb-4">- Delete: another model requires the record being deleted. If possible, archive it instead.</p>
        <p className="text-sm text-slate-700 mb-4">Model: {model}, Field: {field}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
        >
          Ok
        </button>
      </div>
    </div>
  );
};

export default OperationWarningModal;
