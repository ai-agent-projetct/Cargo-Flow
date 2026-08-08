import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

// Freight Booking top bar. "Bookings" navigates; "Configuration" opens a
// dropdown whose single item is Settings, matching the demo.
const FreightBookingLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [configOpen, setConfigOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setConfigOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const onSettings = pathname.startsWith('/admin/freight-bookings/settings');
  const onBookings = !onSettings;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 px-4 py-2 overflow-visible flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 mr-4">Freight Booking</h1>

          <button
            onClick={() => navigate('/admin/freight-bookings')}
            className={`px-3 py-1.5 text-sm rounded ${
              onBookings ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Bookings
          </button>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setConfigOpen((o) => !o)}
              className={`px-3 py-1.5 text-sm rounded ${
                onSettings || configOpen ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Configuration
            </button>
            {configOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button
                  onClick={() => { setConfigOpen(false); navigate('/admin/freight-bookings/settings'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default FreightBookingLayout;
