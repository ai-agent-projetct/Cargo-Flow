import React, { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { inputClass } from './constants';
import toast from 'react-hot-toast';
import { ffJobsAPI } from '../../../services/api';

const MilestonesTab = ({ job, jobId, onTrackingAdded }) => {
  const [newEvent, setNewEvent] = useState({ event: '', location: '', datetime: '' });
  const [adding, setAdding] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const handleAddTracking = async () => {
    if (!newEvent.event || !newEvent.location) {
      toast.error('Event description and location are required');
      return;
    }
    if (!jobId) {
      toast.error('Save the shipment first before adding milestones');
      return;
    }
    setAdding(true);
    try {
      await ffJobsAPI.addTracking(jobId, newEvent);
      toast.success('Milestone added!');
      setNewEvent({ event: '', location: '', datetime: '' });
      setShowAddEvent(false);
      if (onTrackingAdded) onTrackingAdded();
    } catch {
      toast.error('Failed to add milestone');
    } finally {
      setAdding(false);
    }
  };

  const events = job?.events || job?.tracking || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Milestones / Tracking Events</h3>
        <button
          type="button"
          onClick={() => setShowAddEvent(!showAddEvent)}
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
            <button
              type="button"
              onClick={handleAddTracking}
              disabled={adding}
              className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No tracking events yet</p>
        ) : (
          events.map((t, i, arr) => (
            <div key={t.id || i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
                {i < arr.length - 1 && <div className="w-0.5 h-6 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-2">
                <p className="font-semibold text-gray-800 text-sm">{t.description || t.eventType || t.event}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />{t.location || '-'} — {t.eventDate ? new Date(t.eventDate).toLocaleString('en-GB') : (t.datetime || '-')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MilestonesTab;
