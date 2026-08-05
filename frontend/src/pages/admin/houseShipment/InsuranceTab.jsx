import React from 'react';
import { inputClass, labelClass, CURRENCIES } from './constants';

const InsuranceTab = ({ form, setField }) => {
  const insurance = form.insurance || {};

  const update = (key, value) => {
    setField('insurance', { ...insurance, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex items-center gap-2 md:col-span-2">
        <input
          type="checkbox"
          id="insured"
          checked={!!insurance.insured}
          onChange={(e) => update('insured', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="insured" className="text-sm font-medium text-gray-700">Insured</label>
      </div>
      <div>
        <label className={labelClass}>Insurance Provider</label>
        <input type="text" className={inputClass} value={insurance.insuranceProvider || ''} onChange={(e) => update('insuranceProvider', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Policy Number</label>
        <input type="text" className={inputClass} value={insurance.policyNumber || ''} onChange={(e) => update('policyNumber', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Insured Value</label>
        <input type="number" className={inputClass} value={insurance.insuredValue ?? ''} onChange={(e) => update('insuredValue', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Insurance Currency</label>
        <select className={inputClass} value={insurance.insuranceCurrency || 'AED'} onChange={(e) => update('insuranceCurrency', e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Premium</label>
        <input type="number" className={inputClass} value={insurance.premium ?? ''} onChange={(e) => update('premium', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Coverage Type</label>
        <input type="text" placeholder="e.g. All Risk, ICC A/B/C" className={inputClass} value={insurance.coverageType || ''} onChange={(e) => update('coverageType', e.target.value)} />
      </div>
    </div>
  );
};

export default InsuranceTab;
