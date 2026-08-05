import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PARTY_TYPES, PARTY_TYPE_COLORS } from './partyTypeData';

// "Administration > Freight Masters > Party Type / New" (and "/Edit") form,
// mirroring SeaRates ERP's Party Type create/edit screen: Name, Code, Is
// Vendor checkbox, Color swatch picker, "Partner Type Field Line" table with
// "Add a line", and Save/Discard buttons.
const PartyTypeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = id !== undefined;

  const total = PARTY_TYPES.length;
  const editIndex = isEdit ? Math.min(Math.max(parseInt(id, 10) || 0, 0), total - 1) : null;
  const existing = isEdit ? PARTY_TYPES[editIndex] : null;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isVendor, setIsVendor] = useState(false);
  const [color, setColor] = useState(0);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCode(existing.code);
      setIsVendor(existing.isVendor);
      setColor(existing.color);
    }
  }, [existing]);

  const goBack = () => {
    if (isEdit) {
      navigate(`/admin/administration/freight-masters/party-type/${editIndex}`);
    } else {
      navigate('/admin/administration/freight-masters/party-type');
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="text-sm">
        <button
          onClick={() => navigate('/admin/administration/freight-masters/party-type')}
          className="text-primary-600 font-medium hover:underline"
        >
          Party Type
        </button>
        <span className="text-slate-400"> / </span>
        <span className="text-slate-700">{isEdit ? existing.name : 'New'}</span>
      </div>

      {/* Save / Discard */}
      <div className="flex justify-center gap-2">
        <button
          onClick={goBack}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg"
        >
          Save
        </button>
        <button
          onClick={goBack}
          className="px-4 py-1.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50"
        >
          Discard
        </button>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-x-12 gap-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Shipper"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Is Vendor</label>
            <input
              type="checkbox"
              checked={isVendor}
              onChange={(e) => setIsVendor(e.target.checked)}
              className="rounded border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. SHIPPER"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {PARTY_TYPE_COLORS.map((hex, i) => (
                <button
                  key={i}
                  onClick={() => setColor(i)}
                  className={`w-6 h-6 rounded border ${color === i ? 'border-primary-600 ring-2 ring-primary-300' : 'border-slate-200'}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Partner Type Field Line */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-base font-semibold text-primary-600 mb-2">Partner Type Field Line</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="text-left py-2 font-medium">Model</th>
                <th className="text-left py-2 font-medium">Model Field</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2} className="py-2 border-b border-slate-100"></td>
              </tr>
            </tbody>
          </table>
          <button className="text-primary-600 text-sm font-medium mt-2 hover:underline">
            Add a line
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartyTypeForm;
