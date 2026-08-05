import React from 'react';
import { inputClass, labelClass, CUSTOMS_STATUSES } from './constants';

const CustomsTab = ({ form, setField }) => {
  const customs = form.customs || {};

  const update = (key, value) => {
    setField('customs', { ...customs, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex items-center gap-2 md:col-span-2">
        <input
          type="checkbox"
          id="customsClearanceRequired"
          checked={!!customs.customsClearanceRequired}
          onChange={(e) => update('customsClearanceRequired', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="customsClearanceRequired" className="text-sm font-medium text-gray-700">Customs Clearance Required</label>
      </div>
      <div>
        <label className={labelClass}>HS Code</label>
        <input type="text" className={inputClass} value={customs.hsCode || ''} onChange={(e) => update('hsCode', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Customs Broker Name</label>
        <input type="text" className={inputClass} value={customs.customsBrokerName || ''} onChange={(e) => update('customsBrokerName', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Declaration Number</label>
        <input type="text" className={inputClass} value={customs.declarationNumber || ''} onChange={(e) => update('declarationNumber', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Duty Amount</label>
        <input type="number" className={inputClass} value={customs.dutyAmount ?? ''} onChange={(e) => update('dutyAmount', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Customs Status</label>
        <select className={inputClass} value={customs.customsStatus || 'pending'} onChange={(e) => update('customsStatus', e.target.value)}>
          {CUSTOMS_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>Remarks</label>
        <textarea rows={3} className={inputClass} value={customs.remarks || ''} onChange={(e) => update('remarks', e.target.value)} />
      </div>
    </div>
  );
};

export default CustomsTab;
