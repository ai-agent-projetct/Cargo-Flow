import React from 'react';
import { X } from 'lucide-react';

// Generic single-line Odoo-style "Warning" dialog, e.g. shown when
// duplicating a record whose "name" field must be unique.
const SimpleWarningModal = ({ open, onClose, message }) => {
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
        <p className="text-sm text-slate-700 mb-4">{message}</p>
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

export default SimpleWarningModal;
