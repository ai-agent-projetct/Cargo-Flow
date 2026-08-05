import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, Clock } from 'lucide-react';
import { eventsAPI } from '../../services/api';

const mockUpcoming = [
  {
    id: 1,
    title: 'Port Klang Trade Fair 2025',
    date: '2025-10-15T09:00:00Z',
    end_date: '2025-10-17T18:00:00Z',
    location: 'Port Klang, Malaysia',
    description: 'Annual trade fair for freight and logistics industry.',
    type: 'Trade Fair',
  },
  {
    id: 2,
    title: 'Logistics Asia Summit',
    date: '2025-11-05T08:00:00Z',
    end_date: '2025-11-06T17:00:00Z',
    location: 'Kuala Lumpur Convention Centre',
    description: 'Summit covering supply chain trends and innovations.',
    type: 'Conference',
  },
];

const UserEvents = () => {
  const [view, setView] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = view === 'upcoming' ? await eventsAPI.getUpcoming() : await eventsAPI.getPast();
      setEvents(res.data?.data || []);
    } catch {
      setEvents(view === 'upcoming' ? mockUpcoming : []);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter((e) =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase())
  );

  const typeColors = {
    'Trade Fair': 'bg-blue-100 text-blue-700',
    Conference: 'bg-purple-100 text-purple-700',
    Webinar: 'bg-green-100 text-green-700',
    Workshop: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Events</h1>

      {/* Toggle + Search row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('upcoming')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'upcoming' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upcoming Events
          </button>
          <button
            onClick={() => setView('past')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'past' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Past Events
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search an event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">No events found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((event) => (
            <div key={event.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{event.title}</h3>
                  {event.type && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${typeColors[event.type] || 'bg-gray-100 text-gray-600'}`}>
                      {event.type}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {event.date ? new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    {event.end_date && ` — ${new Date(event.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{event.location}</span>
                  </div>
                )}
                {event.description && (
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserEvents;
