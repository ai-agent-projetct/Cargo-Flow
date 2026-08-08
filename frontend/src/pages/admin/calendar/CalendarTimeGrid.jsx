import React, { useRef, useState, useEffect } from 'react';
import {
  HOURS, DAY_NAMES, addDays, startOfDay, startOfWeek, sameDay,
  weekNumber, fmtTime, colorFor,
} from './constants';

const HOUR_PX = 50;

// Day and Week share one hour grid; Day is just the one-column case.
const CalendarTimeGrid = ({ scale, cursor, events, onOpen, onQuickCreate }) => {
  const days = scale === 'Day'
    ? [startOfDay(cursor)]
    : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));

  const [nowTop, setNowTop] = useState(null);
  const [drag, setDrag] = useState(null);
  const bodyRef = useRef(null);

  // Red current-time line, refreshed every minute.
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowTop((n.getHours() + n.getMinutes() / 60) * HOUR_PX);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  const allDay = events.filter((e) => e.allday);
  const timed = events.filter((e) => !e.allday);

  const forDay = (day) => timed.filter((e) => sameDay(new Date(e.start), day));

  // Drag on an empty column to block out a slot, like the demo's quick create.
  const slotFromY = (day, y) => {
    const hours = Math.max(0, Math.min(23.5, Math.floor((y / HOUR_PX) * 2) / 2));
    const d = new Date(day);
    d.setHours(Math.floor(hours), (hours % 1) * 60, 0, 0);
    return d;
  };

  const onMouseDown = (day, e) => {
    if (e.button !== 0 || e.target.closest('[data-event]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const start = slotFromY(day, e.clientY - rect.top);
    setDrag({ day, start, end: new Date(start.getTime() + 1800000), rect });
  };

  const onMouseMove = (e) => {
    if (!drag) return;
    const end = slotFromY(drag.day, e.clientY - drag.rect.top);
    if (end > drag.start) setDrag({ ...drag, end: new Date(end.getTime() + 1800000) });
  };

  const onMouseUp = () => {
    if (!drag) return;
    onQuickCreate({ start: drag.start, stop: drag.end });
    setDrag(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden select-none">
      {/* Day headers */}
      <div className="flex border-b border-gray-200 bg-white">
        <div className="w-20 flex-shrink-0 px-2 py-3 text-xs font-bold text-gray-700 border-r border-gray-200">
          Week {weekNumber(days[0])}
        </div>
        {days.map((d) => {
          const today = sameDay(d, new Date());
          return (
            <div
              key={d.toISOString()}
              className={`flex-1 text-center py-3 border-r border-gray-200 last:border-r-0 ${
                scale === 'Day' ? 'bg-blue-700 text-white font-semibold' : ''
              }`}
            >
              {scale === 'Day' ? (
                `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              ) : (
                <span className={`text-sm font-semibold ${today ? 'text-blue-700' : 'text-gray-700'}`}>
                  {DAY_NAMES[d.getDay()].slice(0, 3)} {d.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* All day row */}
      <div className="flex border-b border-gray-200 bg-gray-50 min-h-[2.75rem]">
        <div className="w-20 flex-shrink-0 px-2 py-2 text-xs text-gray-600 border-r border-gray-200">All day</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="flex-1 border-r border-gray-200 last:border-r-0 p-1 space-y-1">
            {allDay.filter((e) => sameDay(new Date(e.start), d)).map((e) => (
              <button
                key={e.id}
                data-event
                onClick={() => onOpen(e)}
                className={`w-full text-left text-[11px] text-white px-1.5 py-0.5 rounded truncate ${colorFor(e.organizer)}`}
              >
                {e.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Hour grid */}
      <div className="relative overflow-y-auto max-h-[calc(100vh-20rem)]" ref={bodyRef}>
        <div className="flex relative">
          <div className="w-20 flex-shrink-0 border-r border-gray-200">
            {HOURS.map((h) => (
              <div key={h} className="h-[50px] text-[11px] text-gray-500 text-right pr-2 -mt-1.5">{h}</div>
            ))}
          </div>

          {days.map((d) => {
            const isToday = sameDay(d, new Date());
            return (
              <div
                key={d.toISOString()}
                className="flex-1 relative border-r border-gray-200 last:border-r-0"
                onMouseDown={(e) => onMouseDown(d, e)}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={() => drag && setDrag(null)}
              >
                {HOURS.map((h) => <div key={h} className="h-[50px] border-b border-gray-100" />)}

                {/* Drag preview */}
                {drag && sameDay(drag.day, d) && (
                  <div
                    className="absolute left-1 right-1 bg-blue-500/40 border border-blue-600 rounded px-1 text-[11px] text-blue-900 pointer-events-none"
                    style={{
                      top: (drag.start.getHours() + drag.start.getMinutes() / 60) * HOUR_PX,
                      height: Math.max(12, ((drag.end - drag.start) / 3600000) * HOUR_PX),
                    }}
                  >
                    {fmtTime(drag.start)} -
                  </div>
                )}

                {forDay(d).map((e) => {
                  const s = new Date(e.start);
                  const top = (s.getHours() + s.getMinutes() / 60) * HOUR_PX;
                  const height = Math.max(18, (e.duration || 1) * HOUR_PX);
                  return (
                    <button
                      key={e.id}
                      data-event
                      onClick={() => onOpen(e)}
                      title={`${e.name} — ${fmtTime(e.start)}`}
                      className={`absolute left-1 right-1 text-left text-[11px] text-white px-1.5 py-0.5 rounded shadow-sm overflow-hidden ${colorFor(e.organizer)}`}
                      style={{ top, height }}
                    >
                      <span className="font-semibold">{fmtTime(e.start)}</span> {e.name}
                    </button>
                  );
                })}

                {isToday && nowTop !== null && (
                  <div className="absolute left-0 right-0 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-px bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-red-500 -mt-1 -ml-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarTimeGrid;
