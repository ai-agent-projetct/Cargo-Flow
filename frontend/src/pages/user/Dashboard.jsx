import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CreditCard, CheckCircle, XCircle, Briefcase, Wrench, DollarSign, AlertCircle, ArrowRight } from 'lucide-react';
import { dashboardAPI } from '../../services/api';

import { PageLoader } from '../../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

const mockStats = {
  invoiceCount: 5,
  creditNoteCount: 2,
  approvedQuotesCount: 8,
  unacceptedQuotesCount: 3,
  ffJobsCount: 12,
  serviceJobsCount: 4,
  totalPaidAmount: 84500,
  totalDueAmount: 279674.85,
};

const KpiCard = ({ icon: Icon, label, value, link, colorClass, bgClass, isAmount }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => link && link !== '#' && navigate(link)}
      className={`bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow group`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 ${bgClass} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        {link && link !== '#' && (
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">
          {isAmount ? value : value}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
};

const UserDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await dashboardAPI.getUserStats();
        setStats(res.data.data);
      } catch {
        setStats(mockStats);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <PageLoader />;

  const s = stats || mockStats;

  const row1 = [
    { icon: Receipt, label: 'Invoices', value: s.invoiceCount ?? 0, link: '/user/invoices', colorClass: 'text-blue-600', bgClass: 'bg-blue-50' },
    { icon: CreditCard, label: 'Credit Notes', value: s.creditNoteCount ?? 0, link: '/user/credit-notes', colorClass: 'text-purple-600', bgClass: 'bg-purple-50' },
    { icon: CheckCircle, label: 'Approved Quotes', value: s.approvedQuotesCount ?? 0, link: '/user/quotations?status=accepted', colorClass: 'text-green-600', bgClass: 'bg-green-50' },
    { icon: XCircle, label: 'Un-Accepted Quotes', value: s.unacceptedQuotesCount ?? 0, link: '/user/quotations?status=un_accepted', colorClass: 'text-red-600', bgClass: 'bg-red-50' },
  ];

  const row2 = [
    { icon: Briefcase, label: 'No of FF Jobs', value: s.ffJobsCount ?? 0, link: '/user/ff-jobs', colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50' },
    { icon: Wrench, label: 'No of Service Jobs', value: s.serviceJobsCount ?? 0, link: '/user/service-jobs', colorClass: 'text-orange-600', bgClass: 'bg-orange-50' },
    { icon: DollarSign, label: 'Total Paid Amount', value: `${(s.totalPaidAmount ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MYR`, link: '#', colorClass: 'text-teal-600', bgClass: 'bg-teal-50', isAmount: true },
    { icon: AlertCircle, label: 'Total Due Amount', value: `${(s.totalDueAmount ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MYR`, link: '#', colorClass: 'text-yellow-600', bgClass: 'bg-yellow-50', isAmount: true },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Welcome bar */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-xl p-5 text-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            Welcome back, {(user?.name || '').split(' ')[0] || 'there'}!
          </h2>
          <p className="text-blue-200 text-sm mt-0.5">
            Here's an overview of your cargo operations.
          </p>
        </div>
      </div>

      {/* Row 1 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {row1.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* Row 2 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {row2.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
};

export default UserDashboard;
