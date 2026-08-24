import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EVENT_TYPES } from './eventTypeData';

// "Administration > Freight Masters > Event Type / New" (and "/Edit") form,
// mirroring CargoFlo ERP's Event Type create/edit screen: Event Name, Event
// Code, Public Visible toggle, Summary textarea, and Save/Discard buttons.
const EventTypeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const decodedId = id ? decodeURIComponent(id) : null;
  const existing = isEdit ? EVENT_TYPES.find((et) => et.code === decodedId) : null;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [publicVisible, setPublicVisible] = useState(true);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCode(existing.code);
      setPublicVisible(existing.publicVisible);
      setSummary(existing.summary || '');
    }
  }, [existing]);

  const goBack = () => {
    if (isEdit && existing) {
      navigate(`/admin/administration/freight-masters/event-types/${encodeURIComponent(existing.code)}`);
    } else {
      navigate('/admin/administration/freight-masters/event-types');
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="text-sm">
        <button
          onClick={() => navigate('/admin/administration/freight-masters/event-types')}
          className="text-primary-600 font-medium hover:underline"
        >
          Event Type
        </button>
        <span className="text-slate-400"> / </span>
        <span className="text-slate-700">{isEdit ? 'Edit' : 'New'}</span>
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
          <label className="block text-xs text-slate-500 mb-1">Event Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-lg font-semibold border-0 border-b border-slate-200 focus:outline-none focus:ring-0 focus:border-primary-500"
            placeholder="e.g. Booking Received"
          />
        </div>

        <div className="flex flex-wrap items-center gap-12">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Event Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. BR"
            />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Public Visible</p>
            <button
              onClick={() => setPublicVisible((prev) => !prev)}
              className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${publicVisible ? 'bg-primary-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center text-[10px] ${publicVisible ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                {publicVisible ? '✓' : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <button type="button" role="tab" aria-selected="true" aria-current="page"
              title="Summary is the only tab on this form"
              className="text-sm font-semibold pb-2 text-primary-600 border-b-2 border-primary-600 cursor-default">
              Summary
            </button>
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

export default EventTypeForm;
