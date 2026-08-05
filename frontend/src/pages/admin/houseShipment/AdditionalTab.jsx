import React from 'react';
import { inputClass, labelClass } from './constants';

const AdditionalTab = ({ form, setField }) => {
  const fields = [
    { key: 'carrier', label: 'Carrier' },
    { key: 'vesselName', label: 'Vessel Name' },
    { key: 'voyageNumber', label: 'Voyage Number' },
    { key: 'flightNumber', label: 'Flight Number' },
    { key: 'mblNumber', label: 'MBL Number' },
    { key: 'hblNumber', label: 'HBL Number' },
    { key: 'awbNumber', label: 'AWB Number' },
    { key: 'hawbNumber', label: 'HAWB Number' },
    { key: 'commodity', label: 'Commodity' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className={labelClass}>{label}</label>
          <input
            type="text"
            className={inputClass}
            value={form[key] || ''}
            onChange={(e) => setField(key, e.target.value)}
          />
        </div>
      ))}
      <div className="md:col-span-2">
        <label className={labelClass}>Container Numbers (comma-separated)</label>
        <input
          type="text"
          className={inputClass}
          value={(form.containerNumbers || []).join(', ')}
          onChange={(e) =>
            setField(
              'containerNumbers',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        />
      </div>
    </div>
  );
};

export default AdditionalTab;
