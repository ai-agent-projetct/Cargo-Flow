import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { creditNotesAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockCreditNotes = [
  {
    id: 1,
    creditNoteNumber: 'CN-2025-00008',
    issuedDate: '2025-09-10T00:00:00Z',
    invoice: { invoiceNumber: 'INV-2025-00911' },
    totalAmount: 2500.00,
    currency: 'MYR',
    status: 'issued',
  },
  {
    id: 2,
    creditNoteNumber: 'CN-2025-00003',
    issuedDate: '2025-07-20T00:00:00Z',
    invoice: { invoiceNumber: 'INV-2025-00800' },
    totalAmount: 1800.00,
    currency: 'MYR',
    status: 'draft',
  },
];

const UserCreditNotes = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creditNotesAPI.getAll({ my_notes: true });
      setNotes(res.data?.data || []);
    } catch {
      setNotes(mockCreditNotes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Credit Notes</h1>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Credit Note Number</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Credit Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">House Number</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notes.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">No credit notes found</td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900">{note.creditNoteNumber}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {note.issuedDate ? new Date(note.issuedDate).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{note.invoice?.invoiceNumber || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(note.totalAmount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {note.currency || 'MYR'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => navigate(`/user/credit-notes/${note.id}`)}
                      className="flex items-center gap-1.5 mx-auto px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserCreditNotes;
