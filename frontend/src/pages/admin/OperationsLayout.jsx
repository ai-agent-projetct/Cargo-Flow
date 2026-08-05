import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';

const TABS = [
  { key: 'house-shipment', label: 'House Shipment', path: '/admin/house-shipments' },
  { key: 'cfs', label: 'CFS', path: '/admin/cfs-receipts' },
  { key: 'export-console', label: 'Export Console Generation', path: '/admin/consolidations' },
  { key: 'master-shipment', label: 'Master shipment(Console)', path: '/admin/master-shipments' },
  { key: 'shipment-sharing', label: 'Shipment Sharing', path: '/admin/shipment-sharings' },
];

const CFS_SUBMENU = [
  { label: 'Receive Entry', path: '/admin/cfs-receipts' },
  { label: 'Delivery Entry', path: '/admin/cfs-deliveries' },
];

// Shipment Sharing splits by direction, and within each direction by whether
// the shipment has been converted yet. Converted views are read-only on the
// live demo (no create/edit/delete), matching the `readOnly` flag here.
const SHARING_SUBMENU = [
  { section: 'Import To Export' },
  { label: 'Pending Shipment', path: '/admin/shipment-sharings?direction=import_to_export&converted=false' },
  { label: 'Converted Shipment', path: '/admin/shipment-sharings?direction=import_to_export&converted=true' },
  { section: 'Export To Import' },
  { label: 'Pending Shipment', path: '/admin/shipment-sharings?direction=export_to_import&converted=false' },
  { label: 'Converted Shipment', path: '/admin/shipment-sharings?direction=export_to_import&converted=true' },
];

const PLUS_MENU = [
  { label: 'Service Job', path: '/admin/service-jobs' },
  { label: 'Quotes', path: '/admin/quotations' },
  { label: 'Opportunity', path: '/admin/opportunities' },
  { section: 'OCR Document' },
  { label: 'OCR Document', path: '/admin/ocr-documents' },
  { section: 'Reporting' },
  { label: 'Sales Report by Customer', path: '/admin/reports?type=sales-by-customer' },
  { label: 'Sales Report by Shipping Lines', path: '/admin/reports?type=sales-by-shipping-lines' },
  { label: 'Custom Duty Report', path: '/admin/reports?type=custom-duty' },
  { label: 'Charge Wise Shipment Estimated VS Actual', path: '/admin/reports?type=charge-wise-estimated-vs-actual' },
  { label: 'Shipment Profit Report', path: '/admin/reports?type=shipment-profit' },
  { label: 'Shipper Wise Report', path: '/admin/reports?type=shipper-wise' },
  { label: 'Customer Wise Report', path: '/admin/reports?type=customer-wise' },
  { section: 'Configuration' },
  { label: 'Container Number', path: '/admin/container-numbers' },
];

const OperationsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCfsMenu, setShowCfsMenu] = useState(false);
  const [showSharingMenu, setShowSharingMenu] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowCfsMenu(false);
        setShowSharingMenu(false);
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { pathname, search } = location;

  let activeTab = '';
  if (pathname.startsWith('/admin/house-shipments')) activeTab = 'house-shipment';
  else if (pathname.startsWith('/admin/cfs-receipts') || pathname.startsWith('/admin/cfs-deliveries')) activeTab = 'cfs';
  else if (pathname.startsWith('/admin/consolidations')) activeTab = 'export-console';
  else if (pathname.startsWith('/admin/master-shipments')) activeTab = 'master-shipment';
  else if (pathname.startsWith('/admin/shipment-sharings')) activeTab = 'shipment-sharing';

  const isPlusActive = ['/admin/service-jobs', '/admin/quotations', '/admin/opportunities', '/admin/ocr-documents', '/admin/reports', '/admin/container-numbers']
    .some((p) => pathname.startsWith(p));

  const handleTabClick = (tab) => {
    if (tab.key === 'cfs') {
      setShowPlusMenu(false);
      setShowSharingMenu(false);
      setShowCfsMenu((prev) => !prev);
      return;
    }
    if (tab.key === 'shipment-sharing') {
      setShowPlusMenu(false);
      setShowCfsMenu(false);
      setShowSharingMenu((prev) => !prev);
      return;
    }
    setShowCfsMenu(false);
    setShowSharingMenu(false);
    setShowPlusMenu(false);
    navigate(tab.path);
  };

  const goTo = (path) => {
    setShowCfsMenu(false);
    setShowSharingMenu(false);
    setShowPlusMenu(false);
    navigate(path);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-1 px-3 overflow-x-auto flex-wrap" ref={menuRef}>
          {TABS.map((tab) => (
            <div key={tab.key} className="relative">
              <button
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-1 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {(tab.key === 'cfs' || tab.key === 'shipment-sharing') && <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {tab.key === 'cfs' && showCfsMenu && (
                <div className="absolute left-0 top-full mt-0 w-44 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  {CFS_SUBMENU.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => goTo(item.path)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                        pathname.startsWith(item.path) ? 'text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tab.key === 'shipment-sharing' && showSharingMenu && (
                <div className="absolute left-0 top-full mt-0 w-52 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  {SHARING_SUBMENU.map((item, idx) => (
                    item.section ? (
                      <div key={`sharing-section-${idx}`} className="px-4 pt-2 pb-1 text-xs font-semibold text-blue-700">
                        {item.section}
                      </div>
                    ) : (
                      <button
                        key={item.path}
                        onClick={() => goTo(item.path)}
                        className={`w-full text-left pl-6 pr-4 py-2 text-sm hover:bg-slate-50 ${
                          pathname + search === item.path ? 'text-blue-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* + dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowCfsMenu(false); setShowPlusMenu((prev) => !prev); }}
              className={`flex items-center justify-center gap-1 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isPlusActive
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
              title="More"
            >
              <Plus className="w-4 h-4" />
            </button>

            {showPlusMenu && (
              <div className="absolute left-0 top-full mt-0 w-64 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30 max-h-[80vh] overflow-y-auto">
                {PLUS_MENU.map((item, idx) => (
                  item.section ? (
                    <div key={`section-${idx}`} className="px-4 pt-2 pb-1 text-xs font-semibold text-blue-700">
                      {item.section}
                    </div>
                  ) : (
                    <button
                      key={item.path}
                      onClick={() => goTo(item.path)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                        pathname.startsWith(item.path.split('?')[0]) ? 'text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default OperationsLayout;
