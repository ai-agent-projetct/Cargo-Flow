import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, AlertTriangle, Clock } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import { formatDate, getDaysOverdue } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockInvoices = [
  {
    id: 1,
    invoiceNumber: 'INV/2025/00036',
    issueDate: '2025-01-10T00:00:00Z',
    shipment: { shipmentNumber: 'SEA-E-FCL-H-N-2025-00911' },
    dueDate: '2025-02-10T00:00:00Z',
    totalAmount: 12500.00,
    balanceAmount: 12500.00,
    currency: 'MYR',
    status: 'sent',
  },
  {
    id: 2,
    invoiceNumber: 'INV/2025/00028',
    issueDate: '2024-12-15T00:00:00Z',
    shipment: { shipmentNumber: 'SEA-I-LCL-H-N-2024-00870' },
    dueDate: '2024-12-30T00:00:00Z',
    totalAmount: 279674.85,
    balanceAmount: 279674.85,
    currency: 'MYR',
    status: 'overdue',
  },
  {
    id: 3,
    invoiceNumber: 'INV/2025/00018',
    issueDate: '2024-11-05T00:00:00Z',
    shipment: { shipmentNumber: 'AIR-E-LSE-H-N-2024-00800' },
    dueDate: '2024-12-05T00:00:00Z',
    totalAmount: 8900.00,
    balanceAmount: 0,
    currency: 'MYR',
    status: 'paid',
  },
  {
    id: 4,
    invoiceNumber: 'INV/2025/00012',
    issueDate: '2024-10-10T00:00:00Z',
    shipment: { shipmentNumber: 'ROA-E-FTL-H-N-2024-00750' },
    dueDate: '2024-11-10T00:00:00Z',
    totalAmount: 5400.00,
    balanceAmount: 0,
    currency: 'MYR',
    status: 'paid',
  },
];

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'Pending' },
];

const statusBadge = {
  paid: 'bg-green-100 text-green-700',
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-yellow-100 text-yellow-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
};

const UserInvoices = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState(0);
  const [totalOverDue, setTotalOverDue] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicesAPI.getAll({ my_invoices: true });
      const results = res.data?.data || [];
      setInvoices(results);
      setTotalDue(results.filter((i) => i.status !== 'paid').reduce((s, i) => s + (i.balanceAmount ?? i.totalAmount ?? 0), 0));
      setTotalOverDue(results.filter((i) => i.status === 'overdue').reduce((s, i) => s + (i.balanceAmount ?? i.totalAmount ?? 0), 0));
    } catch {
      setInvoices(mockInvoices);
      setTotalDue(mockInvoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.balanceAmount, 0));
      setTotalOverDue(mockInvoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.balanceAmount, 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayInvoices = invoices.filter((inv) => {
    if (activeTab === 'overdue') return inv.status === 'overdue';
    if (activeTab === 'pending') return inv.status === 'sent' || inv.status === 'partially_paid' || inv.status === 'draft';
    return true;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-5">
      {/* Title */}
      <h1 className="text-xl font-bold text-gray-900">Invoices</h1>

      {/* Summary boxes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Due Amount</p>
            <p className="text-lg font-bold text-gray-900">
              {totalDue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MYR
            </p>
          </div>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Over Due Amount</p>
            <p className="text-lg font-bold text-red-700">
              {totalOverDue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MYR
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice Number</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">House Number</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Due Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Days</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No invoices found
                </td>
              </tr>
            ) : (
              displayInvoices.map((inv) => {
                const days = getDaysOverdue(inv.dueDate);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{inv.invoiceNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                          {inv.status ? inv.status.replace(/_/g, ' ') : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{inv.shipment?.shipmentNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {days > 0 ? (
                        <span className="text-red-600 font-semibold">{days} days</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {(inv.totalAmount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inv.currency || 'MYR'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {(inv.balanceAmount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inv.currency || 'MYR'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Download PDF">
                        <FileDown className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserInvoices;
