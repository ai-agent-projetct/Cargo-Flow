import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, BarChart2, FileText, Users, Truck, Package, AlertCircle,
} from 'lucide-react';
import { reportsAPI } from '../../services/api';
import StatsCard from '../../common/StatsCard';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#e0f2fe', '#0ea5e9'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REPORT_TABS = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'shipments', label: 'Shipments', icon: BarChart2 },
  { key: 'quotations', label: 'Quotations', icon: FileText },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'carriers', label: 'Carrier Performance', icon: Truck },
  { key: 'operations', label: 'Operations', icon: Package },
  { key: 'aging', label: 'Outstanding / Aging', icon: AlertCircle },
];

const mockRevenue = {
  monthly: [
    { year: 2026, month: 1, revenue: 95000, collected: 88000, count: 12 },
    { year: 2026, month: 2, revenue: 102000, collected: 96000, count: 14 },
    { year: 2026, month: 3, revenue: 118000, collected: 105000, count: 16 },
    { year: 2026, month: 4, revenue: 125000, collected: 120000, count: 18 },
    { year: 2026, month: 5, revenue: 138000, collected: 130000, count: 20 },
  ],
  byStatus: [
    { status: 'paid', total: 420000, count: 60 },
    { status: 'partially_paid', total: 85000, count: 12 },
    { status: 'sent', total: 45000, count: 8 },
    { status: 'overdue', total: 28000, count: 5 },
  ],
  summary: { totalRevenue: 578000, totalCollected: 439000, totalOutstanding: 139000, totalInvoices: 85 },
};

const mockShipments = {
  byMode: [
    { mode: 'sea', count: 142 },
    { mode: 'air', count: 58 },
    { mode: 'land', count: 35 },
    { mode: 'rail', count: 13 },
  ],
  byStatus: [
    { status: 'delivered', count: 165 },
    { status: 'in_transit', count: 48 },
    { status: 'pending', count: 22 },
    { status: 'cancelled', count: 13 },
  ],
  byMonth: [
    { year: 2026, month: 1, count: 38 },
    { year: 2026, month: 2, count: 45 },
    { year: 2026, month: 3, count: 52 },
    { year: 2026, month: 4, count: 58 },
    { year: 2026, month: 5, count: 55 },
  ],
};

const mockQuotations = {
  byStatus: [
    { status: 'draft', count: 14 },
    { status: 'sent', count: 22 },
    { status: 'approved', count: 35 },
    { status: 'rejected', count: 8 },
    { status: 'converted', count: 28 },
  ],
  byMode: [
    { mode: 'sea', count: 60, totalValue: 480000 },
    { mode: 'air', count: 28, totalValue: 215000 },
    { mode: 'land', count: 15, totalValue: 65000 },
  ],
  conversionRate: 26.9,
  summary: { total: 107, converted: 28, approved: 35 },
};

const mockCustomers = [
  { id: 1, companyName: 'Acme Logistics Sdn Bhd', country: 'Malaysia', revenue: 185000, shipments: 42 },
  { id: 2, companyName: 'Pacific Trade Solutions', country: 'Singapore', revenue: 142000, shipments: 30 },
  { id: 3, companyName: 'KL Imports Sdn Bhd', country: 'Malaysia', revenue: 98000, shipments: 22 },
  { id: 4, companyName: 'Penang Manufacturing Bhd', country: 'Malaysia', revenue: 76000, shipments: 18 },
];

const mockCarriers = [
  { carrier: { id: 1, name: 'Maersk', type: 'shipping_line' }, totalShipments: 58, onTimeDeliveries: 52, onTimeRate: 89.7 },
  { carrier: { id: 2, name: 'MSC', type: 'shipping_line' }, totalShipments: 44, onTimeDeliveries: 38, onTimeRate: 86.4 },
  { carrier: { id: 3, name: 'Emirates SkyCargo', type: 'airline' }, totalShipments: 30, onTimeDeliveries: 28, onTimeRate: 93.3 },
];

const mockOperations = {
  cfsReceipts: [
    { status: 'draft', count: 6 },
    { status: 'received', count: 24 },
    { status: 'cancelled', count: 2 },
  ],
  cfsDeliveries: [
    { status: 'draft', count: 4 },
    { status: 'delivered', count: 19 },
    { status: 'cancelled', count: 1 },
  ],
  consolidations: [
    { status: 'draft', count: 5 },
    { status: 'confirmed', count: 8 },
    { status: 'in_transit', count: 6 },
    { status: 'completed', count: 14 },
  ],
  shipmentSharings: [
    { direction: 'import_to_export', count: 9 },
    { direction: 'export_to_import', count: 6 },
  ],
  serviceJobsByType: [
    { serviceType: 'CUSTOMS_CLEARANCE', count: 18 },
    { serviceType: 'TRUCKING', count: 12 },
    { serviceType: 'WAREHOUSING', count: 7 },
    { serviceType: 'DOCUMENTATION', count: 5 },
  ],
};

