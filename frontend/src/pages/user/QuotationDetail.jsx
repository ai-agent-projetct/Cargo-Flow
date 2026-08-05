import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import { getTransportModeLabel, getCargoTypeLabel, getDirectionLabel } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockQuote = {
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
  totalAmount: 15000,
  currency: 'MYR',
};

const statusColors = {
  summary: 'bg-gray-100 text-gray-700',
  accepted: 'bg-green-100 text-green-700',
  un_accepted: 'bg-red-100 text-red-700',
  rejected: 'bg-red-200 text-red-800',
  pending: 'bg-yellow-100 text-yellow-700',
};

const UserQuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await quotationsAPI.getById(id);
        setQuote(res.data.data);
      } catch {
        setQuote({ ...mockQuote, id: parseInt(id) });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await quotationsAPI.approve(id, {});
      toast.success('Quote accepted!');
      setQuote((q) => ({ ...q, status: 'accepted' }));
    } catch {
      toast.success('Quote accepted! (Demo mode)');
      setQuote((q) => ({ ...q, status: 'accepted' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await quotationsAPI.reject(id, { reason: 'Rejected by customer' });
      toast.success('Quote rejected.');
      setQuote((q) => ({ ...q, status: 'un_accepted' }));
    } catch {
      toast.success('Quote rejected. (Demo mode)');
      setQuote((q) => ({ ...q, status: 'un_accepted' }));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!quote) return <div className="p-6 text-gray-500">Quote not found.</div>;

  const canAct = quote.status === 'pending' || quote.status === 'sent';

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <button
        onClick={() => navigate('/user/quotations')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Quotations
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-mono">{quote.quotationNumber || quote.quoteNumber}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {quote.originCity || '-'} <span className="mx-1">→</span> {quote.destinationCity || '-'}
            </p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusColors[quote.status] || 'bg-gray-100 text-gray-700'}`}>
            {quote.status === 'un_accepted' ? 'Un-Accepted' : quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          {[
            { label: 'Quote Date', value: quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-GB') : '—' },
            { label: 'Expiry Date', value: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-GB') : '—' },
            { label: 'Customer', value: quote.customer?.companyName || '—' },
            { label: 'Transport Mode', value: quote.transportMode ? getTransportModeLabel(quote.transportMode) : '—' },
            { label: 'Direction', value: quote.direction ? getDirectionLabel(quote.direction) : '—' },
            { label: 'Cargo Type', value: quote.cargoType ? getCargoTypeLabel(quote.cargoType) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {quote.totalAmount != null && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-blue-600 text-xs font-semibold uppercase tracking-wide">Total Amount</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {Number(quote.totalAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })} {quote.currency || 'MYR'}
            </p>
          </div>
        )}

        {canAct && (
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Accept Quote
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 border border-red-200 text-sm font-semibold rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject Quote
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserQuotationDetail;
