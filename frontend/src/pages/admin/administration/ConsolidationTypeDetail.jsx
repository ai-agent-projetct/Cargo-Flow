import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { CONSOLIDATION_TYPES } from './freightMastersData';
import ArchiveConfirmModal from './ArchiveConfirmModal';

// "Administration > Freight Masters > Consolidation Type / [CODE] Name"
// detail view, mirroring CargoFlo ERP: breadcrumb with record pagination
// (1/8, with prev/next chevrons), an "Action" dropdown (Archive +
// Confirmation popup), Name, Code, Active toggle, and a Summary notes tab.
const ConsolidationTypeDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [summary, setSummary] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [active, setActive] = useState(true);
  const menuRef = useRef(null);

  const index = CONSOLIDATION_TYPES.findIndex((ct) => ct.code === id);
  const item = CONSOLIDATION_TYPES[index] || CONSOLIDATION_TYPES[0];
  const total = CONSOLIDATION_TYPES.length;

  useEffect(() => {
    setActive(item.active);
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
    const nextIndex = (index + delta + total) % total;
    navigate(`/admin/administration/freight-masters/consolidation-types/${CONSOLIDATION_TYPES[nextIndex].code}`);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/consolidation-types')}
            className="text-primary-600 font-medium hover:underline"
          >
            Consolidation Type
          </button>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-700">[{item.code}] {item.name}</span>
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

        <div className="flex flex-wrap items-center gap-12">
          <div>
            <p className="text-xs text-slate-500 mb-1">Code</p>
            <span className="text-slate-700">{item.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Active</p>
            <button
              onClick={() => setActive((prev) => !prev)}
              className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${active ? 'bg-primary-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center text-[10px] ${active ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                {active ? '✓' : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Summary tab */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <span className="text-sm font-semibold text-primary-600 border-b-2 border-primary-600 pb-2">Summary</span>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border-0 focus:outline-none focus:ring-0 resize-none"
            placeholder=""
          />
        </div>
      </div>
    </div>
  );
};

export default ConsolidationTypeDetail;
