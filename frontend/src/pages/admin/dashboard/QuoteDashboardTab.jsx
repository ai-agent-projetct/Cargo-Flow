import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import DashboardLayout, { StatCard, DataTableWidget } from './DashboardLayout';

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  pending: 'Pending',
  accepted: 'Accepted',
  un_accepted: 'Un-Accepted',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
  cancelled: 'Cancelled',
};

const QuoteDashboardTab = ({ activeTab, onTabChange }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getAdminStats();
      setStats(res.data.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <PageLoader />;

  const q = stats?.quotations || {};
  const byStatus = q.byStatus || {};
  const byMode = q.byMode || {};
  const totalQuotes = q.total || 0;
  const pendingQuotes = (byStatus.sent || 0) + (byStatus.pending || 0);
  const convertedQuotes = byStatus.converted || 0;
  const conversionRate = totalQuotes ? ((convertedQuotes / totalQuotes) * 100).toFixed(1) : '0.0';

  const statusRows = Object.entries(byStatus).map(([status, count]) => ({
    status: STATUS_LABELS[status] || status,
    count,
  }));

  const modeRows = Object.entries(byMode).map(([mode, count]) => ({
    mode,
    count,
  }));

  const tradeLaneRows = (q.topTradeLanes || []).slice(0, 5).map((t) => ({
    origin: t.origin,
    destination: t.destination,
    count: t.count,
  }));

  const userRows = q.quotesPerUser || [];
  const carrierRows = q.quotesPerCarrier || [];
  const countryRows = q.quotesPerCountry || [];
  const originRows = q.quotesPerOrigin || [];
  const topCustomerRows = q.topCustomers || [];

  const conv = q.conversionStatus || {};
  const conversionRows = [
    { status: 'Converted as Booking', count: conv.convertedAsBooking || 0 },
    { status: 'Lost', count: conv.lost || 0 },
    { status: 'Pending', count: conv.pending || 0 },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={onTabChange}
      subtitle="Quotes"
      onRefresh={fetchData}
      showFullToolbar
      showSearch
      search={search}
      onSearchChange={setSearch}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Quotes" value={totalQuotes} />
        <StatCard label="Pending Quotes" value={pendingQuotes} />
        <StatCard label="Converted Quotes" value={convertedQuotes} />
        <StatCard label="Quote Conversion %" value={`${conversionRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget
          title="Number of Quotes Per User"
          columns={[
            { key: 'label', label: 'User' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={userRows}
        />
        <DataTableWidget
          title="Top 5 Trade-lane"
          columns={[
            { key: 'origin', label: 'Origin' },
            { key: 'destination', label: 'Destination' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={tradeLaneRows}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget
          title="Number of Quotes by Status"
          columns={[
            { key: 'status', label: 'Status' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={statusRows}
        />
        <DataTableWidget
          title="Quote Conversion Status"
          columns={[
            { key: 'status', label: 'Status' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={conversionRows}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget
          title="Quotes Per Carrier"
          columns={[
            { key: 'label', label: 'Carrier' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={carrierRows}
        />
        <DataTableWidget
          title="Quotes Per Country"
          columns={[
            { key: 'label', label: 'Country' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={countryRows}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget
          title="Quotes Per Transport Mode"
          columns={[
            { key: 'mode', label: 'Transport Mode' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={modeRows}
        />
        <DataTableWidget
          title="Quotes Per Origin"
          columns={[
            { key: 'label', label: 'Origin' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={originRows}
        />
      </div>

      <DataTableWidget
        title="Top 5 Customers"
        columns={[
          { key: 'label', label: 'Customer' },
          { key: 'count', label: 'Count', align: 'right' },
        ]}
        rows={topCustomerRows}
      />
    </DashboardLayout>
  );
};

export default QuoteDashboardTab;
