import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { MEASUREMENT_BASES } from './measurementBasisData';
import { TRANSPORT_MODES } from './freightMastersData';
import ArchiveConfirmModal from './ArchiveConfirmModal';

// "Administration > Freight Masters > Measurement Basis / Name" detail view,
// mirroring SeaRates ERP: breadcrumb with record pagination (N/12, with
// prev/next chevrons), an "Action" dropdown (Archive + Confirmation popup),
// Name, "Is Job Measurement" toggle, Transport Mode tags, and Package Group.
const MeasurementBasisDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const menuRef = useRef(null);

  const total = MEASUREMENT_BASES.length;
  const index = Math.min(Math.max(parseInt(id, 10) || 0, 0), total - 1);
  const item = MEASUREMENT_BASES[index];

  const modeLabel = (code) => {
    const tm = TRANSPORT_MODES.find((t) => t.code === code);
    return tm ? `[${tm.code}] ${tm.name}` : code;
  };

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
    navigate(`/admin/administration/freight-masters/measurement-basis/${nextIndex}`);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/measurement-basis')}
            className="text-primary-600 font-medium hover:underline"
          >
            Measurement Basis
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

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500 w-32">Is Job Measurement</p>
            <span className={`relative inline-flex items-center w-11 h-6 rounded-full ${item.isJobMeasurement ? 'bg-primary-600' : 'bg-slate-300'}`}>
              <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-[10px] ${item.isJobMeasurement ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                {item.isJobMeasurement ? '✓' : '✕'}
              </span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <p className="text-xs text-slate-500 w-32 pt-1">Transport Mode</p>
            <div className="flex flex-wrap gap-1">
              {item.transportModes.map((code) => (
                <span key={code} className="px-2 py-0.5 text-xs border border-slate-200 rounded-full text-slate-600 whitespace-nowrap">
                  {modeLabel(code)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500 w-32">Package Group</p>
            <span className="text-slate-700">{item.packageGroup}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementBasisDetail;
