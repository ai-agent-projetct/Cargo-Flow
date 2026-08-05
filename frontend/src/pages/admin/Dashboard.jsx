import React, { useState, useEffect } from 'react';
import QuoteDashboardTab from './dashboard/QuoteDashboardTab';
import ShipmentDashboardTab from './dashboard/ShipmentDashboardTab';
import CarrierBookingDashboardTab from './dashboard/CarrierBookingDashboardTab';
import ActivityDashboardTab from './dashboard/ActivityDashboardTab';
import CreditLimitOverdueTab from './dashboard/CreditLimitOverdueTab';

// Map legacy route "tab" prop values to the new tab keys
const TAB_ALIASES = {
  quotes: 'quotes',
  shipments: 'shipments',
  activity: 'activity',
};

const AdminDashboard = ({ tab: propTab }) => {
  const [activeTab, setActiveTab] = useState(TAB_ALIASES[propTab] || 'quotes');

  useEffect(() => {
    if (propTab && TAB_ALIASES[propTab]) setActiveTab(TAB_ALIASES[propTab]);
  }, [propTab]);

  const sharedProps = { activeTab, onTabChange: setActiveTab };

  switch (activeTab) {
    case 'shipments':
      return <ShipmentDashboardTab {...sharedProps} />;
    case 'carrier-bookings':
      return <CarrierBookingDashboardTab {...sharedProps} />;
    case 'activity':
      return <ActivityDashboardTab {...sharedProps} />;
    case 'credit-limit-overdue':
      return <CreditLimitOverdueTab {...sharedProps} />;
    case 'quotes':
    default:
      return <QuoteDashboardTab {...sharedProps} />;
  }
};

export default AdminDashboard;
