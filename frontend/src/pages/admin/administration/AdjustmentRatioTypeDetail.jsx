import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ADJUSTMENT_RATIO_TYPES } from './adjustmentRatioTypeData';

// "Administration > Freight Masters > Adjustment Ratio Type / Name" detail
// view, mirroring SeaRates ERP: breadcrumb with record pagination (N/Total,
// with prev/next chevrons), Name (large title), and a read-only "Is Package
// Group" toggle. No Edit/Action controls in this read-only screen.
const AdjustmentRatioTypeDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const total = ADJUSTMENT_RATIO_TYPES.length;
  const index = Math.min(Math.max(parseInt(id, 10) || 0, 0), total - 1);
  const item = ADJUSTMENT_RATIO_TYPES[index];

  const goRelative = (delta) => {
    const nextIndex = (index + delta + total) % total;
    navigate(`/admin/administration/freight-masters/adjustment-ratio-type/${nextIndex}`);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/freight-masters/adjustment-ratio-type')}
            className="text-primary-600 font-medium hover:underline"
          >
            Adjustment Ratio Type
          </button>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-700">{item.name}</span>
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
          <p className="text-xs text-slate-500 mb-1">Name</p>
          <h2 className="text-2xl font-bold text-slate-900">{item.name}</h2>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">Is Package Group</p>
          <span className={`relative inline-flex items-center w-11 h-6 rounded-full ${item.isPackageGroup ? 'bg-primary-600' : 'bg-slate-300'}`}>
            <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-[10px] ${item.isPackageGroup ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
              {item.isPackageGroup ? '✓' : '✕'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentRatioTypeDetail;
