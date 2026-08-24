import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Search } from 'lucide-react';
import { creditNotesAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockCreditNotes = [
  { id: 1, creditNoteNumber: 'CN-2025-00008', customer: { companyName: 'Acme Logistics Sdn Bhd' }, issuedDate: '2025-09-10', invoice: { invoiceNumber: 'INV-2025-00911' }, totalAmount: 2500, currency: 'MYR', status: 'issued' },
  { id: 2, creditNoteNumber: 'CN-2025-00003', customer: { companyName: 'KL Imports Sdn Bhd' }, issuedDate: '2025-07-20', invoice: { invoiceNumber: 'INV-2025-00800' }, totalAmount: 1800, currency: 'MYR', status: 'draft' },
  { id: 3, creditNoteNumber: 'CN-2025-00001', customer: { companyName: 'Penang Manufacturing Bhd' }, issuedDate: '2025-06-01', invoice: { invoiceNumber: 'INV-2025-00600' }, totalAmount: 950, currency: 'MYR', status: 'cancelled' },
];

const statusColors = {
  draft: 'bg-yellow-100 text-yellow-700',
  issued: 'bg-blue-100 text-blue-700',
  applied: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const AdminCreditNotes = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creditNotesAPI.getAll({ search });
      setNotes(res.data?.data || []);
    } catch {
      setNotes(mockCreditNotes);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayNotes = notes.filter((n) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return String(n.creditNoteNumber || '').toLowerCase().includes(term) ||
      String(n.customer?.companyName || '').toLowerCase().includes(term);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Credit Notes</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          onClick={() => navigate('/admin/accounting/customers/credit-notes/create')}
        >
          <Plus className="w-4 h-4" /> New Credit Note
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="relative inline-block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search credit note / vendor..."
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
                {['Credit Note Number', 'Customer', 'Issued Date', 'Invoice', 'Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayNotes.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No credit notes found</td></tr>
              ) : displayNotes.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-blue-700 text-xs">{n.creditNoteNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{n.customer?.companyName || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{n.issuedDate ? new Date(n.issuedDate).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{n.invoice?.invoiceNumber || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {Number(n.totalAmount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })} {n.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[n.status] || 'bg-gray-100 text-gray-600'}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/admin/accounting/customers/credit-notes/${n.id}`)} title="Open this credit note"
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

export default AdminCreditNotes;
