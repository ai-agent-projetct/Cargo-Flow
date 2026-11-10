import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, RefreshCw, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import ResourceManager from './ResourceManager';
import { crmAPI, usersAPI } from '../../../services/api';

// Sales & CRM > Sales > Prospect, and Sales Strategy > Targets.
//
// Both are list-and-form screens with one real action each: converting a
// prospect into a customer account, and recomputing a target's achievement
// from live records. Everything else is handled by the shared
// ResourceManager.

const INDUSTRIES = [
  'Oil & Gas', 'Construction & Building Materials', 'Food & Beverage',
  'Automotive & Spare Parts', 'Pharmaceuticals & Healthcare',
  'Electronics & Consumer Goods', 'Textiles & Garments', 'Chemicals',
  'Events & Exhibitions', 'Retail & E-commerce', 'Other',
];

const PARTY_TYPES = ['Customer', 'Shipper', 'Consignee', 'Agent', 'Vendor', 'Carrier', 'Notify Party'];

const money = (v, cur = 'AED') => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '-';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${cur}`;
};

export const Prospects = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          crmAPI.teams.getAll({ limit: 'all' }),
          usersAPI.getAll({ limit: 'all' }),
        ]);
        const unwrap = (r) => {
          const d = r.data?.data;
          return Array.isArray(d) ? d : (d?.rows || d?.users || []);
        };
        setTeams(unwrap(t));
        setUsers(unwrap(u));
      } catch { /* the selects just show fewer options */ }
    })();
  }, []);

  const convert = async (row, reload) => {
    const ok = window.confirm(
      `Open a customer account for "${row.name}"?\n\n`
      + 'A contact record is created with this prospect\'s address and contact '
      + 'details, and the prospect stays linked to it as pipeline history.',
    );
    if (!ok) return;
    try {
      const res = await crmAPI.prospects.convert(row.id, {});
      toast.success(res.data?.message || 'Converted');
      await reload();
      const org = res.data?.data?.organization;
      if (org?.id) navigate(`/admin/organizations/${org.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not convert the prospect');
    }
  };

  return (
    <ResourceManager
      title="Prospect"
      subtitle="Companies that are not customers yet. Leads hang off a prospect, and converting one opens a real customer account without losing the pipeline history."
      api={crmAPI.prospects}
      listKey="prospects"
      searchPlaceholder="Name, contact, email, prospect no.…"
      emptyMessage="No prospects yet. Add the companies your team is working on."
      extraActions={(row, reload) => (
        <>
          {!row.relatedPartnerId && (
            <button
              type="button"
              onClick={() => convert(row, reload)}
              title="Open a customer account from this prospect"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 mr-1"
            >
              <ArrowRightLeft size={11} /> Convert
            </button>
          )}
          {row.relatedPartnerId && (
            <button
              type="button"
              onClick={() => navigate(`/admin/organizations/${row.relatedPartnerId}`)}
              title="Open the customer account this prospect became"
              className="p-1 text-slate-400 hover:text-blue-600"
            >
              <ExternalLink size={13} />
            </button>
          )}
        </>
      )}
      schema={[
        { name: 'prospectNumber', label: 'Ref', listOnly: true },
        { name: 'name', label: 'Company', required: true, width: 'full' },
        {
          name: 'relatedPartnerId',
          label: 'Converted',
          listOnly: true,
          render: (r) => (r.relatedPartnerId
            ? <span className="text-emerald-600 font-semibold">Customer</span>
            : <span className="text-slate-400">Prospect</span>),
        },
        { name: 'industry', label: 'Industry', type: 'select', options: INDUSTRIES },
        { name: 'contactName', label: 'Contact' },
        { name: 'designation', label: 'Designation', formOnly: true },
        { name: 'department', label: 'Department', formOnly: true },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'mobile', label: 'Mobile', formOnly: true },
        { name: 'website', label: 'Website', formOnly: true },
        { name: 'street1', label: 'Street', formOnly: true, width: 'full' },
        { name: 'street2', label: 'Street 2', formOnly: true },
        { name: 'city', label: 'City' },
        { name: 'state', label: 'State', formOnly: true },
        { name: 'country', label: 'Country' },
        { name: 'zip', label: 'Postcode', formOnly: true },
        {
          name: 'partyTypes',
          label: 'Would be',
          type: 'select',
          options: PARTY_TYPES,
          formOnly: true,
          hint: 'The party type this company would hold once converted',
        },
        { name: 'natureOfBusiness', label: 'Nature of business', formOnly: true, width: 'full' },
        {
          name: 'companyTurnover',
          label: 'Turnover',
          type: 'number',
          step: '0.01',
          render: (r) => money(r.companyTurnover, r.turnoverCurrency),
        },
        { name: 'turnoverCurrency', label: 'Currency', defaultValue: 'AED', formOnly: true },
        { name: 'clientTag', label: 'Client tag' },
        {
          name: 'assignedTo',
          label: 'Owner',
          type: 'select',
          options: users.map((u) => ({ value: u.id, label: u.name || u.email })),
          render: (r) => r.assignedUser?.name || '-',
        },
        {
          name: 'salesTeamId',
          label: 'Team',
          type: 'select',
          options: teams.map((t) => ({ value: t.id, label: t.name })),
          render: (r) => r.salesTeam?.name || '-',
        },
        { name: 'remarks', label: 'Remarks', type: 'textarea', width: 'full', formOnly: true },
        { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true, formOnly: true },
      ]}
    />
  );
};

