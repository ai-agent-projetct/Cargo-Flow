import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import {
  DAY_INITIALS, MONTH_NAMES, monthGrid, sameDay, addMonths,
  startOfWeek, addDays, colorFor, initials,
} from './constants';

// Mini month picker + the Attendees filter list on the right of the calendar.
const CalendarSidebar = ({
  cursor, scale, onPickDay, people, selected, onToggle, everybody, onToggleEverybody, onOpenSearch,
}) => {
  const [mini, setMini] = useState(new Date(cursor));
  const today = new Date();

  // Highlight the span the main view is currently showing.
  const inActiveRange = (day) => {
    if (scale === 'Day') return sameDay(day, cursor);
    if (scale === 'Week') {
      const s = startOfWeek(cursor);
      return day >= s && day < addDays(s, 7);
    }
    if (scale === 'Month') return day.getMonth() === cursor.getMonth() && day.getFullYear() === cursor.getFullYear();
    return day.getFullYear() === cursor.getFullYear();
  };

  return (
    <aside className="w-72 flex-shrink-0 space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMini(addMonths(mini, -1))} className="p-1 text-gray-400 hover:text-gray-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-lg text-gray-500">{MONTH_NAMES[mini.getMonth()].slice(0, 3)} {mini.getFullYear()}</p>
          <button onClick={() => setMini(addMonths(mini, 1))} className="p-1 text-gray-400 hover:text-gray-700">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {DAY_INITIALS.map((d, i) => (
            <span key={i} className="text-xs font-bold text-gray-700">{d}</span>
          ))}
          {monthGrid(mini).flat().map((day) => {
            const inMonth = day.getMonth() === mini.getMonth();
            const isToday = sameDay(day, today);
            const active = inActiveRange(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onPickDay(day)}
                className={`text-sm py-1 rounded ${
                  isToday ? 'bg-red-500 text-white font-semibold'
                    : active ? 'bg-teal-100 text-teal-900'
                      : inMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <label className="flex items-center gap-2 pb-2 font-bold text-gray-800 text-sm">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={people.length > 0 && selected.length === people.length}
            onChange={(e) => onToggle(e.target.checked ? '__all__' : '__none__')}
          />
          Attendees
        </label>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {people.map((p) => (
            <label key={p.name} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
              <input
                type="checkbox"
                className="rounded border-gray-300 accent-green-600"
                checked={selected.includes(p.name)}
                onChange={() => onToggle(p.name)}
              />
              <span className={`w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${colorFor(p.name)}`}>
                {initials(p.name)}
              </span>
              <span className="truncate text-gray-700" title={p.name}>{p.name}</span>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer pt-2 mt-1 border-t border-gray-100">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={everybody}
            onChange={onToggleEverybody}
          />
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-gray-700">Everybody&apos;s calendars</span>
        </label>

        <button
          onClick={onOpenSearch}
          className="w-full mt-3 text-left px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50"
        >
          + Add Attendees
        </button>
      </div>
    </aside>
  );
};

export default CalendarSidebar;
