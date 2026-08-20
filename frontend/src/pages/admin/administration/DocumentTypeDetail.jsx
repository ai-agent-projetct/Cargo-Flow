import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { DOCUMENT_TYPES } from './documentTypeData';
import ArchiveConfirmModal from './ArchiveConfirmModal';

// "Administration > Freight Masters > Document Type / Name" detail view,
// mirroring CargoFlo ERP: breadcrumb with record pagination (1/33, with
// prev/next chevrons), "Edit" button, an "Action" dropdown (Archive +
// Confirmation popup, and Duplicate), Document Type, Related Model link, and
// Document Mode.
const DocumentTypeDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const menuRef = useRef(null);

  const index = Math.min(Math.max(parseInt(id, 10) || 0, 0), DOCUMENT_TYPES.length - 1);
  const item = DOCUMENT_TYPES[index];
  const total = DOCUMENT_TYPES.length;

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
    navigate(`/admin/administration/freight-masters/document-types/${nextIndex}`);
  };

  const handleDuplicate = () => {
    setShowActionMenu(false);
    // Mirrors Odoo's "Duplicate" action: opens an edit form pre-filled with a
    // copy of this record. The copy isn't persisted to the list until "Save"
    // is clicked.
    navigate('/admin/administration/freight-masters/document-types/new', {
      state: { duplicateFrom: index },
    });
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/document-types')}
            className="text-primary-600 font-medium hover:underline"
          >
            Document Type
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
          onClick={() => navigate(`/admin/administration/freight-masters/document-types/${index}/edit`)}
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
                setShowArchiveConfirm(true);
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Archive
            </button>
            <button
              onClick={handleDuplicate}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Duplicate
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
          <p className="text-xs text-slate-500 mb-1">Document Type</p>
          <h2 className="text-2xl font-bold text-slate-900">{item.name}</h2>
        </div>

        <div className="flex flex-wrap items-start gap-12">
          <div>
            <p className="text-xs text-slate-500 mb-1">Related Model</p>
            <span className="text-primary-600">{item.relatedModel}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Document Mode</p>
            <span className="text-slate-700">{item.documentMode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTypeDetail;
