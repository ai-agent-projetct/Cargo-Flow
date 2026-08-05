import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, Package,
  DollarSign, Clock, User, Edit, Ship,
} from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency, getModeIcon, capitalize } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockQuotation = {
  id: 1,
  quotationNumber: 'QT-SEA-EXP-FCL/2024/00048',
  quoteNumber: 'QUO-2024-0048',
  status: 'pending',
  transportMode: 'SEA',
  cargoType: 'FCL',
  incoterm: 'FOB',
  currency: 'USD',
  totalAmount: 4850,
  customer: { companyName: 'Acme Corp', email: 'shipping@acmecorp.com', contactName: '+1 555 0100' },
  originPort: { name: 'Shanghai', code: 'CNSHA' },
  destinationPort: { name: 'Rotterdam', code: 'NLRTM' },
  originCity: 'Shanghai, China',
  destinationCity: 'Rotterdam, Netherlands',
  estimatedTransitDays: 36,
  validUntil: '2024-12-25T00:00:00Z',
  createdAt: '2024-12-10T10:00:00Z',
  creator: { name: 'admin@cargoflo.com', email: 'admin@cargoflo.com' },
  notes: 'Customer requires temperature-controlled containers. Fragile goods.',
  containerCount: 2,
  containerType: "40'HC",
};

const AdminQuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await quotationsAPI.getById(id);
        setQuotation(response.data.data);
      } catch {
        setQuotation({ ...mockQuotation, id });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await quotationsAPI.approve(id);
      toast.success('Quotation approved successfully');
      setQuotation((q) => ({ ...q, status: 'approved' }));
    } catch {
      toast.error('Failed to approve quotation');
    } finally {
      setActionLoading(false);
      setActionModal(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await quotationsAPI.reject(id, { reason: rejectionReason });
      toast.success('Quotation rejected');
      setQuotation((q) => ({ ...q, status: 'rejected' }));
    } catch {
      toast.error('Failed to reject quotation');
    } finally {
      setActionLoading(false);
      setActionModal(null);
    }
  };

  const handleConvert = async () => {
    setActionLoading(true);
    try {
      const response = await quotationsAPI.convertToShipment(id);
      toast.success('Converted to shipment successfully');
      navigate(`/admin/shipments/${response.data?.shipment_id || response.data?.id}`);
    } catch {
      toast.error('Failed to convert');
    } finally {
      setActionLoading(false);
      setActionModal(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!quotation) return <div className="text-center py-16 text-slate-400">Quotation not found</div>;

  const q = quotation;
  const lineItems = [
    { description: 'Freight Charges', amount: q.freightCharges },
    { description: 'Origin Charges', amount: q.originCharges },
    { description: 'Destination Charges', amount: q.destinationCharges },
    { description: 'Customs Charges', amount: q.customsCharges },
    { description: 'Insurance Charges', amount: q.insuranceCharges },
    { description: 'Other Charges', amount: q.otherCharges },
  ].filter((item) => Number(item.amount) > 0);
  const subtotal = q.totalAmount;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/quotations')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{q.quotationNumber || q.quoteNumber}</h2>
              <StatusBadge status={q.status} />
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Created {formatDate(q.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {q.status === 'pending' && (
            <>
              <button
                onClick={() => setActionModal('reject')}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors font-medium"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => setActionModal('approve')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
            </>
          )}
          {q.status === 'approved' && (
            <button
              onClick={() => setActionModal('convert')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Package className="w-4 h-4" /> Convert to Shipment
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/quotations/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            <Edit className="w-4 h-4" /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Main details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Route */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Ship className="w-4 h-4 text-primary-600" /> Route & Cargo
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Origin</p>
                <p className="text-sm font-semibold text-slate-900">{q.originCity || '-'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{q.originPort ? `${q.originPort.name} (${q.originPort.code})` : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Destination</p>
                <p className="text-sm font-semibold text-slate-900">{q.destinationCity || '-'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{q.destinationPort ? `${q.destinationPort.name} (${q.destinationPort.code})` : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Transport Mode</p>
                <p className="text-sm font-medium text-slate-700">{getModeIcon(q.transportMode?.toLowerCase())} {q.transportMode ? capitalize(q.transportMode.toLowerCase()) : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Cargo Type</p>
                <p className="text-sm font-medium text-slate-700">{q.cargoType || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Incoterm</p>
                <p className="text-sm font-medium text-slate-700">{q.incoterm || q.incoterms || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Transit Time</p>
                <p className="text-sm font-medium text-slate-700">{q.estimatedTransitDays != null ? `${q.estimatedTransitDays} days` : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Carrier</p>
                <p className="text-sm font-medium text-slate-700">{q.carrier?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Valid Until</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(q.validUntil)}</p>
              </div>
            </div>
            {q.containerCount > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">Containers</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                    {q.containerCount}x {q.containerType || 'Container'}
                  </span>
                </div>
              </div>
            )}
            {q.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-600">{q.notes}</p>
              </div>
            )}
          </div>

          {/* Surcharges */}
          {Array.isArray(q.surcharges) && q.surcharges.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary-600" /> Surcharges
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Description</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.surcharges.map((s, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="py-3 text-slate-700">{s.description || s.name || '-'}</td>
                      <td className="py-3 text-right font-medium text-slate-900">{formatCurrency(s.amount, s.currency || q.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rate Comparison */}
          {(q.totalBuyRate != null || q.totalSellRate != null || q.profit != null) && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary-600" /> Rate Comparison
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Buy Rate</p>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(q.totalBuyRate, q.currency)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Sell Rate</p>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(q.totalSellRate ?? q.totalAmount, q.currency)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Profit</p>
                  <p className={`text-sm font-bold ${(q.profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(q.profit, q.currency)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary-600" /> Pricing Breakdown
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr><td colSpan={2} className="py-3 text-center text-slate-400">No charges itemized</td></tr>
                ) : lineItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-3 text-slate-700">{item.description}</td>
                    <td className="py-3 text-right font-medium text-slate-900">{formatCurrency(item.amount, q.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 text-right font-bold text-slate-900 text-base">Total</td>
                  <td className="pt-4 text-right font-bold text-primary-700 text-base">
                    {formatCurrency(subtotal, q.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right: Customer & meta */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-600" /> Customer
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Company</p>
                <p className="text-sm font-semibold text-slate-900">{q.customer?.companyName || '-'}</p>
              </div>
              {q.customer?.contactName && (
                <div>
                  <p className="text-xs text-slate-500">Contact</p>
                  <p className="text-sm text-slate-700">{q.customer.contactName}</p>
                </div>
              )}
              {q.customer?.email && (
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm text-slate-700">{q.customer.email}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" /> Quote Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Created</span>
                <span className="text-xs font-medium text-slate-700">{formatDate(q.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Valid Until</span>
                <span className="text-xs font-medium text-slate-700">{formatDate(q.validUntil)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Created By</span>
                <span className="text-xs font-medium text-slate-700">{q.creator?.name || q.creator?.email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Currency</span>
                <span className="text-xs font-medium text-slate-700">{q.currency}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-sm font-semibold text-slate-700">Total Amount</span>
                <span className="text-sm font-bold text-primary-700">{formatCurrency(q.totalAmount, q.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal isOpen={actionModal === 'approve'} onClose={() => setActionModal(null)} title="Approve Quotation" size="sm"
        footer={
          <>
            <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleApprove} disabled={actionLoading} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
              {actionLoading ? 'Approving...' : 'Approve Quotation'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Approve <strong>{q.quotationNumber || q.quoteNumber}</strong> for {q.customer?.companyName || '-'}? The customer will be notified.</p>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={actionModal === 'reject'} onClose={() => setActionModal(null)} title="Reject Quotation" size="sm"
        footer={
          <>
            <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleReject} disabled={actionLoading} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">
              {actionLoading ? 'Rejecting...' : 'Reject Quotation'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Please provide a reason for rejecting <strong>{q.quotationNumber || q.quoteNumber}</strong>.</p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter rejection reason..."
          />
        </div>
      </Modal>

      {/* Convert Modal */}
      <Modal isOpen={actionModal === 'convert'} onClose={() => setActionModal(null)} title="Convert to Shipment" size="sm"
        footer={
          <>
            <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleConvert} disabled={actionLoading} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
              {actionLoading ? 'Converting...' : 'Convert to Shipment'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Convert <strong>{q.quotationNumber || q.quoteNumber}</strong> into an active shipment? A new shipment record will be created.</p>
      </Modal>
    </div>
  );
};

export default AdminQuotationDetail;
