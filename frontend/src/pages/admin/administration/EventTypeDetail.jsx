import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { EVENT_TYPES } from './eventTypeData';
import OperationWarningModal from './OperationWarningModal';

// "Administration > Freight Masters > Event Type / [CODE] Name" detail view,
// mirroring CargoFlo ERP: breadcrumb with record pagination (1/N, with
// prev/next chevrons), an "Edit" button, an "Action" dropdown with only
// "Duplicate" (which surfaces the standard Odoo "Warning" dialog), Event
// Name, Event Code, Public Visible toggle, and a "Summary" tab.
const EventTypeDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const menuRef = useRef(null);

  const decodedId = decodeURIComponent(id);
  const index = EVENT_TYPES.findIndex((et) => et.code === decodedId);
  const item = EVENT_TYPES[index] || EVENT_TYPES[0];
  const total = EVENT_TYPES.length;

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
    navigate(`/admin/administration/freight-masters/event-types/${encodeURIComponent(EVENT_TYPES[nextIndex].code)}`);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/event-types')}
            className="text-primary-600 font-medium hover:underline"
          >
            Event Type
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

      {/* Edit + Action */}
      <div className="flex justify-center items-center gap-2 relative" ref={menuRef}>
        <button
          onClick={() => navigate(`/admin/administration/freight-masters/event-types/${encodeURIComponent(item.code)}/edit`)}
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

      <OperationWarningModal
        open={showWarning}
        onClose={() => setShowWarning(false)}
        model="Freight Event Type (freight.event.type)"
        field="Event Code (code)"
      />

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div>
          <p className="text-xs text-slate-500 mb-1">Event Name</p>
          <h2 className="text-2xl font-bold text-slate-900">{item.name}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-12">
          <div>
            <p className="text-xs text-slate-500 mb-1">Event Code</p>
            <span className="text-slate-700">{item.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Public Visible</p>
            <button
              disabled
              className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${item.publicVisible ? 'bg-primary-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center text-[10px] ${item.publicVisible ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                {item.publicVisible ? '✓' : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <button className="text-sm font-semibold pb-2 text-primary-600 border-b-2 border-primary-600">
              Summary
            </button>
          </div>
          <p className="text-sm text-slate-700 px-2 py-2">{item.summary || ''}</p>
        </div>
      </div>
    </div>
  );
};

export default EventTypeDetail;
