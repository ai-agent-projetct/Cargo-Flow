import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FREIGHT_PRODUCTS } from './freightMastersData';

// "Administration > Freight Masters > Freight Product / <name> (<model>)"
// detail view, mirroring CargoFlo ERP: a breadcrumb-style header with
// record-number pagination (1/4, with previous/next chevrons cycling through
// all Freight Products), a "Shipment Matching Rule" card showing the
// rule conditions and matched record count, and a "Summary" notes tab.
const FreightProductDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [summary, setSummary] = useState('');

  const index = FREIGHT_PRODUCTS.findIndex((p) => p.id === id);
  const item = FREIGHT_PRODUCTS[index] || FREIGHT_PRODUCTS[0];
  const total = FREIGHT_PRODUCTS.length;

  const goRelative = (delta) => {
    const nextIndex = (index + delta + total) % total;
    navigate(`/admin/administration/freight-masters/freight-product/${FREIGHT_PRODUCTS[nextIndex].id}`);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/freight-product')}
            className="text-primary-600 font-medium hover:underline"
          >
            Freight Product
          </button>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-700">{item.name} ({item.model})</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{index + 1} / {total}</span>
          <button onClick={() => goRelative(-1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goRelative(1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div>
          <p className="text-xs text-slate-500 mb-1">Freight Product</p>
          <h2 className="text-2xl font-bold text-slate-900">{item.name}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Model</p>
            {item.modelLink ? (
              <span className="text-primary-600 font-medium">{item.model}</span>
            ) : (
              <span className="text-slate-700">{item.model}</span>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Product Type</p>
            <span className="text-slate-700">{item.productType}</span>
          </div>
        </div>

        {/* Shipment Matching Rule */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-primary-600 mb-3">Shipment Matching Rule</h3>

          <p className="text-sm text-slate-600 mb-3">
            {item.matchAll
              ? 'Match records with ALL of the following rules:'
              : 'Match records with the following rule:'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {item.rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
              >
                <span className="font-semibold text-slate-700">{rule.left}</span>
                {rule.op && <span className="text-slate-500">{rule.op}</span>}
                {rule.right && <span className="text-primary-600 font-medium">{rule.right}</span>}
              </div>
            ))}
          </div>

          <div className="mt-4">
            {/* Opens the products this master record covers. */}
            <button onClick={() => navigate(`/admin/accounting/customers/products?search=${encodeURIComponent(item.name || '')}`)}
              disabled={!item.recordCount}
              title={item.recordCount ? 'Open these records' : 'No records use this yet'}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white">
              <span>→</span> {item.recordCount} record(s)
            </button>
          </div>
        </div>

        {/* Summary tab */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <span className="text-sm font-semibold text-primary-600 border-b-2 border-primary-600 pb-2">Summary</span>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border-0 focus:outline-none focus:ring-0 resize-none"
            placeholder=""
          />
        </div>
      </div>
    </div>
  );
};

export default FreightProductDetail;
