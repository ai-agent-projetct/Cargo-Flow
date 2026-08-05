import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, PACKAGE_TYPES, DIMENSION_UNITS, WEIGHT_UNITS } from './constants';

const emptyRow = {
  description: '',
  packageType: 'Carton',
  quantity: 1,
  length: 0,
  width: 0,
  height: 0,
  dimensionUnit: 'cm',
  weightPerUnit: 0,
  weightUnit: 'kg',
};

const computeVolume = (row) => {
  const qty = parseFloat(row.quantity) || 0;
  const l = parseFloat(row.length) || 0;
  const w = parseFloat(row.width) || 0;
  const h = parseFloat(row.height) || 0;
  let vol = l * w * h * qty;
  // convert to m3
  if (row.dimensionUnit === 'cm') vol = vol / 1_000_000;
  else if (row.dimensionUnit === 'in') vol = vol * 0.0000163871;
  return vol;
};

const PackagesTab = ({ form, setField }) => {
  const rows = form.packageLines || [];

  const updateRow = (idx, key, value) => {
    setField('packageLines', rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setField('packageLines', [...rows, { ...emptyRow }]);
  const removeRow = (idx) => setField('packageLines', rows.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    const currentRows = form.packageLines || [];
    let totalQty = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    currentRows.forEach((row) => {
      const qty = parseFloat(row.quantity) || 0;
      let weight = (parseFloat(row.weightPerUnit) || 0) * qty;
      if (row.weightUnit === 'lb') weight = weight * 0.453592;
      totalQty += qty;
      totalWeight += weight;
      totalVolume += computeVolume(row);
    });
    return { totalQty, totalWeight, totalVolume };
  }, [form.packageLines]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
          <Plus className="w-3.5 h-3.5" /> Add Package Line
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">No package lines added</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 pr-2">Description</th>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Qty</th>
                <th className="pb-2 pr-2">L</th>
                <th className="pb-2 pr-2">W</th>
                <th className="pb-2 pr-2">H</th>
                <th className="pb-2 pr-2">Unit</th>
                <th className="pb-2 pr-2">Weight/Unit</th>
                <th className="pb-2 pr-2">Wt Unit</th>
                <th className="pb-2 pr-2">Volume (m3)</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="py-2 pr-2 min-w-[120px]"><input type="text" className={inputClass} value={row.description || ''} onChange={(e) => updateRow(idx, 'description', e.target.value)} /></td>
                  <td className="py-2 pr-2 min-w-[100px]">
                    <select className={inputClass} value={row.packageType || 'Carton'} onChange={(e) => updateRow(idx, 'packageType', e.target.value)}>
                      {PACKAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2 w-20"><input type="number" className={inputClass} value={row.quantity ?? ''} onChange={(e) => updateRow(idx, 'quantity', e.target.value)} /></td>
                  <td className="py-2 pr-2 w-20"><input type="number" className={inputClass} value={row.length ?? ''} onChange={(e) => updateRow(idx, 'length', e.target.value)} /></td>
                  <td className="py-2 pr-2 w-20"><input type="number" className={inputClass} value={row.width ?? ''} onChange={(e) => updateRow(idx, 'width', e.target.value)} /></td>
                  <td className="py-2 pr-2 w-20"><input type="number" className={inputClass} value={row.height ?? ''} onChange={(e) => updateRow(idx, 'height', e.target.value)} /></td>
                  <td className="py-2 pr-2 w-20">
                    <select className={inputClass} value={row.dimensionUnit || 'cm'} onChange={(e) => updateRow(idx, 'dimensionUnit', e.target.value)}>
                      {DIMENSION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2 w-24"><input type="number" className={inputClass} value={row.weightPerUnit ?? ''} onChange={(e) => updateRow(idx, 'weightPerUnit', e.target.value)} /></td>
                  <td className="py-2 pr-2 w-20">
                    <select className={inputClass} value={row.weightUnit || 'kg'} onChange={(e) => updateRow(idx, 'weightUnit', e.target.value)}>
                      {WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2 w-24 text-gray-600">{computeVolume(row).toFixed(4)}</td>
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

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-6 bg-gray-50 rounded-lg p-4 text-sm">
          <div><span className="text-gray-500">Total Qty:</span> <span className="font-semibold">{totals.totalQty}</span></div>
          <div><span className="text-gray-500">Total Weight:</span> <span className="font-semibold">{totals.totalWeight.toFixed(2)} kg</span></div>
          <div><span className="text-gray-500">Total Volume:</span> <span className="font-semibold">{totals.totalVolume.toFixed(4)} m3</span></div>
        </div>
      )}
    </div>
  );
};

export default PackagesTab;
