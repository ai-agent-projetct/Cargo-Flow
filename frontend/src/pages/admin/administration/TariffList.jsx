import React, { useState, useEffect, useCallback } from 'react';
import { useListView } from './useListView';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, FileText } from 'lucide-react';
import { tariffsAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import LoadingSpinner from '../../../common/LoadingSpinner';

// Shared list view for "Sell Tariff" and "Buy Tariff" under
// Administration > Tariff, mirroring CargoFlo ERP's list columns.
const TariffList = ({ tariffType, basePath }) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const title = tariffType === 'sell' ? 'Sell Tariff' : 'Buy Tariff';
  const partyLabel = tariffType === 'sell' ? 'Customer' : 'Vendor/Agent';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await tariffsAPI.getAll({ tariffType, limit: 1000 });
      setData(response.data.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tariffType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter((item) => {
    if (!search) return true;
    return (item.tariffName || '').toLowerCase().includes(search.toLowerCase());
  });

  const jobTypeLabel = (jobType) => (jobType === 'service_job' ? 'Service Job' : 'Shipment');

  // Filters / Group By / Favorites, applied to the rows below.
  const listView = useListView(filtered, { key: 'tariffs', groupFields: [{ key: 'tariffType', label: 'Type' }, { key: 'currency', label: 'Currency' }] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`${basePath}/create`)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder={`Search ${title.toLowerCase()}...`} className="max-w-md" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {listView.controls}
          </div>
          <p className="text-xs text-slate-500">1-{filtered.length}/{filtered.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No {title.toLowerCase()} records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Tariff Name</th>
                  <th className="text-left px-4 py-3">{partyLabel}</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Service Job Type</th>
                  <th className="text-left px-4 py-3">Shipment Type</th>
                  <th className="text-left px-4 py-3">Transport Mode</th>
                  <th className="text-left px-4 py-3">Cargo Type</th>
                  <th className="text-left px-4 py-3">Origin</th>
                  <th className="text-left px-4 py-3">Destination</th>
                  <th className="text-left px-4 py-3">No of Active Charges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listView.rows.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`${basePath}/${item.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-primary-600">{item.tariffName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.party?.companyName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.company?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{jobTypeLabel(item.jobType)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.serviceJobType || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.shipmentType || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.transportMode || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.cargoType || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.origin || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.destination || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.activeCharges ?? (item.charges?.length || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TariffList;
