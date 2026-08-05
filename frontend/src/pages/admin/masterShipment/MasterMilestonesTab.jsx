import React, { useState } from 'react';
import { Plus, MapPin, Trash2 } from 'lucide-react';
import { inputClass } from '../houseShipment/constants';

// Milestones / Tracking tab for Master Shipment (Console) - operates on the
// `milestones` JSON array stored directly on the MasterShipment record
// (client-side managed, saved together with the rest of the form).
const MasterMilestonesTab = ({ form, setField }) => {
  const [newEvent, setNewEvent] = useState({ event: '', location: '', datetime: '' });
  const [showAddEvent, setShowAddEvent] = useState(false);

  const milestones = form.milestones || [];

  const handleAdd = () => {
    if (!newEvent.event || !newEvent.location) return;
    setField('milestones', [{ ...newEvent }, ...milestones]);
    setNewEvent({ event: '', location: '', datetime: '' });
    setShowAddEvent(false);
  };

  const handleRemove = (idx) => {
    setField('milestones', milestones.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Milestones / Tracking Events</h3>
        <button
          type="button"
          onClick={() => setShowAddEvent((s) => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Milestone
        </button>
      </div>

      {showAddEvent && (
        <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Event description"
            value={newEvent.event}
            onChange={(e) => setNewEvent((n) => ({ ...n, event: e.target.value }))}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Location"
            value={newEvent.location}
            onChange={(e) => setNewEvent((n) => ({ ...n, location: e.target.value }))}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={newEvent.datetime}
              onChange={(e) => setNewEvent((n) => ({ ...n, datetime: e.target.value }))}
              className={inputClass}
            />
            <button type="button" onClick={handleAdd} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {milestones.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No tracking events yet</p>
        ) : (
          milestones.map((t, i, arr) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
                {i < arr.length - 1 && <div className="w-0.5 h-6 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-2 flex-1">
                <p className="font-semibold text-gray-800 text-sm">{t.event}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />{t.location || '-'} — {t.datetime ? new Date(t.datetime).toLocaleString('en-GB') : '-'}
                </p>
              </div>
              <button type="button" onClick={() => handleRemove(i)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MasterMilestonesTab;
