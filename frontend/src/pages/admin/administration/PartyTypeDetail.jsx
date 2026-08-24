import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { PARTY_TYPES, PARTY_TYPE_COLORS } from './partyTypeData';
import SimpleWarningModal from './SimpleWarningModal';

// "Administration > Freight Masters > Party Type / Name" detail view,
// mirroring CargoFlo ERP: breadcrumb with record pagination (N/Total, with
// prev/next chevrons), "Edit" button, an "Action" dropdown with only
// "Duplicate" (which surfaces a "The name must be unique!" Warning dialog),
// Name, Code, Is Vendor checkbox, Color swatch, and a "Partner Type Field
// Line" table.
const PartyTypeDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const menuRef = useRef(null);

  const total = PARTY_TYPES.length;
  const index = Math.min(Math.max(parseInt(id, 10) || 0, 0), total - 1);
  const item = PARTY_TYPES[index];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goRelative = (delta) => {
    const nextIndex = (index + delta + total) % total;
    navigate(`/admin/administration/freight-masters/party-type/${nextIndex}`);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/party-type')}
            className="text-primary-600 font-medium hover:underline"
          >
            Party Type
          </button>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-700">{item.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{index + 1} / {total}</span>
          <button onClick={() => goRelative(-1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goRelative(1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit + Action */}
      <div className="flex justify-center items-center gap-2 relative" ref={menuRef}>
        <button
          onClick={() => navigate(`/admin/administration/freight-masters/party-type/${index}/edit`)}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg"
        >
          Edit
        </button>
        <button
          onClick={() => setShowActionMenu((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          <Settings className="w-3.5 h-3.5" /> Action
        </button>
        {showActionMenu && (
          <div className="absolute top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
            <button
              onClick={() => {
                setShowActionMenu(false);
                setShowWarning(true);
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Duplicate
            </button>
          </div>
        )}
      </div>

      <SimpleWarningModal
        open={showWarning}
        onClose={() => setShowWarning(false)}
        message="The name must be unique!"
      />

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-x-12 gap-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Name</p>
            <span className="text-slate-700">{item.name}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Is Vendor</p>
            <input type="checkbox" checked={item.isVendor} readOnly className="rounded border-slate-300" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Code</p>
            <span className="text-slate-700">{item.code}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Color</p>
            <span
              className="inline-block w-6 h-6 rounded border border-slate-200"
              style={{ backgroundColor: PARTY_TYPE_COLORS[item.color] }}
            />
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
              {item.fieldLines.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-2 border-b border-slate-100"></td>
                </tr>
              ) : (
                item.fieldLines.map((fl, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{fl.model}</td>
                    <td className="py-2">{fl.modelField}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* This view is read-only; lines are added on the edit form. */}
          <button onClick={() => navigate(`/admin/administration/freight-masters/party-type/${id}/edit`)}
            className="text-primary-600 text-sm font-medium mt-2 hover:underline">
            Add a line
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartyTypeDetail;
