import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Receipt, CreditCard, Briefcase, Wrench,
  Ship, TrendingUp, Anchor, DollarSign, Building, Users,
  Truck, MapPin, BarChart2, Settings, UserCog, Activity,
  FileCheck, Building2, ShoppingCart, CalendarDays, Shield, Landmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const userNavigation = [
  { label: 'Dashboard', href: '/user/dashboard', icon: LayoutDashboard },
  { label: 'Quotation', href: '/user/quotations', icon: FileText },
  { label: 'Invoices', href: '/user/invoices', icon: Receipt },
  { label: 'Credit Note', href: '/user/credit-notes', icon: CreditCard },
  { label: 'FF Jobs', href: '/user/ff-jobs', icon: Briefcase },
  { label: 'Service Jobs', href: '/user/service-jobs', icon: Wrench },
];

const adminNavigation = [
  { section: 'DASHBOARD' },
  { label: 'Activity Dashboard', href: '/admin/dashboard', icon: Activity },

  { label: 'Administration', href: '/admin/administration', icon: Building2 },

  { section: 'OPERATIONS' },
  { label: 'Operations', href: '/admin/house-shipments', icon: Ship },
  { label: 'Freight Booking', href: '/admin/freight-bookings', icon: Anchor },

  { section: 'TMS' },
  { label: 'TMS Requests', href: '/admin/tms', icon: Truck },

  { section: 'CALENDAR' },
  { label: 'Calendar', href: '/admin/calendar', icon: CalendarDays },

  { section: 'PROCUREMENT' },
  { label: 'Purchase', href: '/admin/procurement/purchase-orders', icon: ShoppingCart },

  { section: 'ACCOUNTING' },
  { label: 'Accounting', href: '/admin/accounting', icon: Landmark },
  { label: 'Invoices', href: '/admin/invoices', icon: Receipt },
  { label: 'Credit Notes', href: '/admin/credit-notes', icon: CreditCard },
  { label: 'Vendor Bills', href: '/admin/vendor-bills', icon: FileCheck },
  { label: 'Payments', href: '/admin/payments', icon: DollarSign },

  { section: 'ORGANIZATIONS' },
  { label: 'Organizations', href: '/admin/organizations', icon: Building },
  { label: 'Customers', href: '/admin/customers', icon: Users },

  { section: 'RATE MANAGEMENT' },
  { label: 'RMS', href: '/admin/rms/tariffs', icon: DollarSign },
  { label: 'Rate Management', href: '/admin/rates', icon: DollarSign },

  { section: 'ADMINISTRATION' },
  { label: 'Carriers', href: '/admin/carriers', icon: Truck },
  { label: 'Ports', href: '/admin/ports', icon: MapPin },
  { label: 'Reports', href: '/admin/reports', icon: BarChart2 },
  { label: 'Users', href: '/admin/users', icon: UserCog },
  { label: 'Access Rights', href: '/admin/access-rights', icon: Shield },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const Sidebar = () => {
  const { user, isAdmin } = useAuth();
  const { sidebarCollapsed } = useApp();
  const location = useLocation();

  const nav = isAdmin() ? adminNavigation : userNavigation;

  return (
    <aside
      className={`bg-[#1a1f2e] h-full flex flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-700 ${sidebarCollapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Ship className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <h1 className="text-white font-bold text-base leading-none">CargoFlo</h1>
            <p className="text-slate-400 text-xs mt-0.5">Freight ERP</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((item, idx) => {
          if (item.section) {
            if (sidebarCollapsed) {
              return <div key={idx} className="my-2 border-t border-slate-700" />;
            }
            return (
              <div key={idx} className="px-3 pt-4 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {item.section}
                </p>
              </div>
            );
          }

          const Icon = item.icon;
          const OPERATIONS_PATHS = [
            '/admin/house-shipments', '/admin/master-shipments', '/admin/cfs-receipts',
            '/admin/cfs-deliveries', '/admin/consolidations', '/admin/shipment-sharings',
            '/admin/ocr-documents', '/admin/container-numbers', '/admin/service-jobs',
            '/admin/quotations', '/admin/opportunities', '/admin/reports',
          ];
          const isActive =
            item.label === 'Operations'
              ? OPERATIONS_PATHS.some((p) => location.pathname.startsWith(p))
              : location.pathname === item.href ||
                (item.href !== '/admin/dashboard' &&
                  item.href !== '/user/dashboard' &&
                  !item.href.includes('/dashboard/') &&
                  location.pathname.startsWith(item.href));

          return (
            <NavLink
              key={item.href}
              to={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium
                ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }
                ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User info at bottom */}
      {!sidebarCollapsed ? (
        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.first_name?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
              </p>
              <p className="text-slate-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-700 flex justify-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.first_name?.[0] || user?.email?.[0] || 'U'}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
