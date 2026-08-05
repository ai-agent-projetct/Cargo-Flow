import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Building2, GripVertical } from 'lucide-react';
import { companiesAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import Pagination from '../../../common/Pagination';
import LoadingSpinner from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const PAGE_SIZE = 80;

const CompaniesList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await companiesAPI.getAll({ page, limit: PAGE_SIZE, search: search || undefined });
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

  const toggleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Companies</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/administration/companies/create')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button onClick={() => toast('Export coming soon')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search companies..." className="max-w-md" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
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
            <p className="text-sm">No companies found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="w-10 px-2 py-3"></th>
                <th className="text-left px-2 py-3">Company Name</th>
                <th className="text-left px-2 py-3">Partner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/admin/administration/companies/${company.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-2 py-3 text-slate-300">
                    <GripVertical className="w-4 h-4" />
                  </td>
                  <td className="px-2 py-3 font-medium text-slate-900">{company.name}</td>
                  <td className="px-2 py-3 text-slate-600">
                    {company.code ? `${company.code}: ${company.name}` : company.name}
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

export default CompaniesList;
