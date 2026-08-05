import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { containerNumbersAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockContainers = [
  { id: 1, containerNumber: 'MSCU1234567', status: 'unused', linkedShipmentNumber: null },
  { id: 2, containerNumber: 'TCLU9876543', status: 'used', linkedShipmentNumber: 'HS-2026-00010' },
];

const STATUSES = ['', 'unused', 'used'];

const ContainerNumbers = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await containerNumbersAPI.getAll({ search, status });
      setRecords(res.data?.data || []);
    } catch {
      setRecords(mockContainers);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newNumber.trim()) return;
    setAdding(true);
    try {
      const res = await containerNumbersAPI.create({ containerNumber: newNumber.trim() });
      setRecords((prev) => [res.data?.data, ...prev]);
      setNewNumber('');
      toast.success('Container number added');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add container number');
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    const numbers = bulkText.split(/[\s,]+/).map((n) => n.trim()).filter(Boolean);
    if (numbers.length === 0) return;
    setAdding(true);
    try {
      const res = await containerNumbersAPI.bulkCreate(numbers);
      toast.success(`Added ${res.data?.data?.created || 0} container number(s), skipped ${res.data?.data?.skipped || 0} duplicate(s)`);
      setBulkText('');
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add container numbers');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await containerNumbersAPI.delete(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Container number deleted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete container number');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Container Number</h1>
      </div>

      {/* Add */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Add Container Number</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Container Number</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="e.g. MSCU1234567"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bulk Add (comma or newline separated)</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="MSCU1234567, TCLU9876543, ..."
          />
          <button
            onClick={handleBulkAdd}
            disabled={adding}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Bulk Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search container number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Status</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Container Number', 'Status', 'Linked Shipment', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">No container numbers found</td></tr>
                ) : records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{rec.containerNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rec.status === 'used' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.linkedShipmentNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(rec.id)}
                        disabled={rec.status === 'used'}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContainerNumbers;
