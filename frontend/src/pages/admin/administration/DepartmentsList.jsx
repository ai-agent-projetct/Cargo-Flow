import React, { useState, useEffect, useCallback } from 'react';
import { useListView } from './useListView';
import { exportCsv } from '../../../utils/exportCsv';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Building2 } from 'lucide-react';
import { departmentsAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import Pagination from '../../../common/Pagination';
import LoadingSpinner from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const PAGE_SIZE = 80;

const DepartmentsList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const doExport = () => {
    if (!exportCsv(data, [], 'departments')) toast.error('Nothing to export');
    else toast.success(`Exported ${data.length} rows`);
  };
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await departmentsAPI.getAll({ page, limit: PAGE_SIZE, search: search || undefined });
      setData(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleActive = async (dept, e) => {
    e.stopPropagation();
    try {
      await departmentsAPI.update(dept.id, { status: dept.status === 'active' ? 'inactive' : 'active' });
      fetchData();
    } catch {
      toast.error('Failed to update');
    }
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // Filters / Group By / Favorites, applied to the rows below.
  const listView = useListView(data, { key: 'departments', groupFields: [] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Departments</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/administration/departments/create')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button onClick={() => doExport()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search departments..." className="max-w-md" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {listView.controls}
          </div>
          {total > 0 && (
            <p className="text-xs text-slate-500">{from}-{to}/{total}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Building2 className="w-10 h-10 mb-2" />
            <p className="text-sm">No departments found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="text-right px-2 py-3 w-16">ID</th>
                <th className="text-left px-2 py-3">Department Name</th>
                <th className="text-right px-2 py-3">User Count</th>
                <th className="text-center px-2 py-3 w-24">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listView.rows.map((dept, idx) => (
                <tr
                  key={dept.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/admin/administration/departments/${dept.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300" />
                  </td>
                  <td className="px-2 py-3 text-right text-slate-500">{dept.legacyId ?? (from + idx)}</td>
                  <td className="px-2 py-3 font-medium text-slate-900">{dept.name}</td>
                  <td className="px-2 py-3 text-right text-slate-600">{dept.members?.length || dept.defaultUserCount || 0}</td>
                  <td className="px-2 py-3 text-center">
                    <button onClick={(e) => toggleActive(dept, e)} className="inline-flex">
                      <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${dept.status === 'active' ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                        <span className="w-4 h-4 bg-white rounded-full shadow" />
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>
    </div>
  );
};

export default DepartmentsList;
