import React, { useEffect, useState } from 'react';
import { Clock, CalendarCheck, AlertTriangle, CalendarClock } from 'lucide-react';
import { dashboardAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import DashboardLayout from './DashboardLayout';

const ActivityDashboardTab = ({ activeTab, onTabChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getActivityDashboard();
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

  const cards = [
    { label: 'Pending Approval', value: d.pendingApproval ?? 0, icon: Clock, color: 'text-orange-500' },
    { label: 'Today Action', value: d.todayAction ?? 0, icon: CalendarCheck, color: 'text-blue-500' },
    { label: 'Overdue Action', value: d.overdueAction ?? 0, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Future Action', value: d.futureAction ?? 0, icon: CalendarClock, color: 'text-green-500' },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={onTabChange}
      subtitle="Activity Dashboard"
      onRefresh={fetchData}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 font-medium mt-1">{label}</p>
            </div>
            <Icon className={`w-10 h-10 ${color}`} />
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default ActivityDashboardTab;
