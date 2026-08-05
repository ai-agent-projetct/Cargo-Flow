import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, PARTY_ROLES } from './constants';

const emptyRow = { role: 'Notify Party', name: '', contactPerson: '', email: '', phone: '' };

const PartiesTab = ({ form, setField }) => {
  const rows = form.parties || [];

  const updateRow = (idx, key, value) => {
    setField('parties', rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setField('parties', [...rows, { ...emptyRow }]);
  const removeRow = (idx) => setField('parties', rows.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
          <Plus className="w-3.5 h-3.5" /> Add Party
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">No additional parties added</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 pr-2">Role</th>
                <th className="pb-2 pr-2">Name</th>
                <th className="pb-2 pr-2">Contact Person</th>
                <th className="pb-2 pr-2">Email</th>
                <th className="pb-2 pr-2">Phone</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="py-2 pr-2">
                    <select className={inputClass} value={row.role || 'Notify Party'} onChange={(e) => updateRow(idx, 'role', e.target.value)}>
                      {PARTY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2"><input type="text" className={inputClass} value={row.name || ''} onChange={(e) => updateRow(idx, 'name', e.target.value)} /></td>
                  <td className="py-2 pr-2"><input type="text" className={inputClass} value={row.contactPerson || ''} onChange={(e) => updateRow(idx, 'contactPerson', e.target.value)} /></td>
                  <td className="py-2 pr-2"><input type="email" className={inputClass} value={row.email || ''} onChange={(e) => updateRow(idx, 'email', e.target.value)} /></td>
                  <td className="py-2 pr-2"><input type="text" className={inputClass} value={row.phone || ''} onChange={(e) => updateRow(idx, 'phone', e.target.value)} /></td>
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

export default PartiesTab;
