import React, { useState } from 'react';
import { X, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { calendarAPI } from '../services/api';

// "Schedule activity" appears on every record's chatter. It is not a note — it
// creates a real calendar event linked back to the record through resModel /
// resId, which is what the Calendar screen reads. Scheduling from a shipment
// and opening the Calendar therefore show the same thing.

const TYPES = ['Meeting', 'Call', 'Email', 'To-Do', 'Follow-up'];

const ScheduleActivityModal = ({ open, onClose, resModel, resId, resName, onScheduled }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    activityType: 'To-Do',
    name: '',
    dateFrom: today,
    timeFrom: '09:00',
    duration: 1,
    allDay: false,
    description: '',
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Give the activity a summary'); return; }
    setSaving(true);
    try {
      const start = form.allDay
        ? `${form.dateFrom}T00:00:00`
        : `${form.dateFrom}T${form.timeFrom}:00`;
      const stop = new Date(new Date(start).getTime() + Number(form.duration || 1) * 3600000);

      const res = await calendarAPI.create({
        name: `${form.activityType}: ${form.name.trim()}`,
        start,
        stop: stop.toISOString(),
        allday: form.allDay,
        duration: Number(form.duration || 1),
        description: form.description,
        // The link back to the record this was scheduled from.
        resModel,
        resId: String(resId || ''),
        resName,
      });
      toast.success('Activity scheduled — it now shows on the Calendar');
      onScheduled?.(res.data?.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not schedule the activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose} role="presentation">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()} role="presentation">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 inline-flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Schedule Activity
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {resName && (
            <p className="text-xs text-gray-500">
              Linked to <span className="font-medium text-gray-700">{resName}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="act-type">Activity Type</label>
              <select id="act-type" value={form.activityType}
                onChange={(e) => set({ activityType: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="act-date">Due Date</label>
              <input id="act-date" type="date" value={form.dateFrom}
                onChange={(e) => set({ dateFrom: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="act-name">Summary</label>
            <input id="act-name" value={form.name} onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Chase the carrier for the booking confirmation"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="act-time">Time</label>
              <input id="act-time" type="time" value={form.timeFrom} disabled={form.allDay}
                onChange={(e) => set({ timeFrom: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="act-dur">Duration (h)</label>
              <input id="act-dur" type="number" min="0.5" step="0.5" value={form.duration} disabled={form.allDay}
                onChange={(e) => set({ duration: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-50" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-1.5">
              <input type="checkbox" className="rounded border-gray-300" checked={form.allDay}
                onChange={(e) => set({ allDay: e.target.checked })} />
              All day
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="act-desc">Notes</label>
            <textarea id="act-desc" rows={3} value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Discard</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50">
            {saving ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleActivityModal;