const TARGET_PARAMETERS = [
  { value: 'gross_revenue', label: 'Gross revenue' },
  { value: 'gross_margin', label: 'Gross margin' },
  { value: 'teu', label: 'TEU' },
  { value: 'weight', label: 'Chargeable weight' },
  { value: 'volume', label: 'Volume (m3)' },
  { value: 'quotation', label: 'Quotations raised' },
];

export const SalesTargets = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          crmAPI.teams.getAll({ limit: 'all' }),
          usersAPI.getAll({ limit: 'all' }),
        ]);
        const unwrap = (r) => {
          const d = r.data?.data;
          return Array.isArray(d) ? d : (d?.rows || d?.users || []);
        };
        setTeams(unwrap(t));
        setUsers(unwrap(u));
      } catch { /* selects degrade gracefully */ }
    })();
  }, []);

  const recompute = async (row, reload) => {
    setRecomputing(true);
    try {
      const res = await crmAPI.targets.recompute(row?.id);
      toast.success(res.data?.message || 'Recomputed');
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not recompute');
    } finally {
      setRecomputing(false);
    }
  };

  const progress = (r) => {
    const pct = Number(r.achievedPercentage) || 0;
    const colour = pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-400';
    return (
      <div className="min-w-[110px]">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
          <span>{Number(r.achievedValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="font-semibold text-slate-700">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
          <div className={`h-full ${colour}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        {r.lastComputedAt && (
          <p className="text-[9px] text-slate-400 mt-0.5">
            as of {String(r.lastComputedAt).slice(0, 10)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => recompute(null, () => window.location.reload())}
          disabled={recomputing}
          title="Recompute every active target from live shipments, quotations and charge lines"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <RefreshCw size={13} className={recomputing ? 'animate-spin' : ''} />
          {recomputing ? 'Recomputing…' : 'Recompute all'}
        </button>
      </div>

      <ResourceManager
        title="Sales Target"
        subtitle="What each salesperson is measured on, for a period. Achievement is computed from real shipments, quotations and charge lines rather than entered by hand."
        api={crmAPI.targets}
        listKey="sales-targets"
        searchPlaceholder="Search targets…"
        emptyMessage="No sales targets yet."
        extraActions={(row, reload) => (
          <button
            type="button"
            onClick={() => recompute(row, reload)}
            disabled={recomputing}
            title="Recompute this target's achievement now"
            className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
          >
            <RefreshCw size={13} />
          </button>
        )}
        schema={[
          { name: 'name', label: 'Target', required: true, width: 'full' },
          {
            name: 'userId',
            label: 'Salesperson',
            type: 'select',
            required: true,
            options: users.map((u) => ({ value: u.id, label: u.name || u.email })),
            render: (r) => r.salesperson?.name || '-',
          },
          {
            name: 'salesTeamId',
            label: 'Team',
            type: 'select',
            options: teams.map((t) => ({ value: t.id, label: t.name })),
            render: (r) => r.salesTeam?.name || '-',
          },
          {
            name: 'managerId',
            label: 'Manager',
            type: 'select',
            options: users.map((u) => ({ value: u.id, label: u.name || u.email })),
            formOnly: true,
          },
          { name: 'dateFrom', label: 'From', type: 'date', required: true },
          { name: 'dateTo', label: 'To', type: 'date', required: true },
          {
            name: 'targetParameter',
            label: 'Measured on',
            type: 'select',
            required: true,
            options: TARGET_PARAMETERS,
            defaultValue: 'gross_revenue',
          },
          {
            name: 'targetValue',
            label: 'Target',
            type: 'number',
            step: '0.001',
            required: true,
            render: (r) => Number(r.targetValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
          },
          {
            name: 'achievedPercentage',
            label: 'Achieved',
            listOnly: true,
            render: progress,
          },
          {
            name: 'transportMode',
            label: 'Mode',
            type: 'select',
            options: ['SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER'],
            hint: 'Leave unset to measure every mode',
          },
          {
            name: 'shipmentType',
            label: 'Shipment type',
            type: 'select',
            options: ['FCL', 'LCL', 'Air Freight', 'FTL', 'LTL'],
            formOnly: true,
          },
          { name: 'targetCurrency', label: 'Currency', defaultValue: 'AED', formOnly: true },
          {
            name: 'incentiveType',
            label: 'Incentive type',
            type: 'select',
            options: [
              { value: 'percentage', label: 'Percentage of achievement' },
              { value: 'amount', label: 'Fixed amount on hitting target' },
            ],
            formOnly: true,
          },
          { name: 'incentiveUnit', label: 'Incentive rate', type: 'number', step: '0.01', formOnly: true },
          {
            name: 'incentiveUnitType',
            label: 'Incentive basis',
            type: 'select',
            options: [
              { value: 'net', label: 'Net' },
              { value: 'gross', label: 'Gross' },
              { value: 'freight', label: 'Freight only' },
            ],
            formOnly: true,
          },
          {
            name: 'incentiveEarned',
            label: 'Incentive',
            listOnly: true,
            render: (r) => money(r.incentiveEarned, r.incentiveCurrency),
          },
          { name: 'remarks', label: 'Remarks', type: 'textarea', width: 'full', formOnly: true },
          { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true, formOnly: true },
        ]}
      />
    </div>
  );
};
