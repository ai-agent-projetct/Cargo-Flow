import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Search } from 'lucide-react';
import { freightBookingsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockBookings = [
  { id: 1, bookingNumber: 'BKG/2025/00001', carrier: { name: 'Evergreen Marine' }, customer: { companyName: 'Acme Logistics Sdn Bhd' }, transportMode: 'SEA', cargoType: 'FCL', origin: 'Port Klang, MY', destination: 'Singapore, SG', etd: '2025-09-11', eta: '2025-09-13', containerCount: 2, containerType: '20GP', status: 'confirmed' },
  { id: 2, bookingNumber: 'BKG/2025/00002', carrier: { name: 'COSCO Shipping' }, customer: { companyName: 'Pacific Trade Co' }, transportMode: 'SEA', cargoType: 'FCL', origin: 'Penang, MY', destination: 'Shanghai, CN', etd: '2025-08-20', eta: '2025-08-28', containerCount: 1, containerType: '40HC', status: 'submitted' },
];

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const AdminFreightBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await freightBookingsAPI.getAll({ search });
      setBookings(res.data?.data || []);
    } catch {
      setBookings(mockBookings);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayBookings = bookings.filter((b) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return String(b.bookingNumber || '').toLowerCase().includes(term) ||
      String(b.carrier?.name || '').toLowerCase().includes(term) ||
      String(b.customer?.companyName || '').toLowerCase().includes(term);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Freight Bookings</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          onClick={() => navigate('/admin/freight-booking/create')}
        >
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search booking / carrier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
          />
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Booking Number', 'Customer', 'Carrier', 'Mode', 'Origin', 'Destination', 'ETD', 'ETA', 'Containers', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayBookings.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-10 text-gray-400">No bookings found</td></tr>
              ) : displayBookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-blue-700 text-xs">{b.bookingNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{b.customer?.companyName || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.carrier?.name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.transportMode || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.origin || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.destination || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.etd ? new Date(b.etd).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.eta ? new Date(b.eta).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.containerCount ? `${b.containerCount} x ${b.containerType || ''}`.trim() : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/admin/freight-booking/${b.id}`)} title="Open this freight booking"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminFreightBookings;
