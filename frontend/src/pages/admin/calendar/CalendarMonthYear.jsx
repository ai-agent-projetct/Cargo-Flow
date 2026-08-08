import React from 'react';
import {
  DAY_NAMES, DAY_INITIALS, MONTH_NAMES, monthGrid, sameDay,
  weekNumber, fmtTime, colorFor,
} from './constants';

// Month grid — week numbers run down the left gutter, weeks start Sunday.
export const CalendarMonth = ({ cursor, events, onOpen, onQuickCreate }) => {
  const grid = monthGrid(cursor);
  const today = new Date();

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex border-b border-gray-200">
        <div className="w-12 flex-shrink-0 border-r border-gray-200" />
        {DAY_NAMES.map((d) => (
          <div key={d} className="flex-1 text-center py-3 text-sm font-bold text-gray-700">{d}</div>
        ))}
      </div>

      {grid.map((week, wi) => (
        <div key={wi} className="flex border-b border-gray-200 last:border-b-0 min-h-[6.5rem]">
          <div className="w-12 flex-shrink-0 border-r border-gray-200 pt-2 text-center text-xs text-gray-400">
            {weekNumber(week[0])}
          </div>
          {week.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, today);
            const dayEvents = events.filter((e) => sameDay(new Date(e.start), day));
            return (
              <div
                key={day.toISOString()}
                onDoubleClick={() => onQuickCreate({ start: day, stop: new Date(day.getTime() + 3600000) })}
                className={`flex-1 border-r border-gray-200 last:border-r-0 p-1 ${inMonth ? '' : 'bg-gray-50'}`}
              >
                <div className="text-right">
                  <span className={`inline-flex items-center justify-center text-sm ${
                    isToday ? 'w-6 h-6 rounded-full bg-red-500 text-white font-semibold'
                      : inMonth ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {/* event_limit="5" in the demo's calendar view */}
                  {dayEvents.slice(0, 5).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onOpen(e)}
                      className={`w-full text-left text-[10px] text-white px-1 py-0.5 rounded truncate ${colorFor(e.organizer)}`}
                      title={e.name}
                    >
                      {e.allday ? e.name : `${fmtTime(e.start)} ${e.name}`}
                    </button>
                  ))}
                  {dayEvents.length > 5 && (
                    <p className="text-[10px] text-gray-500 pl-1">+{dayEvents.length - 5} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Year view — 12 mini months, today circled, days with events dotted.
export const CalendarYear = ({ cursor, events, onPickDay }) => {
  const today = new Date();
  const year = cursor.getFullYear();
  const busy = new Set(events.map((e) => new Date(e.start).toDateString()));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {MONTH_NAMES.map((mn, mi) => {
          const grid = monthGrid(new Date(year, mi, 1));
          return (
            <div key={mn}>
              <p className="text-center text-lg text-gray-500 mb-2">{mn.slice(0, 3)} {year}</p>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {DAY_INITIALS.map((d, i) => (
                  <span key={i} className="text-xs font-bold text-gray-700">{d}</span>
                ))}
                {grid.flat().map((day) => {
                  const inMonth = day.getMonth() === mi;
                  const isToday = sameDay(day, today);
                  const hasEvent = inMonth && busy.has(day.toDateString());
                  if (!inMonth) return <span key={day.toISOString()} />;
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => onPickDay(day)}
                      className={`text-xs py-0.5 rounded-full hover:bg-gray-100 ${
                        isToday ? 'bg-red-500 text-white font-semibold hover:bg-red-500'
                          : hasEvent ? 'text-blue-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
