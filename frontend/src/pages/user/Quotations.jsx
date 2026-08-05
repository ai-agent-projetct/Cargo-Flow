import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, ArrowRight } from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import { formatDate, getTransportModeColor, getTransportModeLabel, getCargoTypeLabel, getDirectionLabel } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockQuotations = [
  {
    id: 1,
    quotationNumber: 'QT-SEA-EXP-FCL/2025/00016',
    originCity: 'Malaysia',
    destinationCity: 'Singapore',
    createdAt: '2025-09-17T00:00:00Z',
    validUntil: '2025-10-17T00:00:00Z',
    customer: { companyName: 'Singapore Trade Co' },
    transportMode: 'SEA',
    direction: 'EXPORT',
    cargoType: 'FCL',
    status: 'pending',
  },
  {
    id: 2,
    quotationNumber: 'QT-AIR-IMP-LSE/2025/00012',
    originCity: 'China',
    destinationCity: 'Malaysia',
    createdAt: '2025-09-10T00:00:00Z',
    validUntil: '2025-10-10T00:00:00Z',
    customer: { companyName: 'KL Imports Sdn Bhd' },
    transportMode: 'AIR',
    direction: 'IMPORT',
    cargoType: 'LSE',
    status: 'accepted',
  },
  {
    id: 3,
    quotationNumber: 'QT-SEA-EXP-LCL/2025/00009',
    originCity: 'Malaysia',
    destinationCity: 'United Kingdom',
    createdAt: '2025-08-20T00:00:00Z',
    validUntil: '2025-09-20T00:00:00Z',
    customer: { companyName: 'London Freight Ltd' },
    transportMode: 'SEA',
    direction: 'EXPORT',
    cargoType: 'LCL',
    status: 'un_accepted',
  },
  {
    id: 4,
    quotationNumber: 'QT-ROA-EXP-FTL/2025/00005',
    originCity: 'Malaysia',
    destinationCity: 'Thailand',
    createdAt: '2025-08-01T00:00:00Z',
    validUntil: '2025-08-31T00:00:00Z',
    customer: { companyName: 'Bangkok Distribution Co' },
    transportMode: 'ROAD',
    direction: 'EXPORT',
    cargoType: 'FTL',
    status: 'rejected',
  },
];

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'un_accepted', label: 'Un-Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

const TRANSPORT_MODES = ['', 'SEA', 'AIR', 'ROAD', 'RAIL'];
const CARGO_TYPES = ['', 'FCL', 'LCL', 'LSE', 'FTL', 'LTL', 'BULK', 'RORO'];
const SHIPMENT_TYPES = ['', 'EXPORT', 'IMPORT', 'LOCAL'];

const modeTagColors = {
  SEA: 'bg-blue-100 text-blue-700 border border-blue-200',
  AIR: 'bg-purple-100 text-purple-700 border border-purple-200',
  ROAD: 'bg-orange-100 text-orange-700 border border-orange-200',
  RAIL: 'bg-green-100 text-green-700 border border-green-200',
};

const statusColors = {
  summary: 'bg-gray-100 text-gray-700',
  accepted: 'bg-green-100 text-green-700',
  un_accepted: 'bg-red-100 text-red-700',
  rejected: 'bg-red-200 text-red-800',
  pending: 'bg-yellow-100 text-yellow-700',
};

const QuoteCard = ({ quote, onView }) => {
  const modeColor = modeTagColors[quote.transportMode] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{quote.quotationNumber || quote.quoteNumber}</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            {quote.originCity || '-'} <span className="mx-1 text-gray-400">→</span> {quote.destinationCity || '-'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[quote.status] || 'bg-gray-100 text-gray-700'}`}>
          {quote.status === 'un_accepted' ? 'Un-Accepted' : quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
        <div>
          <span className="text-gray-500">Quote Date: </span>
          <span className="text-gray-800 font-medium">
            {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-GB') : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Quote Expiry Date: </span>
          <span className="text-gray-800 font-medium">
            {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-GB') : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Customer: </span>
          <span className="text-gray-800 font-medium">{quote.customer?.companyName || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Direction: </span>
          <span className="text-gray-800 font-medium">
            {quote.direction ? getDirectionLabel(quote.direction) : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Cargo Type: </span>
          <span className="text-gray-800 font-medium">
            {quote.cargoType ? getCargoTypeLabel(quote.cargoType) : '—'}
          </span>
        </div>
      </div>

      {/* Tags + button row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex flex-wrap gap-2">
          {quote.transportMode && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${modeColor}`}>
              {getTransportModeLabel(quote.transportMode)}
            </span>
          )}
        </div>
        <button
          onClick={() => onView(quote.id)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View Quote
        </button>
      </div>
    </div>
  );
};

const UserQuotations = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('status') || 'summary';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [transportMode, setTransportMode] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [shipmentType, setShipmentType] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { my_quotes: true, status: activeTab !== 'summary' ? activeTab : undefined };
      if (searchText) params.search = searchText;
      if (transportMode) params.transportMode = transportMode;
      if (cargoType) params.cargoType = cargoType;
      if (shipmentType) params.direction = shipmentType;
      const res = await quotationsAPI.getAll(params);
      const result = res.data;
      setData(result.data || []);
    } catch {
      // fallback mock filtered by tab
      if (activeTab === 'summary') {
        setData(mockQuotations);
      } else {
        setData(mockQuotations.filter((q) => q.status === activeTab));
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchText, transportMode, cargoType, shipmentType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => fetchData();

  const displayData = data.filter((q) => {
    if (activeTab !== 'summary' && q.status !== activeTab) return false;
    if (searchText) {
      const term = searchText.toLowerCase();
      const num = String(q.quotationNumber || q.quoteNumber || '').toLowerCase();
      if (!num.includes(term)) return false;
    }
    if (transportMode && q.transportMode !== transportMode) return false;
    if (cargoType && q.cargoType !== cargoType) return false;
    if (shipmentType && q.direction !== shipmentType) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Title + button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Shipment Quote</h1>
        <button
          onClick={() => navigate('/user/quotations/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request a Quote
        </button>
      </div>

      {/* Filter row */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search Quotation No"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <select
          value={transportMode}
          onChange={(e) => setTransportMode(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Transport Mode</option>
          {TRANSPORT_MODES.filter(Boolean).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={cargoType}
          onChange={(e) => setCargoType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Cargo Type</option>
          {CARGO_TYPES.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={shipmentType}
          onChange={(e) => setShipmentType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Shipment Type</option>
          {SHIPMENT_TYPES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">No quotations found</p>
          <p className="text-sm mt-1">Try adjusting your filters or request a new quote</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayData.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onView={(id) => navigate(`/user/quotations/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserQuotations;
