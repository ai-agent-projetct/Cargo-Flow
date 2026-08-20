import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { CARGO_TYPES, TRANSPORT_MODES } from './freightMastersData';
import ArchiveConfirmModal from './ArchiveConfirmModal';

// "Administration > Freight Masters > Cargo Type / [CODE] Name" detail view,
// mirroring CargoFlo ERP: breadcrumb with record pagination (1/15, with
// prev/next chevrons), an "Action" dropdown (Archive + Confirmation popup),
// Name, Code, Transport Mode link, Calculated Dimension LWH / Is Package
// Group / Active / Is Courier Shipment toggles, and "Cargo Sub Type" /
// "Summary" tabs.
const CargoTypeDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [summary, setSummary] = useState('');
  const [activeTab, setActiveTab] = useState('subtype');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [active, setActive] = useState(true);
  const [isPackageGroup, setIsPackageGroup] = useState(false);
  const [isCourierShipment, setIsCourierShipment] = useState(false);
  const [calculatedDimensionLWH, setCalculatedDimensionLWH] = useState(false);
  const menuRef = useRef(null);

  const index = CARGO_TYPES.findIndex((ct) => `${ct.transportMode}-${ct.code}` === id);
  const item = CARGO_TYPES[index] || CARGO_TYPES[0];
  const total = CARGO_TYPES.length;
  const safeIndex = index === -1 ? 0 : index;

  const transportMode = TRANSPORT_MODES.find((tm) => tm.code === item.transportMode);

  useEffect(() => {
    setActive(item.active);
    setIsPackageGroup(item.isPackageGroup);
    setIsCourierShipment(item.isCourierShipment);
    setCalculatedDimensionLWH(item.calculatedDimensionLWH);
  }, [item]);

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
    const nextIndex = (safeIndex + delta + total) % total;
    const next = CARGO_TYPES[nextIndex];
    navigate(`/admin/administration/freight-masters/cargo-types/${next.transportMode}-${next.code}`);
  };

  const Toggle = ({ value, onToggle }) => (
    <button
      onClick={onToggle}
      className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center text-[10px] ${value ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
        {value ? '✓' : ''}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/cargo-types')}
            className="text-primary-600 font-medium hover:underline"
          >
            Cargo Type
          </button>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-700">[{item.code}] {item.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{safeIndex + 1} / {total}</span>
          <button onClick={() => goRelative(-1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goRelative(1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action dropdown */}
      <div className="flex justify-center relative" ref={menuRef}>
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
                setShowArchiveConfirm(true);
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Archive
            </button>
          </div>
        )}
      </div>

      <ArchiveConfirmModal
        open={showArchiveConfirm}
        onConfirm={() => setShowArchiveConfirm(false)}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div>
          <p className="text-xs text-slate-500 mb-1">Name</p>
          <h2 className="text-2xl font-bold text-slate-900">{item.name}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Code</p>
              <span className="text-slate-700">{item.code}</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Transport Mode</p>
              <button
                onClick={() => navigate(`/admin/administration/freight-masters/transport-modes/${item.transportMode}`)}
                className="text-primary-600 hover:underline"
              >
                {transportMode ? `[${transportMode.code}] ${transportMode.name}` : item.transportMode}
              </button>
            </div>
            <div className="flex items-center justify-between max-w-xs">
              <p className="text-xs text-slate-500">Calculated Dimension LWH</p>
              <Toggle value={calculatedDimensionLWH} onToggle={() => setCalculatedDimensionLWH((p) => !p)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between max-w-xs">
              <p className="text-xs text-slate-500">Is Package Group</p>
              <Toggle value={isPackageGroup} onToggle={() => setIsPackageGroup((p) => !p)} />
            </div>
            <div className="flex items-center justify-between max-w-xs">
              <p className="text-xs text-slate-500">Active</p>
              <Toggle value={active} onToggle={() => setActive((p) => !p)} />
            </div>
            <div className="flex items-center justify-between max-w-xs">
              <p className="text-xs text-slate-500">Is Courier Shipment</p>
              <Toggle value={isCourierShipment} onToggle={() => setIsCourierShipment((p) => !p)} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <button
              onClick={() => setActiveTab('subtype')}
              className={`text-sm font-semibold pb-2 ${activeTab === 'subtype' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}
            >
              Cargo Sub Type
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`text-sm font-semibold pb-2 ${activeTab === 'summary' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}
            >
              Summary
            </button>
          </div>

          {activeTab === 'subtype' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-2 py-2 text-slate-700 font-semibold">Name</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-2 py-3">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border-0 focus:outline-none focus:ring-0 resize-none"
              placeholder=""
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CargoTypeDetail;
