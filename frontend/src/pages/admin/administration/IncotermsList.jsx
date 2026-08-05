import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Download, Save, X, FileText } from 'lucide-react';
import { incotermsAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import LoadingSpinner from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
      checked ? 'bg-primary-600' : 'bg-slate-300'
    }`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

const IncotermsList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState({ code: '', name: '', enablePickupDelivery: true });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await incotermsAPI.getAll();
      setData(response.data.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  });

  const handleToggle = async (item) => {
    try {
      await incotermsAPI.update(item.id, { enablePickupDelivery: !item.enablePickupDelivery });
      setData((prev) => prev.map((x) => x.id === item.id ? { ...x, enablePickupDelivery: !x.enablePickupDelivery } : x));
    } catch {
      toast.error('Failed to update');
    }
  };

  const startCreate = () => {
    setCreating(true);
    setNewRow({ code: '', name: '', enablePickupDelivery: true });
  };

  const discardCreate = () => {
    setCreating(false);
    setNewRow({ code: '', name: '', enablePickupDelivery: true });
  };

  const handleSaveNew = async () => {
    if (!newRow.code.trim() || !newRow.name.trim()) {
      toast.error('Code and Name are required');
      return;
    }
    setSaving(true);
    try {
      await incotermsAPI.create({
        code: newRow.code.trim().toUpperCase(),
        name: newRow.name.trim().toUpperCase(),
        enablePickupDelivery: newRow.enablePickupDelivery,
        sortOrder: data.length + 1,
      });
      toast.success('Incoterm created');
      setCreating(false);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const total = filtered.length + (creating ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Incoterms</h2>
        <div className="flex items-center gap-2">
          {creating ? (
            <>
              <button onClick={handleSaveNew} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={discardCreate} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                <X className="w-4 h-4" /> Discard
              </button>
              <button onClick={() => toast('Export coming soon')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
                <Download className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Create
              </button>
              <button onClick={() => toast('Export coming soon')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search incoterms..." className="max-w-md" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
          </div>
          <p className="text-xs text-slate-500">1-{total}/{total}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : filtered.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No incoterms found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Enable Pick-up &amp; Delivery Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.code}</td>
                  <td className="px-4 py-3 text-slate-600">{item.name}</td>
                  <td className="px-4 py-3">
                    <Toggle checked={!!item.enablePickupDelivery} onChange={() => handleToggle(item)} />
                  </td>
                </tr>
              ))}
              {creating && (
                <tr className="bg-primary-50/40">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={newRow.code}
                      onChange={(e) => setNewRow((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="Code"
                      className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newRow.name}
                        onChange={(e) => setNewRow((p) => ({ ...p, name: e.target.value.toUpperCase() }))}
                        placeholder="Name"
                        className="w-64 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">EN</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle checked={newRow.enablePickupDelivery} onChange={() => setNewRow((p) => ({ ...p, enablePickupDelivery: !p.enablePickupDelivery }))} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default IncotermsList;
