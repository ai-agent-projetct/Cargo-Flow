import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import CompaniesList from './CompaniesList';
import CompanyForm from './CompanyForm';
import DepartmentsList from './DepartmentsList';
import DepartmentForm from './DepartmentForm';
import GroupsList from './GroupsList';
import UsersTab from './UsersTab';
import UserDetail from './UserDetail';
import IncotermsList from './IncotermsList';
import SellTariffList from './SellTariffList';
import BuyTariffList from './BuyTariffList';
import TariffForm from './TariffForm';
import CFSTariffList from './CFSTariffList';
import CFSTariffForm from './CFSTariffForm';
import FreightProductList from './FreightProductList';
import FreightProductDetail from './FreightProductDetail';
import UomCategoriesList from './UomCategoriesList';
import TransportModeList from './TransportModeList';
import TransportModeDetail from './TransportModeDetail';
import ShipmentTypeList from './ShipmentTypeList';
import ShipmentTypeDetail from './ShipmentTypeDetail';
import CargoTypeList from './CargoTypeList';
import CargoTypeDetail from './CargoTypeDetail';
import ConsolidationTypeList from './ConsolidationTypeList';
import ConsolidationTypeDetail from './ConsolidationTypeDetail';
import ServiceModeList from './ServiceModeList';
import ServiceModeDetail from './ServiceModeDetail';
import ContainerServiceModeList from './ContainerServiceModeList';
import ContainerServiceModeDetail from './ContainerServiceModeDetail';
import EventTypeList from './EventTypeList';
import EventTypeDetail from './EventTypeDetail';
import EventTypeForm from './EventTypeForm';
import DocumentTypeList from './DocumentTypeList';
import DocumentTypeDetail from './DocumentTypeDetail';
import DocumentTypeForm from './DocumentTypeForm';
import PartyTypeList from './PartyTypeList';
import PartyTypeDetail from './PartyTypeDetail';
import PartyTypeForm from './PartyTypeForm';
import AdjustmentRatioTypeList from './AdjustmentRatioTypeList';
import AdjustmentRatioTypeDetail from './AdjustmentRatioTypeDetail';
import MeasurementBasisList from './MeasurementBasisList';
import MeasurementBasisDetail from './MeasurementBasisDetail';
import FreightShipmentTagList from './FreightShipmentTagList';
import VolumetricDividedValueList from './VolumetricDividedValueList';
import HazClassList from './HazClassList';
import HazSubClassList from './HazSubClassList';
import PackageInfoList from './PackageInfoList';
import DocxReportList from './DocxReportList';
import DocxReportDetail from './DocxReportDetail';
import { DOCX_REPORTS } from './docxReportData';
import JsonSpecList from './JsonSpecList';
import { PRODUCT_JSON_SPECS, FIATA_EBL_JSON_SPECS, CARRIER_BOOKING_JSON_SPECS, TMS_JSON_SPECS } from './jsonSpecData';
import SimpleMasterList from './SimpleMasterList';
import { FREIGHT_MASTERS_SUBMENU } from './freightMastersData';
import GenericMasterList from './GenericMasterList';
import { MANAGE_SUBMENU, MASTER_DATA_CONFIG } from './manageMastersData';
import PlaceholderTab from './PlaceholderTab';

const TABS = [
  { key: 'manage', label: 'Manage' },
  { key: 'companies-users', label: 'Companies & Users' },
  { key: 'tariff', label: 'Tariff' },
  { key: 'cfs-tariff', label: 'CFS Tariff' },
  { key: 'freight-masters', label: 'Freight Masters' },
  { key: 'document-reports', label: 'Document Reports' },
];

const COMPANIES_USERS_SUBMENU = [
  { key: 'companies', label: 'Companies' },
  { key: 'departments', label: 'Departments' },
  { key: 'users', label: 'Users' },
  { key: 'groups', label: 'Groups' },
];

const TARIFF_SUBMENU = [
  { key: 'tariff/sell', label: 'Sell Tariff' },
  { key: 'tariff/buy', label: 'Buy Tariff' },
];

const CFS_TARIFF_SUBMENU = [
  { key: 'cfs-tariff/charges', label: 'Charges Tariff' },
];

const DOCUMENT_REPORTS_SUBMENU = [
  { key: 'document-reports/docx-reports', label: 'Docx Reports' },
];

const AdministrationLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showCompaniesMenu, setShowCompaniesMenu] = useState(false);
  const [showTariffMenu, setShowTariffMenu] = useState(false);
  const [showCfsTariffMenu, setShowCfsTariffMenu] = useState(false);
  const [showFreightMastersMenu, setShowFreightMastersMenu] = useState(false);
  const [showDocumentReportsMenu, setShowDocumentReportsMenu] = useState(false);
  const menuRef = useRef(null);

  // Determine active top-level tab from path
  const path = location.pathname.replace('/admin/administration', '').replace(/^\//, '');
  const segments = path.split('/').filter(Boolean);
  const subPath = segments.join('/');

  let activeTab = 'manage';
  if (segments[0] === 'manage' || segments.length === 0) {
    activeTab = 'manage';
  } else if (segments[0] === 'companies-users' || ['companies', 'departments', 'users', 'groups'].includes(segments[0])) {
    activeTab = 'companies-users';
  } else if (segments[0] === 'tariff' || segments[0] === 'incoterms') {
    activeTab = 'tariff';
  } else if (segments[0] === 'cfs-tariff') {
    activeTab = 'cfs-tariff';
  } else if (segments[0] === 'freight-masters') {
    activeTab = 'freight-masters';
  } else if (segments[0] === 'document-reports') {
    activeTab = 'document-reports';
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowManageMenu(false);
        setShowCompaniesMenu(false);
        setShowTariffMenu(false);
        setShowCfsTariffMenu(false);
        setShowFreightMastersMenu(false);
        setShowDocumentReportsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToTab = (tabKey) => {
    switch (tabKey) {
      case 'manage':
        setShowCompaniesMenu(false);
        setShowTariffMenu(false);
        setShowCfsTariffMenu(false);
        setShowFreightMastersMenu(false);
        setShowDocumentReportsMenu(false);
        setShowManageMenu((prev) => !prev);
        return;
      case 'companies-users':
        setShowManageMenu(false);
        setShowTariffMenu(false);
        setShowCompaniesMenu((prev) => !prev);
        return;
      case 'tariff':
        setShowManageMenu(false);
        setShowCompaniesMenu(false);
        setShowCfsTariffMenu(false);
        setShowFreightMastersMenu(false);
        setShowTariffMenu((prev) => !prev);
        return;
      case 'cfs-tariff':
        setShowManageMenu(false);
        setShowCompaniesMenu(false);
        setShowTariffMenu(false);
        setShowFreightMastersMenu(false);
        setShowCfsTariffMenu((prev) => !prev);
        return;
      case 'freight-masters':
        setShowManageMenu(false);
        setShowCompaniesMenu(false);
        setShowTariffMenu(false);
        setShowCfsTariffMenu(false);
        setShowFreightMastersMenu((prev) => !prev);
        return;
      case 'document-reports':
        setShowManageMenu(false);
        setShowCompaniesMenu(false);
        setShowTariffMenu(false);
        setShowCfsTariffMenu(false);
        setShowFreightMastersMenu(false);
        setShowDocumentReportsMenu((prev) => !prev);
        return;
      default:
        break;
    }
    setShowManageMenu(false);
    setShowCompaniesMenu(false);
    setShowTariffMenu(false);
    setShowCfsTariffMenu(false);
    setShowFreightMastersMenu(false);
    setShowDocumentReportsMenu(false);
  };

  const goToSubPage = (key) => {
    navigate(`/admin/administration/${key}`);
    setShowManageMenu(false);
    setShowCompaniesMenu(false);
    setShowTariffMenu(false);
    setShowCfsTariffMenu(false);
    setShowFreightMastersMenu(false);
    setShowDocumentReportsMenu(false);
  };

  const goToExternal = (path) => {
    navigate(path);
    setShowManageMenu(false);
    setShowCompaniesMenu(false);
    setShowTariffMenu(false);
    setShowCfsTariffMenu(false);
    setShowFreightMastersMenu(false);
    setShowDocumentReportsMenu(false);
  };

  // Breadcrumb
  let breadcrumb = 'Manage';
  if (activeTab === 'manage') {
    if (segments[0] === 'manage' && segments[1]) {
      const config = MASTER_DATA_CONFIG[segments[1]];
      breadcrumb = config ? `Manage / ${config.title}` : 'Manage';
    } else {
      breadcrumb = 'Manage';
    }
  } else if (activeTab === 'companies-users') {
    if (segments[0] === 'companies') {
      if (segments[1] === 'create') breadcrumb = 'Companies / New';
      else if (segments[1]) breadcrumb = 'Companies / Edit';
      else breadcrumb = 'Companies';
    } else if (segments[0] === 'departments') {
      if (segments[1] === 'create') breadcrumb = 'Departments / New';
      else if (segments[1]) breadcrumb = 'Departments / Edit';
      else breadcrumb = 'Departments';
    }
    else if (segments[0] === 'users') breadcrumb = segments[1] ? 'Users / Edit' : 'Users';
    else if (segments[0] === 'groups') breadcrumb = 'Groups';
  } else if (activeTab === 'tariff') {
    if (segments[1] === 'sell') {
      if (segments[2] === 'create') breadcrumb = 'Sell Tariff / New';
      else if (segments[2]) breadcrumb = 'Sell Tariff / Edit';
      else breadcrumb = 'Sell Tariff';
    } else if (segments[1] === 'buy') {
      if (segments[2] === 'create') breadcrumb = 'Buy Tariff / New';
      else if (segments[2]) breadcrumb = 'Buy Tariff / Edit';
      else breadcrumb = 'Buy Tariff';
    } else if (segments[1] === 'incoterms' || !segments[1]) {
      breadcrumb = 'Incoterms';
    }
  } else if (activeTab === 'cfs-tariff') {
    if (segments[1] === 'charges') {
      if (segments[2] === 'create') breadcrumb = 'CFS Tariff Charges / New';
      else if (segments[2]) breadcrumb = 'CFS Tariff Charges / Edit';
      else breadcrumb = 'CFS Tariff Charges';
    } else {
      breadcrumb = 'CFS Tariff Charges';
    }
  } else if (activeTab === 'freight-masters') {
    const fmKey = `freight-masters/${segments[1] || 'freight-product'}`;
    const FM_BREADCRUMB_OVERRIDES = {
      'freight-masters/unit-of-measures': 'Units of Measure Categories',
      'freight-masters/product-json-specifications': 'Product Json Specification',
      'freight-masters/fiata-ebl-json-specifications': 'FIATA eBL Json Spec',
      'freight-masters/carrier-booking-json-specifications': 'Carrier Booking Json Spec',
      'freight-masters/tms-json-specifications': 'TMS Json Spec',
      'freight-masters/transport-modes': 'Transport Mode',
      'freight-masters/shipment-types': 'Shipment Type',
      'freight-masters/cargo-types': 'Cargo Type',
      'freight-masters/consolidation-types': 'Consolidation Type',
      'freight-masters/service-modes': 'Service Mode',
      'freight-masters/container-service-modes': 'Container Service Mode',
      'freight-masters/event-types': 'Event Type',
      'freight-masters/document-types': 'Document Type',
      'freight-masters/party-type': 'Party Type',
      'freight-masters/adjustment-ratio-type': 'Adjustment Ratio Type',
      'freight-masters/measurement-basis': 'Measurement Basis',
      'freight-masters/freight-shipment-tag': 'Freight Shipment Tag',
      'freight-masters/volumetric-divided-value': 'Volumetric Divided Value',
      'freight-masters/haz-class': 'HAZ Class',
      'freight-masters/haz-sub-class': 'HAZ Sub Class',
      'freight-masters/package-info': 'Package Info',
    };
    if (FM_BREADCRUMB_OVERRIDES[fmKey]) {
      breadcrumb = FM_BREADCRUMB_OVERRIDES[fmKey];
    } else {
      const fmItem = FREIGHT_MASTERS_SUBMENU.find((m) => m.key === fmKey);
      breadcrumb = fmItem ? fmItem.label : 'Freight Product';
    }
  } else if (activeTab === 'document-reports') {
    if (segments[1] === 'docx-reports') {
      if (segments[2]) {
        const idx = Math.max(0, Math.min(DOCX_REPORTS.length - 1, parseInt(segments[2], 10) || 0));
        breadcrumb = `Docx Report Template / ${DOCX_REPORTS[idx].name}`;
      } else {
        breadcrumb = 'Docx Report Template';
      }
    } else {
      breadcrumb = 'Docx Report Template';
    }
  } else {
    breadcrumb = 'Manage';
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900">Administration</h1>
        </div>

        {/* Tab row */}
        <div className="flex items-center gap-1 px-3 overflow-visible flex-wrap" ref={menuRef}>
          {TABS.map((tab) => (
            <div key={tab.key} className="relative">
              <button
                onClick={() => goToTab(tab.key)}
                className={`flex items-center gap-1 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {(tab.key === 'manage' || tab.key === 'companies-users' || tab.key === 'tariff' || tab.key === 'cfs-tariff' || tab.key === 'freight-masters' || tab.key === 'document-reports') && <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {tab.key === 'manage' && showManageMenu && (
                <div className="absolute left-0 top-full mt-0 w-64 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30 max-h-[80vh] overflow-y-auto">
                  {MANAGE_SUBMENU.map((item) => (
                    item.section ? (
                      <div key={item.key} className="px-4 pt-2 pb-1 text-xs font-semibold text-primary-600">
                        {item.label}
                      </div>
                    ) : item.external ? (
                      <button
                        key={item.key}
                        onClick={() => goToExternal(item.external)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${item.indent ? 'pl-6' : ''} text-slate-700`}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <button
                        key={item.key}
                        onClick={() => goToSubPage(item.key)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${item.indent ? 'pl-6' : ''} ${
                          subPath === item.key ? 'text-primary-600 font-medium' : 'text-slate-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  ))}
                </div>
              )}

              {tab.key === 'companies-users' && showCompaniesMenu && (
                <div className="absolute left-0 top-full mt-0 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  {COMPANIES_USERS_SUBMENU.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => goToSubPage(item.key)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                        segments[0] === item.key ? 'text-primary-600 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tab.key === 'tariff' && showTariffMenu && (
                <div className="absolute left-0 top-full mt-0 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  {TARIFF_SUBMENU.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => goToSubPage(item.key)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                        subPath.startsWith(item.key) ? 'text-primary-600 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tab.key === 'cfs-tariff' && showCfsTariffMenu && (
                <div className="absolute left-0 top-full mt-0 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  {CFS_TARIFF_SUBMENU.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => goToSubPage(item.key)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                        subPath.startsWith(item.key) ? 'text-primary-600 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tab.key === 'document-reports' && showDocumentReportsMenu && (
                <div className="absolute left-0 top-full mt-0 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  {DOCUMENT_REPORTS_SUBMENU.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => goToSubPage(item.key)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                        subPath.startsWith(item.key) ? 'text-primary-600 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tab.key === 'freight-masters' && showFreightMastersMenu && (
                <div className="absolute left-0 top-full mt-0 w-64 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30 max-h-[80vh] overflow-y-auto">
                  {FREIGHT_MASTERS_SUBMENU.map((item) => (
                    item.section ? (
                      <div key={item.key} className="px-4 pt-2 pb-1 text-xs font-semibold text-primary-600">
                        {item.label}
                      </div>
                    ) : (
                      <button
                        key={item.key}
                        onClick={() => goToSubPage(item.key)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${item.indent ? 'pl-6' : ''} ${
                          subPath.startsWith(item.key) ? 'text-primary-600 font-medium' : 'text-slate-700'
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
        </div>

        {/* Breadcrumb */}
        <div className="px-5 py-2 text-xs text-slate-500 border-t border-slate-100">
          {breadcrumb}
        </div>
      </div>

      {/* Content */}
      <Routes>
        <Route index element={<PlaceholderTab title="Manage" />} />
        <Route path="manage/:category" element={<GenericMasterList />} />
        <Route path="companies" element={<CompaniesList />} />
        <Route path="companies/create" element={<CompanyForm />} />
        <Route path="companies/:id" element={<CompanyForm />} />
        <Route path="departments" element={<DepartmentsList />} />
        <Route path="departments/create" element={<DepartmentForm />} />
        <Route path="departments/:id" element={<DepartmentForm />} />
        <Route path="users" element={<UsersTab />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="groups" element={<GroupsList />} />

        {/* Tariff */}
        <Route path="tariff" element={<SellTariffList />} />
        <Route path="tariff/incoterms" element={<IncotermsList />} />
        <Route path="tariff/sell" element={<SellTariffList />} />
        <Route path="tariff/sell/create" element={<TariffForm tariffType="sell" basePath="/admin/administration/tariff/sell" />} />
        <Route path="tariff/sell/:id" element={<TariffForm tariffType="sell" basePath="/admin/administration/tariff/sell" />} />
        <Route path="tariff/buy" element={<BuyTariffList />} />
        <Route path="tariff/buy/create" element={<TariffForm tariffType="buy" basePath="/admin/administration/tariff/buy" />} />
        <Route path="tariff/buy/:id" element={<TariffForm tariffType="buy" basePath="/admin/administration/tariff/buy" />} />

        {/* CFS Tariff */}
        <Route path="cfs-tariff" element={<Navigate to="/admin/administration/cfs-tariff/charges" replace />} />
        <Route path="cfs-tariff/charges" element={<CFSTariffList />} />
        <Route path="cfs-tariff/charges/create" element={<CFSTariffForm />} />
        <Route path="cfs-tariff/charges/:id" element={<CFSTariffForm />} />

        {/* Freight Masters */}
        <Route path="freight-masters" element={<Navigate to="/admin/administration/freight-masters/freight-product" replace />} />
        <Route path="freight-masters/freight-product" element={<FreightProductList />} />
        <Route path="freight-masters/freight-product/:id" element={<FreightProductDetail />} />
        <Route path="freight-masters/unit-of-measures" element={<UomCategoriesList />} />
        <Route path="freight-masters/transport-modes" element={<TransportModeList />} />
        <Route path="freight-masters/transport-modes/:id" element={<TransportModeDetail />} />
        <Route path="freight-masters/shipment-types" element={<ShipmentTypeList />} />
        <Route path="freight-masters/shipment-types/:id" element={<ShipmentTypeDetail />} />
        <Route path="freight-masters/cargo-types" element={<CargoTypeList />} />
        <Route path="freight-masters/cargo-types/:id" element={<CargoTypeDetail />} />
        <Route path="freight-masters/consolidation-types" element={<ConsolidationTypeList />} />
        <Route path="freight-masters/consolidation-types/:id" element={<ConsolidationTypeDetail />} />
        <Route path="freight-masters/service-modes" element={<ServiceModeList />} />
        <Route path="freight-masters/service-modes/:id" element={<ServiceModeDetail />} />
        <Route path="freight-masters/container-service-modes" element={<ContainerServiceModeList />} />
        <Route path="freight-masters/container-service-modes/:id" element={<ContainerServiceModeDetail />} />
        <Route path="freight-masters/event-types" element={<EventTypeList />} />
        <Route path="freight-masters/event-types/new" element={<EventTypeForm />} />
        <Route path="freight-masters/event-types/:id/edit" element={<EventTypeForm />} />
        <Route path="freight-masters/event-types/:id" element={<EventTypeDetail />} />
        <Route path="freight-masters/document-types" element={<DocumentTypeList />} />
        <Route path="freight-masters/document-types/new" element={<DocumentTypeForm />} />
        <Route path="freight-masters/document-types/:id/edit" element={<DocumentTypeForm />} />
        <Route path="freight-masters/document-types/:id" element={<DocumentTypeDetail />} />
        <Route path="freight-masters/party-type" element={<PartyTypeList />} />
        <Route path="freight-masters/party-type/new" element={<PartyTypeForm />} />
        <Route path="freight-masters/party-type/:id/edit" element={<PartyTypeForm />} />
        <Route path="freight-masters/party-type/:id" element={<PartyTypeDetail />} />
        <Route path="freight-masters/adjustment-ratio-type" element={<AdjustmentRatioTypeList />} />
        <Route path="freight-masters/adjustment-ratio-type/:id" element={<AdjustmentRatioTypeDetail />} />
        <Route path="freight-masters/measurement-basis" element={<MeasurementBasisList />} />
        <Route path="freight-masters/measurement-basis/:id" element={<MeasurementBasisDetail />} />
        <Route path="freight-masters/freight-shipment-tag" element={<FreightShipmentTagList />} />
        <Route path="freight-masters/volumetric-divided-value" element={<VolumetricDividedValueList />} />
        <Route path="freight-masters/haz-class" element={<HazClassList />} />
        <Route path="freight-masters/haz-sub-class" element={<HazSubClassList />} />
        <Route path="freight-masters/package-info" element={<PackageInfoList />} />
        <Route path="freight-masters/product-json-specifications" element={<JsonSpecList data={PRODUCT_JSON_SPECS} />} />
        <Route path="freight-masters/fiata-ebl-json-specifications" element={<JsonSpecList data={FIATA_EBL_JSON_SPECS} />} />
        <Route path="freight-masters/carrier-booking-json-specifications" element={<JsonSpecList data={CARRIER_BOOKING_JSON_SPECS} />} />
        <Route path="freight-masters/tms-json-specifications" element={<JsonSpecList data={TMS_JSON_SPECS} />} />
        <Route path="freight-masters/*" element={<SimpleMasterList />} />

        <Route path="document-reports" element={<Navigate to="/admin/administration/document-reports/docx-reports" replace />} />
        <Route path="document-reports/docx-reports" element={<DocxReportList />} />
        <Route path="document-reports/docx-reports/:id" element={<DocxReportDetail />} />
      </Routes>
    </div>
  );
};

export default AdministrationLayout;
