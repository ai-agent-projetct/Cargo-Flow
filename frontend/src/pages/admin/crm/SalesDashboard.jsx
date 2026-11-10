import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Target, FileText, Briefcase, ArrowRight, RefreshCw, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { crmAPI } from '../../../services/api';

// Sales & CRM > Sales Strategy > Dashboard.
//
// The funnel, the pipeline by stage and the target progress on one screen,
// because that is how a sales meeting reads it. Every figure comes from the
// same records the underlying lists show, so the dashboard and the lists can
// never disagree.

const money = (v, cur = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(2)}M ${cur}`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k ${cur}`;
  return `${n.toFixed(0)} ${cur}`;
};

const SalesDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmAPI.dashboard(teamId ? { salesTeamId: teamId } : {});
      setData(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the sales dashboard');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await crmAPI.teams.getAll({ limit: 'all' });
        const d = res.data?.data;
        setTeams(Array.isArray(d) ? d : []);
      } catch { /* the filter simply stays empty */ }
    })();
  }, []);

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-12 text-center text-slate-400 text-sm">
        Loading the sales dashboard…
      </div>
    );
  }
  if (!data) return null;

  const f = data.funnel;
  const stages = Object.entries(data.opportunitiesByStage || {});
  const maxStage = Math.max(1, ...stages.map(([, v]) => v.count));
  const quoteStatuses = Object.entries(data.quotationsByStatus || {});

  // The funnel only reads as a funnel if each step is measured against the
  // step above it, so each rate guards its own denominator.
  const steps = [
    { label: 'Prospects', value: f.prospects, icon: Users, to: '/admin/crm/prospects' },
    { label: 'Leads', value: f.leads, icon: FileText, to: '/admin/crm/leads' },
    { label: 'Opportunities', value: f.opportunities, icon: Briefcase, to: '/admin/opportunities' },
    { label: 'Quotations', value: f.quotations, icon: Target, to: '/admin/quotations' },
  ];
  const widest = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Sales Strategy</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            The funnel from prospect to quotation, and how each target is tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded text-xs"
          >
            <option value="">All teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            type="button"
            onClick={load}
            title="Reload"
            className="p-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Funnel</h2>
        <div className="space-y-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const prev = i > 0 ? steps[i - 1].value : null;
            const rate = prev ? (s.value / prev) * 100 : null;
            return (
              <Link
                key={s.label}
                to={s.to}
                className="flex items-center gap-3 group"
                title={`Open ${s.label.toLowerCase()}`}
              >
                <Icon size={14} className="text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 w-28 flex-shrink-0">{s.label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 group-hover:bg-blue-600 flex items-center justify-end px-2"
                    style={{ width: `${Math.max(6, (s.value / widest) * 100)}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">{s.value}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 w-20 text-right flex-shrink-0">
                  {rate !== null ? `${rate.toFixed(0)}% of above` : ''}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-5 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
          <span>
            Lead to opportunity
            <strong className="ml-1 text-slate-800">{f.leadToOpportunityRate}%</strong>
          </span>
          <span>
            Open leads
            <strong className="ml-1 text-slate-800">{f.openLeads}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline by opportunity stage */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Opportunities by stage
          </h2>
          {!stages.length && <p className="text-xs text-slate-400">No opportunities yet.</p>}
          <div className="space-y-2">
            {stages.map(([stage, v]) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-28 flex-shrink-0 capitalize truncate">
                  {stage.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-indigo-400"
                    style={{ width: `${Math.max(4, (v.count / maxStage) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-700 w-10 text-right">{v.count}</span>
                <span className="text-[11px] text-slate-500 w-20 text-right tabular-nums">
                  {money(v.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quotations by status */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Quotations by status
          </h2>
          {!quoteStatuses.length && <p className="text-xs text-slate-400">No quotations yet.</p>}
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {quoteStatuses.map(([status, v]) => (
                <tr key={status}>
                  <td className="py-1.5 capitalize text-slate-600">{status.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 text-right text-slate-700">{v.count}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{money(v.revenue)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${
                    Number(v.margin) < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                  >
                    {v.margin !== undefined ? money(v.margin) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-400 mt-2">
            Revenue and margin come from the quotations&rsquo; charge lines.
          </p>
        </div>
      </div>

      {/* Targets */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Target progress
          </h2>
          <Link to="/admin/crm/targets" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1">
            All targets <ArrowRight size={11} />
          </Link>
        </div>
        {!data.targets?.length && (
          <p className="text-xs text-slate-400">
            No targets set. Add one under Sales Strategy &gt; Targets.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(data.targets || []).map((t) => {
            const pct = Number(t.achievedPercentage) || 0;
            const colour = pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-400';
            const isMoney = t.targetParameter === 'gross_revenue' || t.targetParameter === 'gross_margin';
            const fmt = (v) => (isMoney
              ? money(v, t.targetCurrency)
              : Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }));
            return (
              <div key={t.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {t.salesperson?.name || 'Unassigned'}
                    </p>
                    <p className="text-[10px] text-slate-500 capitalize">
                      {t.targetParameter.replace(/_/g, ' ')}
                      {t.transportMode ? ` · ${t.transportMode}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${
                    pct >= 100 ? 'text-emerald-600' : 'text-slate-700'}`}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded overflow-hidden my-2">
                  <div className={`h-full ${colour}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{fmt(t.achievedValue)} of {fmt(t.targetValue)}</span>
                  <span>{String(t.dateFrom).slice(0, 7)} – {String(t.dateTo).slice(0, 7)}</span>
                </div>
                {Number(t.incentiveEarned) > 0 && (
                  <p className="text-[10px] text-emerald-700 mt-1 inline-flex items-center gap-1">
                    <TrendingUp size={10} />
                    Incentive {money(t.incentiveEarned, t.incentiveCurrency)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {!!data.targets?.length && (
          <p className="text-[10px] text-slate-400 mt-3">
            Achievement is measured from shipments the salesperson owns and the
            charge lines on them. Use Recompute on the Targets screen to refresh it.
          </p>
        )}
      </div>
    </div>
  );
};

export default SalesDashboard;
