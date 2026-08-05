import React from 'react';
import { inputClass, labelClass } from './constants';

const TermsTab = ({ form, setField }) => (
  <div>
    <label className={labelClass}>Terms & Conditions</label>
    <textarea
      rows={10}
      className={inputClass}
      value={form.termsAndConditions || ''}
      onChange={(e) => setField('termsAndConditions', e.target.value)}
      placeholder="Enter terms and conditions for this shipment..."
    />
  </div>
);

export default TermsTab;
