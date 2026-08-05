import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, ROUTING_MODES } from './constants';

const emptyRow = (legNumber) => ({
  legNumber,
  mode: 'SEA',
  from: '',
  to: '',
  carrier: '',
  vesselFlightNumber: '',
  etd: '',
  eta: '',
});

const RoutingTab = ({ form, setField }) => {
  const rows = form.routingLegs || [];

  const updateRow = (idx, key, value) => {
    setField('routingLegs', rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setField('routingLegs', [...rows, emptyRow(rows.length + 1)]);
  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, legNumber: i + 1 }));
    setField('routingLegs', next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
          <Plus className="w-3.5 h-3.5" /> Add Leg
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">No routing legs added (single-leg shipment)</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 pr-2">Leg #</th>
                <th className="pb-2 pr-2">Mode</th>
                <th className="pb-2 pr-2">From</th>
                <th className="pb-2 pr-2">To</th>
                <th className="pb-2 pr-2">Carrier</th>
                <th className="pb-2 pr-2">Vessel/Flight #</th>
                <th className="pb-2 pr-2">ETD</th>
                <th className="pb-2 pr-2">ETA</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="py-2 pr-2 w-16 text-center font-medium">{row.legNumber}</td>
                  <td className="py-2 pr-2 w-24">
                    <select className={inputClass} value={row.mode || 'SEA'} onChange={(e) => updateRow(idx, 'mode', e.target.value)}>
                      {ROUTING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2 min-w-[120px]"><input type="text" className={inputClass} value={row.from || ''} onChange={(e) => updateRow(idx, 'from', e.target.value)} /></td>
                  <td className="py-2 pr-2 min-w-[120px]"><input type="text" className={inputClass} value={row.to || ''} onChange={(e) => updateRow(idx, 'to', e.target.value)} /></td>
                  <td className="py-2 pr-2 min-w-[120px]"><input type="text" className={inputClass} value={row.carrier || ''} onChange={(e) => updateRow(idx, 'carrier', e.target.value)} /></td>
                  <td className="py-2 pr-2 min-w-[120px]"><input type="text" className={inputClass} value={row.vesselFlightNumber || ''} onChange={(e) => updateRow(idx, 'vesselFlightNumber', e.target.value)} /></td>
                  <td className="py-2 pr-2 min-w-[160px]"><input type="datetime-local" className={inputClass} value={row.etd || ''} onChange={(e) => updateRow(idx, 'etd', e.target.value)} /></td>
                  <td className="py-2 pr-2 min-w-[160px]"><input type="datetime-local" className={inputClass} value={row.eta || ''} onChange={(e) => updateRow(idx, 'eta', e.target.value)} /></td>
                  <td className="py-2">
                    <button type="button" onClick={() => removeRow(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RoutingTab;
