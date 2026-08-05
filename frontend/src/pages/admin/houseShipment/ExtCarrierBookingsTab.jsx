import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, BOOKING_STATUSES } from './constants';

const emptyRow = { carrierName: '', bookingNumber: '', bookingDate: '', status: 'requested' };

const ExtCarrierBookingsTab = ({ form, setField }) => {
  const rows = form.extCarrierBookings || [];

  const updateRow = (idx, key, value) => {
    setField('extCarrierBookings', rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setField('extCarrierBookings', [...rows, { ...emptyRow }]);
  const removeRow = (idx) => setField('extCarrierBookings', rows.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
          <Plus className="w-3.5 h-3.5" /> Add Booking
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">No external carrier bookings added</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 pr-2">Carrier Name</th>
                <th className="pb-2 pr-2">Booking Number</th>
                <th className="pb-2 pr-2">Booking Date</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="py-2 pr-2"><input type="text" className={inputClass} value={row.carrierName || ''} onChange={(e) => updateRow(idx, 'carrierName', e.target.value)} /></td>
                  <td className="py-2 pr-2"><input type="text" className={inputClass} value={row.bookingNumber || ''} onChange={(e) => updateRow(idx, 'bookingNumber', e.target.value)} /></td>
                  <td className="py-2 pr-2"><input type="date" className={inputClass} value={row.bookingDate || ''} onChange={(e) => updateRow(idx, 'bookingDate', e.target.value)} /></td>
                  <td className="py-2 pr-2">
                    <select className={inputClass} value={row.status || 'requested'} onChange={(e) => updateRow(idx, 'status', e.target.value)}>
                      {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
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

export default ExtCarrierBookingsTab;
