import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { exportCsv } from '../../../utils/exportCsv';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, ArrowRight, Search, Filter, Star, CalendarDays, List, X, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calendarAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import CalendarTimeGrid from './CalendarTimeGrid';
import { CalendarMonth, CalendarYear } from './CalendarMonthYear';
import CalendarSidebar from './CalendarSidebar';
import AttendeeSearchModal from './AttendeeSearchModal';
import {
  SCALES, FILTERS, titleFor, rangeFor, addDays, addMonths, startOfDay,
  fmtDateTime, fmtDuration,
} from './constants';

const LIST_COLUMNS = ['Subject', 'Start Date', 'End Date', 'Attendees', 'Location', 'Duration'];

const CalendarPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = user?.name || user?.email || 'Administrator';
  const [scale, setScale] = useState('Day');
  const [mode, setMode] = useState('calendar'); // calendar | list
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState([]);
  const [everybody, setEverybody] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [quick, setQuick] = useState(null);
  const [attendeeSearch, setAttendeeSearch] = useState(false);
  const menuRef = useRef(null);

  const [from, to] = useMemo(() => rangeFor(scale, cursor), [scale, cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = mode === 'list'
        ? { all: 'true', search: search || undefined }
        : { from: from.toISOString(), to: to.toISOString() };
      filters.forEach((f) => { const [k, v] = f.split('='); params[k] = v; });
      const res = await calendarAPI.getAll(params);
      setEvents(res.data?.data || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [mode, from, to, search, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    calendarAPI.getPeople()
      .then((r) => {
        const list = r.data?.data || [];
        // The signed-in user always has a row, even with no meetings yet, so
        // anything they create shows up straight away.
        const withMe = list.some((p) => p.name === me)
          ? list
          : [{ name: me, count: 0 }, ...list];
        setPeople(withMe);
        // The demo starts with just the signed-in user ticked.
        setSelected([me]);
      })
      .catch(() => { setPeople([{ name: me, count: 0 }]); setSelected([me]); });
  }, [me]);

  useEffect(() => {
    const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  // Attendee ticks filter the grid client-side, the way Odoo's sidebar does.
  // The list view has no sidebar, so it shows everything.
  const visible = useMemo(() => {
    if (mode === 'list' || everybody || selected.length === 0) return events;
    return events.filter((e) =>
      selected.includes(e.organizer)
      || (e.attendees || []).some((a) => selected.includes(a.name)));
  }, [mode, events, selected, everybody]);

  const step = (dir) => {
    if (scale === 'Day') setCursor((c) => addDays(c, dir));
    else if (scale === 'Week') setCursor((c) => addDays(c, dir * 7));
    else if (scale === 'Month') setCursor((c) => addMonths(c, dir));
    else setCursor((c) => new Date(c.getFullYear() + dir, c.getMonth(), 1));
  };

  const toggleAttendee = (name) => {
    if (name === '__all__') return setSelected(people.map((p) => p.name));
    if (name === '__none__') return setSelected([]);
    return setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  };

  const openEvent = (e) => navigate(`/admin/calendar/events/${e.id}`);

  const createQuick = async (goToForm) => {
    if (!quick?.name?.trim() && !goToForm) {
      toast.error('Meeting Subject is required');
      return;
    }
    try {
      const res = await calendarAPI.create({
        name: quick.name?.trim() || 'New Meeting',
        start: quick.start,
        stop: quick.stop,
      });
      const created = res.data.data;
      setQuick(null);
      // Make sure the organizer is ticked, or the new meeting would be filtered
      // straight back out of the grid.
      setPeople((prev) => (prev.some((p) => p.name === created.organizer)
        ? prev : [...prev, { name: created.organizer, count: 0 }]));
      setSelected((prev) => (prev.includes(created.organizer) ? prev : [...prev, created.organizer]));
      if (goToForm) navigate(`/admin/calendar/events/${created.id}`);
      else { toast.success('Meeting created'); load(); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create meeting');
    }
  };

  // Export the rows currently on screen, so the file matches the filters.
  const handleExport = () => {
    if (exportCsv(events, null, 'calendar-events')) toast.success(`Exported ${events.length} rows`);
    else toast.error('Nothing to export');
  };

  // Remember the calendar view the user prefers to come back to.
  const [favourite, setFavourite] = useState(() => !!localStorage.getItem('cargoflo.fav.calendar'));
  const toggleFavourite = () => {
    if (favourite) { localStorage.removeItem('cargoflo.fav.calendar'); setFavourite(false); toast('Removed from favourites'); return; }
    localStorage.setItem('cargoflo.fav.calendar', JSON.stringify({ scale, mode }));
    setFavourite(true);
    toast.success('Saved this calendar view');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Calendar</h1>
      <p className="text-lg text-gray-800 font-semibold mb-3">
        Meetings{mode === 'calendar' ? ` (${titleFor(scale, cursor)})` : ''}
      </p>

      {/* Toolbar */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4 relative" ref={menuRef}>
        <div className="flex items-center gap-2 flex-wrap">
          {mode === 'calendar' ? (
            <>
              <button
                onClick={() => setQuick({ start: startOfDay(cursor), stop: new Date(startOfDay(cursor).getTime() + 3600000), name: '' })}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded"
              >
                Add
              </button>
              <button onClick={() => step(-1)} className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCursor(new Date())}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded"
              >
                Today
              </button>
              <button onClick={() => step(1)} className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded">
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex ml-2 border border-gray-300 rounded overflow-hidden">
                {SCALES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`px-4 py-2 text-sm ${scale === s ? 'bg-gray-200 text-gray-900 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setQuick({ start: new Date(), stop: new Date(Date.now() + 3600000), name: '' })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded"
              >
                <Plus className="w-4 h-4" /> Create
              </button>
              <button onClick={handleExport} className="p-2 border border-gray-300 rounded text-gray-500 hover:bg-gray-50" title="Export">
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-72 pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              <Filter className="w-3.5 h-3.5" /> Filters
              {filters.length > 0 && <span className="text-xs text-blue-700">({filters.length})</span>}
            </button>
            {openMenu === 'filter' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {FILTERS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={filters.includes(f.key)}
                      onChange={() => setFilters((p) =>
                        p.includes(f.key) ? p.filter((x) => x !== f.key) : [...p, f.key])}
                    />
                    {f.label}
                  </label>
                ))}
                {filters.length > 0 && (
                  <button
                    onClick={() => setFilters([])}
                    className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-gray-50 border-t border-gray-100"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={toggleFavourite}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm hover:bg-gray-50 ${
              favourite ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-300 text-gray-700'
            }`}>
            <Star className={`w-3.5 h-3.5 ${favourite ? 'fill-amber-400' : ''}`} /> Favorites
          </button>

          <div className="flex border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setMode('calendar')}
              title="Calendar view"
              className={`px-2.5 py-1.5 ${mode === 'calendar' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('list')}
              title="List view"
              className={`px-2.5 py-1.5 ${mode === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {mode === 'list' && (
            <span className="text-xs text-gray-600">1-{visible.length} / {visible.length}</span>
          )}
        </div>
      </div>

      {loading ? <PageLoader /> : mode === 'list' ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded border-gray-300" /></th>
                  {LIST_COLUMNS.map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.length === 0 ? (
                  <tr><td colSpan={LIST_COLUMNS.length + 1} className="text-center py-10 text-gray-400">No meetings found</td></tr>
                ) : visible.map((e) => (
                  <tr key={e.id} onClick={() => openEvent(e)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(e.start)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(e.stop)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(e.attendees || []).map((a) => (
                          <span key={a.name} className="px-2 py-0.5 rounded-full border border-gray-300 text-[11px] text-gray-700 max-w-[14rem] truncate">
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{e.location || ''}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs text-right">{fmtDuration(e.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            {(scale === 'Day' || scale === 'Week') && (
              <CalendarTimeGrid
                scale={scale}
                cursor={cursor}
                events={visible}
                onOpen={openEvent}
                onQuickCreate={(slot) => setQuick({ ...slot, name: '' })}
              />
            )}
            {scale === 'Month' && (
              <CalendarMonth
                cursor={cursor}
                events={visible}
                onOpen={openEvent}
                onQuickCreate={(slot) => setQuick({ ...slot, name: '' })}
              />
            )}
            {scale === 'Year' && (
              <CalendarYear
                cursor={cursor}
                events={visible}
                onPickDay={(d) => { setCursor(d); setScale('Day'); }}
              />
            )}
          </div>

          <CalendarSidebar
            cursor={cursor}
            scale={scale}
            onPickDay={(d) => setCursor(d)}
            people={people}
            selected={selected}
            onToggle={toggleAttendee}
            everybody={everybody}
            onToggleEverybody={() => setEverybody((v) => !v)}
            onOpenSearch={() => setAttendeeSearch(true)}
          />
        </div>
      )}

      {/* New Event quick-create */}
      {quick && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-32">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-xl font-bold text-blue-700">New Event</h3>
              <button onClick={() => setQuick(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm text-gray-700 mb-2">Meeting Subject:</label>
              <input
                autoFocus
                value={quick.name}
                onChange={(e) => setQuick({ ...quick, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') createQuick(false); }}
                className="w-full px-2 py-1.5 border border-blue-400 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-200">
              <button
                onClick={() => createQuick(false)}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded"
              >
                Create
              </button>
              <button
                onClick={() => createQuick(true)}
                className="px-5 py-2 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={() => setQuick(null)}
                className="px-5 py-2 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {attendeeSearch && (
        <AttendeeSearchModal
          onClose={() => setAttendeeSearch(false)}
          onPick={(p) => {
            setPeople((prev) => (prev.some((x) => x.name === p.name) ? prev : [...prev, { name: p.name, count: 0 }]));
            setSelected((prev) => (prev.includes(p.name) ? prev : [...prev, p.name]));
            setAttendeeSearch(false);
            toast.success(`${p.name} added to the calendar`);
          }}
        />
      )}
    </div>
  );
};

export default CalendarPage;
