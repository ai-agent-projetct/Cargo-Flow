import { ACCOUNTING_MENU as MENU } from './menu';

// The Reporting and Configuration routes are derived from the same menu the
// dropdowns render, so a leaf can never point at a route that does not exist.
const PREFIX = '/admin/accounting/';

const leavesOf = (label) => {
  const section = MENU.find((m) => m.label === label);
  if (!section) return [];
  return section.groups.flatMap((g) => g.items || []);
};

const toRoute = (item) => {
  // menu hrefs are absolute; the routes are nested under /admin/accounting.
  const path = item.href.startsWith(PREFIX) ? item.href.slice(PREFIX.length) : item.href;
  return { path, title: item.label };
};

// /reports/<id>  →  report id
export const REPORT_ROUTES = leavesOf('Reporting')
  .map(toRoute)
  .filter((r) => r.path.startsWith('reports/'))
  .map((r) => ({ ...r, id: r.path.replace(/^reports\//, '') }));

// /config/<id>  →  config id. Settings has its own screen.
export const CONFIG_ROUTES = leavesOf('Configuration')
  .map(toRoute)
  .filter((r) => r.path.startsWith('config/') && r.path !== 'config/settings')
  .map((r) => ({ ...r, id: r.path.replace(/^config\//, '') }));
