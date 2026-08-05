import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Users as UsersIcon } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import Pagination from '../../../common/Pagination';
import LoadingSpinner from '../../../common/LoadingSpinner';
import AddUserModal from './AddUserModal';
import { formatDate } from '../../../utils/helpers';

const PAGE_SIZE = 80;

const UsersTab = ({ basePath = '/admin/administration/users' }) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getAll({ page, limit: PAGE_SIZE, search: search || undefined });
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

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Users</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button onClick={() => {}} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users..." className="max-w-md" />
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
            <UsersIcon className="w-10 h-10 mb-2" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left px-2 py-3">Name</th>
                  <th className="text-left px-2 py-3">Email Address</th>
                  <th className="text-left px-2 py-3">Language</th>
                  <th className="text-left px-2 py-3">Latest authentication</th>
                  <th className="text-left px-2 py-3">Default Company</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`${basePath}/${user.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-slate-300" />
                    </td>
                    <td className="px-2 py-3 font-medium text-primary-600">{user.name}</td>
                    <td className="px-2 py-3 text-primary-600">{user.email}</td>
                    <td className="px-2 py-3 text-slate-600">{user.preferences?.language || 'English (US)'}</td>
                    <td className="px-2 py-3 text-slate-500">{user.lastLogin ? formatDate(user.lastLogin) : ''}</td>
                    <td className="px-2 py-3 text-primary-600">{user.defaultCompany?.name || user.company?.name || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={(user) => { fetchData(); navigate(`${basePath}/${user.id}`); }}
      />
    </div>
  );
};

export default UsersTab;
