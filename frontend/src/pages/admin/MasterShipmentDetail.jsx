import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { exportCsv } from '../../utils/exportCsv';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save, X, ChevronDown, Pencil, MoreHorizontal, Printer, Trash2, Copy,
  FileSpreadsheet, Link2, RefreshCw, FilePlus, Search, Download,
  Receipt, FileText, FileBarChart, BarChart3, TrendingUp, TrendingDown,
} from 'lucide-react';
import { masterShipmentsAPI, customersAPI, portsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

import {
  SHIPMENT_TYPES, CARGO_TYPES, INCOTERMS, TRANSPORT_MODES,
  SERVICE_MODES, PACK_UNITS, WEIGHT_UNITS, VOLUME_UNITS, CURRENCIES,
  inputClass, labelClass,
} from './houseShipment/constants';

import CarriageTab from './houseShipment/CarriageTab';
import ExtCarrierBookingsTab from './houseShipment/ExtCarrierBookingsTab';
import PartiesTab from './houseShipment/PartiesTab';
import PackagesTab from './houseShipment/PackagesTab';
import RoutingTab from './houseShipment/RoutingTab';
import TermsTab from './houseShipment/TermsTab';
import MasterMilestonesTab from './masterShipment/MasterMilestonesTab';

const MASTER_TABS = [
  'Carriage',
  'Ext. Carrier Bookings',
  'Parties',
  'Packages',
  'Routing',
  'Milestones Tracking',
  'T&C',
];

const MASTER_STATUSES = ['created', 'ext_booked', 'cancelled', 'completed'];
const MASTER_STATUS_LABELS = {
  created: 'Created',
  ext_booked: 'Ext.Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const formatCompact = (n) => {
  const num = parseFloat(n) || 0;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toFixed(2);
};

const emptyForm = {
  transportMode: 'SEA',
  direction: 'EXPORT',
  cargoType: 'FCL',
  serviceType: 'M',
  customerId: '',
  origin: '',
  originCode: '',
  originCountry: '',
  originPortId: '',
  destination: '',
  destinationCode: '',
  destinationCountry: '',
  destinationPortId: '',
  etd: '',
  eta: '',
  atd: '',
  ata: '',
  carrier: '',
  vesselName: '',
  voyageNumber: '',
  flightNumber: '',
  mblNumber: '',
  containerNumbers: [],
  packages: '',
  packUnit: 'PKG',
  grossWeight: '',
  weightUnit: 'kg',
  volume: '',
  volumeUnit: 'm3',
  commodity: '',
  incoterm: '',
  currency: 'AED',
  status: 'created',
  extCarrierBookings: [],
  parties: [],
  packageLines: [],
  routingLegs: [],
  milestones: [],
  termsAndConditions: '',
  remarks: '',
  activityLog: [],
};

const MasterShipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(isNew);
  const [activeTab, setActiveTab] = useState('Carriage');
  const [refreshKey, setRefreshKey] = useState(0);

  const [customers, setCustomers] = useState([]);
  const [ports, setPorts] = useState([]);

  // toolbar menus
  const [showActionMenu, setShowActionMenu] = useState(false);

  // attached houses (for breadcrumb + Attach Houses modal)
  const [attachedHouses, setAttachedHouses] = useState([]);

  // Attach Houses modal
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [availableHouses, setAvailableHouses] = useState([]);
  const [attachSearch, setAttachSearch] = useState('');
  const [selectedHouseIds, setSelectedHouseIds] = useState([]);
  const [attaching, setAttaching] = useState(false);

  // Change Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalValue, setStatusModalValue] = useState('created');

  // Warning modal
  const [showWarningModal, setShowWarningModal] = useState(false);

  // View Profitability modal
  const [showProfitabilityModal, setShowProfitabilityModal] = useState(false);

  const setField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  useEffect(() => {
    customersAPI.getAll({ limit: 200 }).then((res) => setCustomers(res.data?.data || [])).catch(() => {});
    portsAPI.getAll({ limit: 500 }).then((res) => setPorts(res.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      const houseShipmentId = searchParams.get('houseShipmentId') || '';
      setForm({
        ...emptyForm,
        ...(houseShipmentId ? { houseShipmentId } : {}),
        activityLog: [{
          user: user?.name || 'You',
          message: 'Creating a new master shipment...',
          timestamp: new Date().toISOString(),
        }],
      });
      setLoading(false);
      return;
    }

    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await masterShipmentsAPI.getById(id);
        const data = res.data?.data;
        setForm((f) => ({
          ...emptyForm,
          ...data,
          containerNumbers: data.containerNumbers || [],
          extCarrierBookings: data.extCarrierBookings || [],
          parties: data.parties || [],
          packageLines: data.packageLines || [],
          routingLegs: data.routingLegs || [],
          milestones: data.milestones || [],
          activityLog: data.activityLog && data.activityLog.length ? data.activityLog : [{
            user: 'System',
            message: `Master Shipment ${data.masterShipmentNumber} created`,
            timestamp: data.createdAt,
          }],
        }));
      } catch {
        toast.error('Failed to load master shipment');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id, isNew, user, refreshKey, searchParams]);

  // Load attached houses (for breadcrumb)
  useEffect(() => {
    if (isNew) {
      setAttachedHouses([]);
      return;
    }
    masterShipmentsAPI.getHouses(id)
      .then((res) => setAttachedHouses(res.data?.data || []))
      .catch(() => setAttachedHouses([]));
  }, [id, isNew, refreshKey]);

  const handleStatusChange = async (status) => {
    if (isNew) {
      setField('status', status);
      return;
    }
    try {
      await masterShipmentsAPI.updateStatus(id, status);
      setForm((f) => ({ ...f, status }));
      toast.success(`Status updated to ${(MASTER_STATUS_LABELS[status] || status)}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const buildPayload = () => {
    const payload = { ...form };

    ['customerId', 'originPortId', 'destinationPortId'].forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });

    ['grossWeight', 'volume', 'packages'].forEach((k) => {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
      else payload[k] = parseFloat(payload[k]);
    });

    ['etd', 'eta', 'atd', 'ata'].forEach((k) => {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
    });

    delete payload.id;
    delete payload.customer;
    delete payload.originPort;
    delete payload.destinationPort;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.masterShipmentNumber;
    delete payload.createdBy;

    return payload;
  };

  const handleSave = async () => {
    if (!form.transportMode || !form.direction || !form.cargoType) {
      toast.error('Transport Mode, Direction and Cargo Type are required');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await masterShipmentsAPI.create(payload);
        const created = res.data?.data;
        toast.success('Master Shipment created');
        navigate(`/admin/master-shipments/${created.id}`);
      } else {
        await masterShipmentsAPI.update(id, payload);
        toast.success('Master Shipment updated');
        setEditMode(false);
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save master shipment');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (isNew) {
      navigate('/admin/master-shipments');
    } else {
      setEditMode(false);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleDelete = async () => {
    setShowActionMenu(false);
    if (isNew) return;
    if (!window.confirm('Delete this master shipment? This cannot be undone.')) return;
    try {
      await masterShipmentsAPI.delete(id);
      toast.success('Master Shipment deleted');
      navigate('/admin/master-shipments');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete master shipment');
    }
  };

  const handleDuplicate = async () => {
    setShowActionMenu(false);
    if (isNew) return;
    try {
      const payload = buildPayload();
      delete payload.status;
      const res = await masterShipmentsAPI.create(payload);
      const created = res.data?.data;
      toast.success('Master Shipment duplicated');
      navigate(`/admin/master-shipments/${created.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to duplicate master shipment');
    }
  };

  const handleAction = (actionName) => {
    setShowActionMenu(false);
    toast(`${actionName} – coming soon`, { icon: 'ℹ️' });
  };

  const handlePrint = () => {
    toast('Generating print preview...', { icon: '🖨️' });
  };

  const handleCreateHouseShipment = () => {
    if (isNew) {
      toast('Save the master shipment first', { icon: 'ℹ️' });
      return;
    }
    navigate(`/admin/house-shipments/create?masterShipmentId=${id}`);
  };

  // ---- Attach Houses modal ----
  const openAttachModal = async () => {
    if (isNew) {
      toast('Save the master shipment first', { icon: 'ℹ️' });
      return;
    }
    setShowAttachModal(true);
    setSelectedHouseIds(attachedHouses.map((h) => h.id));
    loadAvailableHouses('');
  };

  const loadAvailableHouses = async (search) => {
    try {
      const res = await masterShipmentsAPI.getAvailableHouses(id, search ? { search } : {});
      setAvailableHouses(res.data?.data || []);
    } catch {
      toast.error('Failed to load houses');
    }
  };

  const handleAttachSearchChange = (value) => {
    setAttachSearch(value);
    loadAvailableHouses(value);
  };

  const toggleHouseSelected = (houseId) => {
    setSelectedHouseIds((prev) => (
      prev.includes(houseId) ? prev.filter((x) => x !== houseId) : [...prev, houseId]
    ));
  };

  const handleConfirmAttach = async () => {
    setAttaching(true);
    try {
      const res = await masterShipmentsAPI.attachHouses(id, selectedHouseIds);
      setAttachedHouses(res.data?.data || []);
      toast.success('Houses attached');
      setShowAttachModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to attach houses');
    } finally {
      setAttaching(false);
    }
  };

  // ---- Change Status modal ----
  const openStatusModal = () => {
    if (isNew) {
      toast('Save the master shipment first', { icon: 'ℹ️' });
      return;
    }
    setStatusModalValue(form.status || 'created');
    setShowStatusModal(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!form.serviceType) {
      setShowStatusModal(false);
      setShowWarningModal(true);
      return;
    }
    await handleStatusChange(statusModalValue);
    setShowStatusModal(false);
  };

  // Aggregate revenue across all attached houses
  const revenueSummary = useMemo(() => {
    const totals = attachedHouses.reduce((acc, h) => {
      const rev = h.revenue || {};
      acc.estReceivable += parseFloat(rev.estReceivable) || 0;
      acc.actReceivable += parseFloat(rev.actReceivable) || 0;
      acc.estPayable += parseFloat(rev.estPayable) || 0;
      acc.actPayable += parseFloat(rev.actPayable) || 0;
      acc.estMargin += parseFloat(rev.estMargin) || 0;
      acc.actMargin += parseFloat(rev.actMargin) || 0;
      acc.documents += (h.documents || []).length;
      return acc;
    }, { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0, documents: 0 });

    const estimatedMarginPct = totals.estReceivable !== 0 ? (totals.estMargin / totals.estReceivable) * 100 : 0;
    const receivedMarginPct = totals.actReceivable !== 0 ? (totals.actMargin / totals.actReceivable) * 100 : 0;

    return {
      ...totals,
      estimatedMarginPct,
      receivedMarginPct,
      dueReceivable: totals.estReceivable - totals.actReceivable,
      duePayable: totals.estPayable - totals.actPayable,
      dueMargin: totals.estMargin - totals.actMargin,
    };
  }, [attachedHouses]);

  if (loading) return <PageLoader />;

  const tabComponentProps = { form, setField };

  const breadcrumbHouse = attachedHouses[0];

  const houseStatCards = [
    { key: 'customerCredits', icon: Receipt, label: 'Credit Notes', value: 0 },
    { key: 'debitNotes', icon: Receipt, label: 'Debit Notes', value: 0 },
    { key: 'invoices', icon: FileText, label: 'Invoices', value: 0 },
    { key: 'vendorBills', icon: FileBarChart, label: 'Vendor Bills', value: 0 },
    { key: 'houseRevenue', icon: TrendingUp, label: 'House Revenue', value: `${formatCompact(revenueSummary.estReceivable)} AED (${attachedHouses.length})` },
    { key: 'houseCost', icon: TrendingDown, label: 'House Cost', value: `${formatCompact(revenueSummary.estPayable)} AED (${attachedHouses.length})` },
    { key: 'profitability', icon: BarChart3, label: 'View Profitability', value: '' },
  ];

  // Export the shipments the attach search is currently showing.
  const exportAttachSearch = () => {
    const rows = availableHouses || [];
    if (exportCsv(rows, null, 'attachable-house-shipments')) toast.success(`Exported ${rows.length} rows`);
    else toast.error('Nothing to export');
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleDiscard}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
              >
                <X className="w-4 h-4" /> Discard
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
          >
            <Printer className="w-4 h-4" /> Print
          </button>

          {/* Action dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActionMenu((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
            >
              <MoreHorizontal className="w-4 h-4" /> Action <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showActionMenu && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-30">
                <button onClick={handleDelete} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button onClick={handleDuplicate} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button onClick={() => handleAction('Job Cost Sheet (Excel)')} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <FileSpreadsheet className="w-4 h-4" /> Job Cost Sheet (Excel)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAttachModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
          >
            <Link2 className="w-4 h-4" /> Attach Houses
          </button>
          <button
            onClick={openStatusModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
          >
            <RefreshCw className="w-4 h-4" /> Change Status
          </button>
          <button
            onClick={handleCreateHouseShipment}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
          >
            <FilePlus className="w-4 h-4" /> Create House Shipment
          </button>

          {/* Status stepper */}
          <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden bg-white">
            {MASTER_STATUSES.map((s, idx) => (
              <div
                key={s}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                  form.status === s ? 'bg-blue-700 text-white' : 'text-gray-600'
                } ${idx > 0 ? 'border-l border-gray-300' : ''}`}
              >
                {MASTER_STATUS_LABELS[s]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        {breadcrumbHouse
          ? `House Shipment / ${breadcrumbHouse.hblNumber || breadcrumbHouse.jobNumber} / ${form.masterShipmentNumber || 'New'}`
          : `Master Shipment (Console) / ${isNew ? 'New' : (form.masterShipmentNumber || 'New')}`}
      </div>

      <div className="flex flex-wrap items-start gap-x-12 gap-y-2">
        <div>
          <p className="text-xs text-gray-500">Master Shipment Number</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">{isNew ? 'New' : (form.masterShipmentNumber || 'New')}</p>
        </div>
        {!isNew && form.mblNumber && (
          <div>
            <p className="text-xs text-gray-500">MBL</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{form.mblNumber}</p>
          </div>
        )}
      </div>

      {/* Stat bar */}
      {!isNew && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {houseStatCards.map(({ key, icon: Icon, label, value }) => (
            <button
              key={key}
              type="button"
              onClick={() => key === 'profitability' ? setShowProfitabilityModal(true) : toast('Coming soon', { icon: 'ℹ️' })}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-gray-700 text-center transition-colors cursor-pointer"
            >
              <Icon className="w-4 h-4" />
              {value !== '' && <span className="text-sm font-bold">{value}</span>}
              <span className="text-[10px] leading-tight">{label}</span>
            </button>
          ))}
        </div>
      )}

      {!editMode && (
        <style>{`
          fieldset.view-mode-fieldset input:disabled,
          fieldset.view-mode-fieldset select:disabled,
          fieldset.view-mode-fieldset textarea:disabled {
            border-color: transparent;
            background-color: transparent;
            color: #1f2937;
            -webkit-text-fill-color: #1f2937;
            opacity: 1;
            padding-left: 0;
            cursor: default;
          }
          fieldset.view-mode-fieldset button:disabled {
            opacity: 1;
          }
        `}</style>
      )}

      <fieldset disabled={!editMode} className={editMode ? '' : 'view-mode-fieldset'}>

      {/* General Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Direction</label>
              <select className={inputClass} value={form.direction || ''} onChange={(e) => setField('direction', e.target.value)}>
                {SHIPMENT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cargo Type</label>
              <select className={inputClass} value={form.cargoType || ''} onChange={(e) => setField('cargoType', e.target.value)}>
                {CARGO_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Incoterms</label>
              <select className={inputClass} value={form.incoterm || ''} onChange={(e) => setField('incoterm', e.target.value)}>
                <option value="">-- Select --</option>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Customer</label>
              <select className={inputClass} value={form.customerId || ''} onChange={(e) => setField('customerId', e.target.value)}>
                <option value="">-- Select Customer --</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Transport Mode</label>
              <select className={inputClass} value={form.transportMode || ''} onChange={(e) => setField('transportMode', e.target.value)}>
                {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Service Mode</label>
              <select className={inputClass} value={form.serviceType || ''} onChange={(e) => setField('serviceType', e.target.value)}>
                <option value="">-- Select --</option>
                {SERVICE_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select className={inputClass} value={form.currency || 'AED'} onChange={(e) => setField('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Commodity</label>
              <input type="text" className={inputClass} value={form.commodity || ''} onChange={(e) => setField('commodity', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* MBL / Vessel info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Master Bill / Vessel Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>MBL Number</label>
            <input type="text" className={inputClass} value={form.mblNumber || ''} onChange={(e) => setField('mblNumber', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Carrier</label>
            <input type="text" className={inputClass} value={form.carrier || ''} onChange={(e) => setField('carrier', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Vessel Name</label>
            <input type="text" className={inputClass} value={form.vesselName || ''} onChange={(e) => setField('vesselName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Voyage / Flight No</label>
            <input
              type="text"
              className={inputClass}
              value={form.transportMode === 'AIR' ? (form.flightNumber || '') : (form.voyageNumber || '')}
              onChange={(e) => setField(form.transportMode === 'AIR' ? 'flightNumber' : 'voyageNumber', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Declared Weight & Volume */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Declared Weight & Volume</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Packs</label>
            <div className="flex gap-2">
              <input type="number" className={inputClass} value={form.packages ?? ''} onChange={(e) => setField('packages', e.target.value)} />
              <select className={`${inputClass} w-28`} value={form.packUnit || 'PKG'} onChange={(e) => setField('packUnit', e.target.value)}>
                {PACK_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Gross Weight</label>
            <div className="flex gap-2">
              <input type="number" className={inputClass} value={form.grossWeight ?? ''} onChange={(e) => setField('grossWeight', e.target.value)} />
              <select className={`${inputClass} w-20`} value={form.weightUnit || 'kg'} onChange={(e) => setField('weightUnit', e.target.value)}>
                {WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Volume</label>
            <div className="flex gap-2">
              <input type="number" className={inputClass} value={form.volume ?? ''} onChange={(e) => setField('volume', e.target.value)} />
              <select className={`${inputClass} w-20`} value={form.volumeUnit || 'm3'} onChange={(e) => setField('volumeUnit', e.target.value)}>
                {VOLUME_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4 -mx-6 px-6">
          {MASTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Carriage' && <CarriageTab {...tabComponentProps} ports={ports} />}
        {activeTab === 'Ext. Carrier Bookings' && <ExtCarrierBookingsTab {...tabComponentProps} />}
        {activeTab === 'Parties' && <PartiesTab {...tabComponentProps} />}
        {activeTab === 'Packages' && <PackagesTab {...tabComponentProps} />}
        {activeTab === 'Routing' && <RoutingTab {...tabComponentProps} />}
        {activeTab === 'Milestones Tracking' && <MasterMilestonesTab {...tabComponentProps} />}
        {activeTab === 'T&C' && <TermsTab {...tabComponentProps} />}
      </div>

      </fieldset>

      {/* Shipment Revenue Summary */}
      {!isNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-bold text-gray-900">Shipment Revenue Summary</h2>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <p className="text-xs text-gray-500">Estimated Margin (%)</p>
              <p className="font-semibold text-gray-900">{revenueSummary.estimatedMarginPct.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Received Margin (%)</p>
              <p className="font-semibold text-gray-900">{revenueSummary.receivedMarginPct.toFixed(2)}%</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Expected Amount</th>
                <th className="py-2 pr-2">Invoiced/Billed Amount</th>
                <th className="py-2 pr-2">Due Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50 bg-teal-50">
                <td className="py-2 pr-2 font-medium">Customer Invoice (Receivable)</td>
                <td className="py-2 pr-2">{revenueSummary.estReceivable.toFixed(2)} AED</td>
                <td className="py-2 pr-2">{revenueSummary.actReceivable.toFixed(2)} AED</td>
                <td className="py-2 pr-2">{revenueSummary.dueReceivable.toFixed(2)} AED</td>
              </tr>
              <tr className="border-b border-gray-50 bg-teal-50">
                <td className="py-2 pr-2 font-medium">Vendor Bills (Payable)</td>
                <td className="py-2 pr-2">{revenueSummary.estPayable.toFixed(2)} AED</td>
                <td className="py-2 pr-2">{revenueSummary.actPayable.toFixed(2)} AED</td>
                <td className="py-2 pr-2">{revenueSummary.duePayable.toFixed(2)} AED</td>
              </tr>
              <tr className="bg-teal-50">
                <td className="py-2 pr-2 font-medium">Margin</td>
                <td className="py-2 pr-2">{revenueSummary.estMargin.toFixed(2)} AED</td>
                <td className="py-2 pr-2">{revenueSummary.actMargin.toFixed(2)} AED</td>
                <td className="py-2 pr-2">{revenueSummary.dueMargin.toFixed(2)} AED</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Chatter */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Activity Log</h2>
        <div className="space-y-3">
          {(form.activityLog || []).map((entry, idx) => (
            <div key={idx} className="border-b border-gray-100 pb-2 last:border-0">
              <p className="text-sm text-gray-800">{entry.message}</p>
              <p className="text-xs text-gray-400">{entry.user || 'System'} · {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-GB') : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attach Houses modal */}
      {showAttachModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Select Houses to Attach</h3>
              <button onClick={() => setShowAttachModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Booking Ref or House BL No..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={attachSearch}
                  onChange={(e) => handleAttachSearchChange(e.target.value)}
                />
              </div>
              <button onClick={exportAttachSearch} title="Export these results"
                className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-2 w-8"></th>
                    <th className="py-2 pr-2">Booking Ref / Nomination No</th>
                    <th className="py-2 pr-2">House BL No</th>
                    <th className="py-2 pr-2">Shipment Date</th>
                    <th className="py-2 pr-2">List Containers Count</th>
                    <th className="py-2 pr-2">State</th>
                    <th className="py-2 pr-2">Truck Count</th>
                  </tr>
                </thead>
                <tbody>
                  {availableHouses.map((h) => (
                    <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedHouseIds.includes(h.id)}
                          onChange={() => toggleHouseSelected(h.id)}
                        />
                      </td>
                      <td className="py-2 pr-2 font-mono">{h.jobNumber}</td>
                      <td className="py-2 pr-2 font-mono">{h.hblNumber || '—'}</td>
                      <td className="py-2 pr-2">{h.shipmentDate ? new Date(h.shipmentDate).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="py-2 pr-2">{(h.containerNumbers || []).length}</td>
                      <td className="py-2 pr-2 capitalize">{(h.status || '').replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-2">0</td>
                    </tr>
                  ))}
                  {availableHouses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-400">No house shipments found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowAttachModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAttach}
                disabled={attaching}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {attaching ? 'Attaching...' : 'Attach'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Status modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Change Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2">
              <label className={labelClass}>State</label>
              <div className="relative">
                <select
                  value={statusModalValue}
                  onChange={(e) => setStatusModalValue(e.target.value)}
                  className="appearance-none w-full text-sm font-medium pl-3 pr-8 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MASTER_STATUSES.map((s) => <option key={s} value={s}>{MASTER_STATUS_LABELS[s]}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Warning</h3>
              <button onClick={() => setShowWarningModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">Service Mode is mandatory in House Shipment.Please add it in Master Shipment</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profitability modal */}
      {showProfitabilityModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Profitability</h3>
              <button onClick={() => setShowProfitabilityModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated Revenue</span>
                <span className="font-semibold text-gray-900">{revenueSummary.estReceivable.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated Cost</span>
                <span className="font-semibold text-gray-900">{revenueSummary.estPayable.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500">Estimated Margin</span>
                <span className="font-semibold text-gray-900">{revenueSummary.estMargin.toFixed(2)} AED ({revenueSummary.estimatedMarginPct.toFixed(2)}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Received Revenue</span>
                <span className="font-semibold text-gray-900">{revenueSummary.actReceivable.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Paid Cost</span>
                <span className="font-semibold text-gray-900">{revenueSummary.actPayable.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500">Received Margin</span>
                <span className="font-semibold text-gray-900">{revenueSummary.actMargin.toFixed(2)} AED ({revenueSummary.receivedMarginPct.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowProfitabilityModal(false)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterShipmentDetail;
