import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { DOCUMENT_TYPES, DOCUMENT_MODE_OPTIONS, RELATED_MODEL_OPTIONS } from './documentTypeData';

// "Administration > Freight Masters > Document Type / New" (and "/Edit")
// form, mirroring CargoFlo ERP's Document Type create/edit screen: Document
// Type input, Related Model + Related Template dropdowns, Document Mode
// dropdown, and Save/Discard buttons.
//
// When opened via the "Duplicate" action, the form is pre-filled with a copy
// of the source record and the breadcrumb/pagination show it as an extra
// ("N+1 / N+1") record - clicking "Save" is what actually adds the duplicate.
const DocumentTypeForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = id !== undefined;

  const editIndex = isEdit ? Math.min(Math.max(parseInt(id, 10) || 0, 0), DOCUMENT_TYPES.length - 1) : null;
  const existing = isEdit ? DOCUMENT_TYPES[editIndex] : null;

  const duplicateFrom = location.state && location.state.duplicateFrom !== undefined ? location.state.duplicateFrom : null;
  const duplicateSource = duplicateFrom !== null ? DOCUMENT_TYPES[duplicateFrom] : null;

  const source = existing || duplicateSource;

  const [name, setName] = useState('');
  const [relatedModel, setRelatedModel] = useState('');
  const [documentMode, setDocumentMode] = useState('');

  useEffect(() => {
    if (source) {
      setName(source.name);
      setRelatedModel(source.relatedModel);
      setDocumentMode(source.documentMode);
    }
  }, [source]);

  const goBack = () => {
    if (isEdit) {
      navigate(`/admin/administration/freight-masters/document-types/${editIndex}`);
    } else {
      navigate('/admin/administration/freight-masters/document-types');
    }
  };

  const total = DOCUMENT_TYPES.length;
  const isDuplicate = duplicateFrom !== null;

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
          <span className="text-slate-700">{isEdit ? existing.name : isDuplicate ? duplicateSource.name : 'New'}</span>
        </div>
        {isDuplicate && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{total + 1} / {total + 1}</span>
          </div>
        )}
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
        <div>
          <label className="block text-xs text-slate-500 mb-1">Document Type</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-3 text-lg text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Document Type"
          />
        </div>

        <div className="flex flex-wrap items-start gap-12">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Related Model</label>
              <select
                value={relatedModel}
                onChange={(e) => setRelatedModel(e.target.value)}
                className="w-64 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select...</option>
                {RELATED_MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Document Mode</label>
              <select
                value={documentMode}
                onChange={(e) => setDocumentMode(e.target.value)}
                className="w-64 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select...</option>
                {DOCUMENT_MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
              Related Template <ExternalLink className="w-3 h-3 text-slate-400" />
            </label>
            <select
              disabled
              className="w-64 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 focus:outline-none"
            >
              <option>Select...</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTypeForm;
