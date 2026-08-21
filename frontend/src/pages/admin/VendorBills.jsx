import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Search } from 'lucide-react';
import { vendorBillsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockBills = [
  { id: 1, billNumber: 'BILL/2025/00001', vendor: { companyName: 'Evergreen Marine' }, billDate: '2025-09-05', dueDate: '2025-10-05', totalAmount: 8500, currency: 'MYR', ffJob: { jobNumber: 'SEA-E-FCL-H-N-2025-00911' }, status: 'posted' },
  { id: 2, billNumber: 'BILL/2025/00002', vendor: { companyName: 'KLIA Cargo Terminal' }, billDate: '2025-08-10', dueDate: '2025-09-10', totalAmount: 3200, currency: 'MYR', ffJob: { jobNumber: 'AIR-E-LSE-H-N-2025-00450' }, status: 'paid' },
];

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  posted: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const AdminVendorBills = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorBillsAPI.getAll({ search });
      setBills(res.data?.data || []);
    } catch {
      setBills(mockBills);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayBills = bills.filter((b) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return String(b.billNumber || '').toLowerCase().includes(term) ||
      String(b.vendor?.companyName || '').toLowerCase().includes(term);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Vendor Bills</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          onClick={() => navigate('/admin/accounting/vendors/bills/create')}
        >
          <Plus className="w-4 h-4" /> New Bill
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="relative inline-block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search bill / vendor..."
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
                {['Bill Number', 'Vendor', 'Bill Date', 'Due Date', 'House Number', 'Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayBills.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No bills found</td></tr>
              ) : displayBills.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-blue-700 text-xs">{b.billNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{b.vendor?.companyName || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.billDate ? new Date(b.billDate).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{b.ffJob?.jobNumber || b.serviceJob?.jobNumber || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {Number(b.totalAmount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })} {b.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
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

export default AdminVendorBills;
