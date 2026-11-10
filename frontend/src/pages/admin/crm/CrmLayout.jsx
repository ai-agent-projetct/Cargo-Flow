import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Briefcase, FileSpreadsheet, Coins,
  Target, Layers, UsersRound, FileCode, Tags,
} from 'lucide-react';
import SalesDashboard from './SalesDashboard';
import LeadBoard from './LeadBoard';
import RateRequests from './RateRequests';
import { Prospects, SalesTargets } from './ProspectsAndTargets';
import {
  LeadStages, OpportunityStages, SalesTeams, QuoteTemplates, LeadSources,
} from './crmConfigPages';

// Sales & CRM.
//
// The funnel runs Prospect -> Lead -> Opportunity -> Quote -> Shipment, and
// the menu is in that order so the screens read the way the work does.
// Opportunities and Quotes already have their own screens elsewhere in the
// app, so this module links to them rather than duplicating them.

const SECTIONS = [
  {
    title: 'Sales',
    items: [
      { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: 'prospects', label: 'Prospect', icon: Users },
      { to: 'leads', label: 'Leads', icon: FileText },
      { to: '/admin/opportunities', label: 'Opportunity', icon: Briefcase, external: true },
      { to: '/admin/quotations', label: 'Quotes', icon: FileSpreadsheet, external: true },
      { to: 'rate-requests', label: 'Rate Requests', icon: Coins },
    ],
  },
  {
    title: 'Sales Strategy',
    items: [
      { to: 'targets', label: 'Targets', icon: Target },
    ],
  },
  {
    title: 'Configurations',
    items: [
      { to: 'config/lead-stage', label: 'Lead Stage', icon: Layers },
      { to: 'config/opportunity-stage', label: 'Opportunity Stage', icon: Layers },
      { to: 'config/lead-source', label: 'Lead Source', icon: Tags },
      { to: 'config/sales-team', label: 'Sales Team', icon: UsersRound },
      { to: 'config/quote-template', label: 'Quote Template', icon: FileCode },
    ],
  },
];

const CrmLayout = () => (
  <div className="flex gap-4 h-full">
    <aside className="w-52 flex-shrink-0 bg-white border border-slate-200 rounded-lg p-3 h-fit">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">
        Sales &amp; CRM
      </h2>
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-3">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {section.title}
          </p>
          <nav className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              // Opportunities and Quotes live outside this module, so they are
              // plain links rather than nested routes.
              if (item.external) {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-600 hover:bg-slate-100"
                  >
                    <Icon size={13} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                    isActive
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={13} className={`flex-shrink-0 ${isActive ? '' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>

    <div className="flex-1 min-w-0">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SalesDashboard />} />
        <Route path="prospects" element={<Prospects />} />
        <Route path="leads" element={<LeadBoard />} />
        <Route path="rate-requests" element={<RateRequests />} />
        <Route path="targets" element={<SalesTargets />} />
        <Route path="config/lead-stage" element={<LeadStages />} />
        <Route path="config/opportunity-stage" element={<OpportunityStages />} />
        <Route path="config/lead-source" element={<LeadSources />} />
        <Route path="config/sales-team" element={<SalesTeams />} />
        <Route path="config/quote-template" element={<QuoteTemplates />} />
        {/* An unknown sub-path lands on the dashboard rather than a blank pane. */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  </div>
);

export default CrmLayout;
