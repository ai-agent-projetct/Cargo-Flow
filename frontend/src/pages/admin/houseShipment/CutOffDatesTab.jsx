import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, labelClass, CUTOFF_PRESETS } from './constants';

const CutOffDatesTab = ({ form, setField }) => {
  const rows = form.cutOffDates || [];

  const updateRow = (idx, key, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r));
    setField('cutOffDates', next);
  };

  const addRow = (label = '') => {
    setField('cutOffDates', [...rows, { label, datetime: '' }]);
  };

  const removeRow = (idx) => {
    setField('cutOffDates', rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CUTOFF_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => addRow(preset)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
          >
            + {preset}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addRow('')}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Custom
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">No cut-off dates added</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <label className={labelClass}>Label</label>
                <input
                  type="text"
                  className={inputClass}
                  value={row.label || ''}
                  onChange={(e) => updateRow(idx, 'label', e.target.value)}
                />
              </div>
              <div className="col-span-5">
                <label className={labelClass}>Date / Time</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={row.datetime || ''}
                  onChange={(e) => updateRow(idx, 'datetime', e.target.value)}
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CutOffDatesTab;
