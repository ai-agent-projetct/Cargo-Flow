import React, { useState, useEffect, useCallback } from 'react';
import { exportCsv } from '../../../utils/exportCsv';
import { useParams } from 'react-router-dom';
import { Plus, Download, Save, X, FileText, Trash2 } from 'lucide-react';
import { masterDataAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import LoadingSpinner from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { MASTER_DATA_CONFIG } from './manageMastersData';

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

const DEFAULT_CONFIG = {
  title: 'Records',
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
};

const emptyRow = { code: '', name: '', extra: '', extra2: '', extra3: '', isActive: true };

const GenericMasterList = () => {
  const { category } = useParams();
  const config = MASTER_DATA_CONFIG[category] || DEFAULT_CONFIG;
  const fields = config.fields.some((f) => f.key === 'isActive')
    ? config.fields
    : [...config.fields, { key: 'isActive', label: 'Active' }];
  const columns = fields.filter((f) => f.key !== 'isActive');
  const activeLabel = config.activeLabel || 'Active';

  const [data, setData] = useState([]);
  // Export exactly the columns the table shows.
  const doExport = () => {
    if (!exportCsv(data, columns.map((f) => ({ key: f.key, label: f.label })), category || 'master-data')) {
      toast.error('Nothing to export');
    } else toast.success(`Exported ${data.length} rows`);
  };
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState(emptyRow);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await masterDataAPI.getAll(category, search ? { search } : {});
      setData(response.data.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startCreate = () => {
    setCreating(true);
    setNewRow(emptyRow);
  };

  const discardCreate = () => {
    setCreating(false);
    setNewRow(emptyRow);
  };

  const handleSaveNew = async () => {
    if (!newRow.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await masterDataAPI.create(category, {
        code: newRow.code.trim() || null,
        name: newRow.name.trim(),
        extra: newRow.extra.trim() || null,
        extra2: newRow.extra2.trim() || null,
        extra3: newRow.extra3.trim() || null,
        isActive: newRow.isActive,
        sortOrder: data.length + 1,
      });
      toast.success('Record created');
      setCreating(false);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      await masterDataAPI.update(category, item.id, { isActive: !item.isActive });
      setData((prev) => prev.map((x) => x.id === item.id ? { ...x, isActive: !x.isActive } : x));
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await masterDataAPI.delete(category, item.id);
      toast.success('Record deleted');
      setData((prev) => prev.filter((x) => x.id !== item.id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const total = data.length + (creating ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{config.title}</h2>
        <div className="flex items-center gap-2">
          {creating ? (
            <>
              <button onClick={handleSaveNew} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={discardCreate} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                <X className="w-4 h-4" /> Discard
              </button>
              <button onClick={() => doExport()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
                <Download className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Create
              </button>
              <button onClick={() => doExport()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder={`Search ${config.title.toLowerCase()}...`} className="max-w-md" />
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
        ) : data.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No records found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {columns.map((f) => (
                  <th key={f.key} className="text-left px-4 py-3">{f.label}</th>
                ))}
                <th className="text-left px-4 py-3">{activeLabel}</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  {columns.map((f, idx) => (
                    <td key={f.key} className={`px-4 py-3 ${idx === 0 ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                      {item[f.key] || '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Toggle checked={!!item.isActive} onChange={() => handleToggle(item)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {creating && (
                <tr className="bg-primary-50/40">
                  {columns.map((f) => (
                    <td key={f.key} className="px-4 py-3">
                      <input
                        type="text"
                        value={newRow[f.key] || ''}
                        onChange={(e) => setNewRow((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.label}
                        className="w-full min-w-[8rem] px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Toggle checked={newRow.isActive} onChange={() => setNewRow((p) => ({ ...p, isActive: !p.isActive }))} />
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default GenericMasterList;
