import React from 'react';
import { inputClass, labelClass } from './constants';

const RemarksTab = ({ form, setField }) => (
  <div>
    <label className={labelClass}>Remarks</label>
    <textarea
      rows={10}
      className={inputClass}
      value={form.remarks || ''}
      onChange={(e) => setField('remarks', e.target.value)}
      placeholder="Internal remarks / notes for this shipment..."
    />
  </div>
);

export default RemarksTab;
