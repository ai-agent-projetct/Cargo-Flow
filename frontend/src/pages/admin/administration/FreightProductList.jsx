import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { FREIGHT_PRODUCTS } from './freightMastersData';

// "Administration > Freight Masters > Freight Product" list, mirroring
// CargoFlo ERP's "Freight Product" screen (Freight Product / Model / Product
// Type columns). Rows are static reference/configuration records - clicking a
// row opens the matching-rule detail view.
const FreightProductList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const filtered = FREIGHT_PRODUCTS.filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Freight Product</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{filtered.length}/{filtered.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="text-left px-4 py-3">Freight Product</th>
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-left px-4 py-3">Product Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(item.id)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.model}</td>
                  <td className="px-4 py-3 text-slate-600">{item.productType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FreightProductList;
