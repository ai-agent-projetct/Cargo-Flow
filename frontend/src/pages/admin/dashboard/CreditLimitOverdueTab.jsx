import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import DashboardLayout from './DashboardLayout';

const CreditLimitOverdueTab = ({ activeTab, onTabChange }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getCreditLimitOverdue();
      setRows(res.data.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <PageLoader />;

  const filtered = rows.filter((r) =>
    !search || (r.customer || '').toLowerCase().includes(search.toLowerCase())
  );

  const pageIndicator = filtered.length > 0 ? `1-${Math.min(filtered.length, pageSize)} / ${filtered.length}` : '0-0/0';

  const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={onTabChange}
      subtitle="Credit Limit Overdue"
      onRefresh={fetchData}
      showSearch
      search={search}
      onSearchChange={setSearch}
    >
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-sm">Top 10 Credit Limit Customer</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{pageIndicator}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <button
              onClick={() => toast.success('Export started')}
              className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-400 rounded hover:bg-gray-200"
              title="Download"
              type="button"
            >
              <span className="text-[10px]">⬇</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-semibold text-xs">SL.No</th>
                <th className="text-left py-2 text-gray-500 font-semibold text-xs">Credit Limit Requester</th>
                <th className="text-left py-2 text-gray-500 font-semibold text-xs">Customer</th>
                <th className="text-right py-2 text-gray-500 font-semibold text-xs">Number Of Shipment</th>
                <th className="text-left py-2 text-gray-500 font-semibold text-xs">Approver Name</th>
                <th className="text-right py-2 text-gray-500 font-semibold text-xs">Credit Days</th>
                <th className="text-right py-2 text-gray-500 font-semibold text-xs">Credit Limit</th>
                <th className="text-right py-2 text-gray-500 font-semibold text-xs">Invoice Amount</th>
                <th className="text-left py-2 text-gray-500 font-semibold text-xs">Invoice Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length > 0 ? (
                filtered.slice(0, pageSize).map((r) => (
                  <tr key={r.customerId} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-700">{r.slNo}</td>
                    <td className="py-2 text-gray-700">{r.creditLimitRequester || '-'}</td>
                    <td className="py-2 text-gray-700">{r.customer}</td>
                    <td className="py-2 text-right text-gray-700">{r.numberOfShipment}</td>
                    <td className="py-2 text-gray-700">{r.approverName || '-'}</td>
                    <td className="py-2 text-right text-gray-700">{r.creditDays}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{fmt(r.creditLimit)}</td>
                    <td className="py-2 text-right font-semibold text-red-600">{fmt(r.invoiceAmount)}</td>
                    <td className="py-2">
                      <Link
                        to={`/admin/invoices?customerId=${r.customerId}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        View Invoices
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-gray-400 text-sm">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreditLimitOverdueTab;
