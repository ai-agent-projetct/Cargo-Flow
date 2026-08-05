import React from 'react';
import { inputClass, labelClass } from './constants';

const toLocalDateTime = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CarriageTab = ({ form, setField, ports }) => {
  const portTypeMap = { AIR: 'air', SEA: 'sea', ROAD: 'inland', RAIL: 'rail' };
  const relevantType = portTypeMap[form.transportMode] || 'sea';
  const filteredPorts = (ports || []).filter((p) => p.type === relevantType);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Origin */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Origin</h3>
        <div>
          <label className={labelClass}>Origin Country</label>
          <input type="text" className={inputClass} value={form.originCountry || ''} onChange={(e) => setField('originCountry', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Origin (City)</label>
          <input type="text" className={inputClass} value={form.origin || ''} onChange={(e) => setField('origin', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Origin Port</label>
          <select
            className={inputClass}
            value={form.originPortId || ''}
            onChange={(e) => {
              const port = filteredPorts.find((p) => p.id === e.target.value);
              setField('originPortId', e.target.value || null);
              if (port) setField('originCode', port.code);
            }}
          >
            <option value="">-- Select Port --</option>
            {filteredPorts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>ETD</label>
          <input type="datetime-local" className={inputClass} value={toLocalDateTime(form.etd)} onChange={(e) => setField('etd', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ATD</label>
          <input type="datetime-local" className={inputClass} value={toLocalDateTime(form.atd)} onChange={(e) => setField('atd', e.target.value)} />
        </div>
      </div>

      {/* Destination */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Destination</h3>
        <div>
          <label className={labelClass}>Destination Country</label>
          <input type="text" className={inputClass} value={form.destinationCountry || ''} onChange={(e) => setField('destinationCountry', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Destination (City)</label>
          <input type="text" className={inputClass} value={form.destination || ''} onChange={(e) => setField('destination', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Destination Port</label>
          <select
            className={inputClass}
            value={form.destinationPortId || ''}
            onChange={(e) => {
              const port = filteredPorts.find((p) => p.id === e.target.value);
              setField('destinationPortId', e.target.value || null);
              if (port) setField('destinationCode', port.code);
            }}
          >
            <option value="">-- Select Port --</option>
            {filteredPorts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>ETA</label>
          <input type="datetime-local" className={inputClass} value={toLocalDateTime(form.eta)} onChange={(e) => setField('eta', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ATA</label>
          <input type="datetime-local" className={inputClass} value={toLocalDateTime(form.ata)} onChange={(e) => setField('ata', e.target.value)} />
        </div>
      </div>
    </div>
  );
};

export default CarriageTab;