const mockAging = {
  buckets: { current: 45000, '1-30': 28000, '31-60': 15000, '61-90': 8000, '90+': 4000 },
  invoices: [
    { id: 1, invoiceNumber: 'INV-2026-0041', customer: 'Acme Logistics Sdn Bhd', dueDate: '2026-05-15', balanceAmount: 12000, daysOverdue: 29, bucket: '1-30' },
    { id: 2, invoiceNumber: 'INV-2026-0033', customer: 'Pacific Trade Solutions', dueDate: '2026-04-10', balanceAmount: 8500, daysOverdue: 64, bucket: '61-90' },
    { id: 3, invoiceNumber: 'INV-2026-0028', customer: 'KL Imports Sdn Bhd', dueDate: '2026-03-01', balanceAmount: 4000, daysOverdue: 104, bucket: '90+' },
  ],
};

const monthLabel = (row) => `${MONTH_NAMES[(row.month || 1) - 1]} ${row.year}`;

const AdminReports = () => {
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('year');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  const fetchTab = useCallback(async (tab) => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'revenue': res = await reportsAPI.getRevenueStats({ period }); break;
        case 'shipments': res = await reportsAPI.getShipmentStats({ period }); break;
        case 'quotations': res = await reportsAPI.getQuotationStats({ period }); break;
        case 'customers': res = await reportsAPI.getCustomerStats({ period }); break;
        case 'carriers': res = await reportsAPI.getCarrierPerformance({ period }); break;
        case 'operations': res = await reportsAPI.getOperationsStats({ period }); break;
        case 'aging': res = await reportsAPI.getAgingReport({}); break;
        default: break;
      }
      setData((d) => ({ ...d, [tab]: res?.data?.data }));
    } catch {
      const fallback = {
        revenue: mockRevenue, shipments: mockShipments, quotations: mockQuotations,
        customers: mockCustomers, carriers: mockCarriers, operations: mockOperations, aging: mockAging,
      };
      setData((d) => ({ ...d, [tab]: fallback[tab] }));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchTab(activeTab); }, [activeTab, fetchTab]);

  const revenue = data.revenue || mockRevenue;
  const shipments = data.shipments || mockShipments;
  const quotations = data.quotations || mockQuotations;
  const customers = data.customers || mockCustomers;
  const carriers = data.carriers || mockCarriers;
  const operations = data.operations || mockOperations;
  const aging = data.aging || mockAging;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-sm text-slate-500">Business performance overview</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors -mb-px ${
                activeTab === tab.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? <PageLoader text="Loading report..." /> : (
        <>
          {/* Revenue Report */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Revenue" value={formatCurrency(revenue.summary?.totalRevenue)} icon={TrendingUp} iconBg="bg-green-100" iconColor="text-green-600" />
                <StatsCard title="Collected" value={formatCurrency(revenue.summary?.totalCollected)} icon={TrendingUp} iconBg="bg-blue-100" iconColor="text-blue-600" />
                <StatsCard title="Outstanding" value={formatCurrency(revenue.summary?.totalOutstanding)} icon={AlertCircle} iconBg="bg-amber-100" iconColor="text-amber-600" />
                <StatsCard title="Total Invoices" value={revenue.summary?.totalInvoices ?? '-'} icon={FileText} iconBg="bg-purple-100" iconColor="text-purple-600" />
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-6">Revenue vs Collected (Monthly)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(revenue.monthly || []).map((r) => ({ ...r, label: monthLabel(r) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [formatCurrency(v), undefined]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#1e40af" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-4">Invoices by Status</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Count</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(revenue.byStatus || []).map((row) => (
                      <tr key={row.status} className="border-b border-slate-50">
                        <td className="py-2.5 text-slate-700 capitalize">{row.status?.replace('_', ' ')}</td>
                        <td className="py-2.5 text-right text-slate-700">{row.count}</td>
                        <td className="py-2.5 text-right font-medium text-slate-900">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Shipments Report */}
          {activeTab === 'shipments' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-6">Shipments per Month</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={(shipments.byMonth || []).map((r) => ({ ...r, label: monthLabel(r) }))} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Shipments" fill="#1e40af" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-4">By Transport Mode</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={shipments.byMode || []} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="count" nameKey="mode">
                      {(shipments.byMode || []).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {(shipments.byMode || []).map((item, idx) => (
                    <div key={item.mode} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-xs text-slate-600 capitalize">{item.mode}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="xl:col-span-3 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-4">By Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(shipments.byStatus || []).map((row) => (
                    <div key={row.status} className="border border-slate-100 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900">{row.count}</p>
                      <p className="text-xs text-slate-500 capitalize mt-1">{row.status?.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quotations Report */}
          {activeTab === 'quotations' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Quotations" value={quotations.summary?.total ?? '-'} icon={FileText} iconBg="bg-blue-100" iconColor="text-blue-600" />
                <StatsCard title="Approved" value={quotations.summary?.approved ?? '-'} icon={TrendingUp} iconBg="bg-green-100" iconColor="text-green-600" />
                <StatsCard title="Converted" value={quotations.summary?.converted ?? '-'} icon={Package} iconBg="bg-purple-100" iconColor="text-purple-600" />
                <StatsCard title="Conversion Rate" value={`${quotations.conversionRate ?? 0}%`} icon={TrendingUp} iconBg="bg-cyan-100" iconColor="text-cyan-600" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-4">By Status</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={quotations.byStatus || []} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip />
                      <Bar dataKey="count" name="Count" fill="#1e40af" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-4">Value by Transport Mode</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-2">Mode</th>
                        <th className="py-2 text-right">Count</th>
                        <th className="py-2 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quotations.byMode || []).map((row) => (
                        <tr key={row.mode} className="border-b border-slate-50">
                          <td className="py-2.5 text-slate-700 capitalize">{row.mode}</td>
                          <td className="py-2.5 text-right text-slate-700">{row.count}</td>
                          <td className="py-2.5 text-right font-medium text-slate-900">{formatCurrency(row.totalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Customers Report */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4">Top Customers by Revenue</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-2">Company</th>
                    <th className="py-2">Country</th>
                    <th className="py-2 text-right">Shipments</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(customers) ? customers : []).map((c) => (
                    <tr key={c.id} className="border-b border-slate-50">
                      <td className="py-2.5 font-medium text-slate-900">{c.companyName}</td>
                      <td className="py-2.5 text-slate-600">{c.country || '-'}</td>
                      <td className="py-2.5 text-right text-slate-700">{c.shipments ?? 0}</td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{formatCurrency(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Carrier Performance */}
          {activeTab === 'carriers' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4">Carrier On-Time Performance</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-2">Carrier</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 text-right">Total Shipments</th>
                    <th className="py-2 text-right">On-Time Deliveries</th>
                    <th className="py-2 text-right">On-Time Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(carriers) ? carriers : []).map((row) => (
                    <tr key={row.carrier?.id} className="border-b border-slate-50">
                      <td className="py-2.5 font-medium text-slate-900">{row.carrier?.name}</td>
                      <td className="py-2.5 text-slate-600 capitalize">{row.carrier?.type?.replace('_', ' ')}</td>
                      <td className="py-2.5 text-right text-slate-700">{row.totalShipments}</td>
                      <td className="py-2.5 text-right text-slate-700">{row.onTimeDeliveries}</td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{row.onTimeRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Operations Report */}
          {activeTab === 'operations' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { title: 'CFS Receipts by Status', rows: operations.cfsReceipts, key: 'status' },
                { title: 'CFS Deliveries by Status', rows: operations.cfsDeliveries, key: 'status' },
                { title: 'Export Console (Consolidations) by Status', rows: operations.consolidations, key: 'status' },
                { title: 'Shipment Sharing by Direction', rows: operations.shipmentSharings, key: 'direction' },
                { title: 'Service Jobs by Type', rows: operations.serviceJobsByType, key: 'serviceType' },
              ].map((block) => (
                <div key={block.title} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-4">{block.title}</h3>
                  {(block.rows || []).length === 0 ? (
                    <p className="text-sm text-slate-400">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={block.rows} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey={block.key} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Count" fill="#1e40af" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Aging / Outstanding Report */}
          {activeTab === 'aging' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(aging.buckets || {}).map(([bucket, amount]) => (
                  <StatsCard key={bucket} title={bucket === 'current' ? 'Current' : `${bucket} days`} value={formatCurrency(amount)} icon={AlertCircle} iconBg="bg-amber-100" iconColor="text-amber-600" />
                ))}
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-4">Outstanding Invoices</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2">Invoice</th>
                      <th className="py-2">Customer</th>
                      <th className="py-2">Due Date</th>
                      <th className="py-2 text-right">Balance</th>
                      <th className="py-2 text-right">Days Overdue</th>
                      <th className="py-2">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aging.invoices || []).length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-400">No outstanding invoices</td></tr>
                    ) : (aging.invoices || []).map((inv) => (
                      <tr key={inv.id} className="border-b border-slate-50">
                        <td className="py-2.5 font-mono text-primary-700 text-xs">{inv.invoiceNumber}</td>
                        <td className="py-2.5 text-slate-700">{inv.customer}</td>
                        <td className="py-2.5 text-slate-600 text-xs">{formatDate(inv.dueDate)}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">{formatCurrency(inv.balanceAmount)}</td>
                        <td className="py-2.5 text-right text-slate-700">{inv.daysOverdue}</td>
                        <td className="py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inv.bucket === '90+' ? 'bg-red-100 text-red-700' : inv.bucket === 'current' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {inv.bucket}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminReports;
