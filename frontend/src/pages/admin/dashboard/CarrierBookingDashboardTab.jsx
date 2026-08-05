import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import DashboardLayout, { StatCard, DataTableWidget } from './DashboardLayout';

const labelCountCols = (labelHeader = 'Label') => [
  { key: 'label', label: labelHeader },
  { key: 'count', label: 'Count', align: 'right' },
];

const CarrierBookingDashboardTab = ({ activeTab, onTabChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getCarrierBookingDashboard();
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <PageLoader />;

  const d = data || {};

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={onTabChange}
      subtitle="Carrier Bookings"
      onRefresh={fetchData}
      showFullToolbar
      showSearch
      search={search}
      onSearchChange={setSearch}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <StatCard label="Total Bookings" value={d.totalBookings ?? 0} />
        </div>
        <div className="lg:col-span-2">
          <DataTableWidget title="Top 5 Carrier Booking" columns={labelCountCols('Carrier')} rows={d.topCarrierBookings} />
        </div>
      </div>

      <DataTableWidget title="Bookings Per User" columns={labelCountCols('User')} rows={d.bookingsPerUser} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget title="Top 5 Vessel Booking" columns={labelCountCols('Vessel / Container Type')} rows={d.topVesselBookings} />
        <DataTableWidget title="Top 5 Transporter Booking" columns={labelCountCols('Transporter')} rows={d.topTransporterBookings} />
      </div>
    </DashboardLayout>
  );
};

export default CarrierBookingDashboardTab;
