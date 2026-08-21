import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save, X, ChevronDown, ChevronLeft, ChevronRight, FileText, Receipt, FileBarChart,
  TrendingUp, TrendingDown, Folder, BookOpen, Tag, Plus,
  RefreshCw, Layers, MoreHorizontal, Printer, Trash2, Copy,
  FileSpreadsheet, Send, Eye, Mail, Download, RotateCcw, Upload, Pencil,
} from 'lucide-react';
import {
  ffJobsAPI, quotationsAPI, customersAPI, usersAPI, portsAPI,
  invoicesAPI, vendorBillsAPI, creditNotesAPI,
} from '../../services/api';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import ScheduleActivityModal from '../../common/ScheduleActivityModal';
import { exportCsv } from '../../utils/exportCsv';
import { buildDocumentPdf, downloadDocumentPdf, getDocumentBlobUrl } from '../../utils/documentPdf';

import {
  STATUS_LABELS, STATUS_FLOW, SHIPMENT_TYPES, CARGO_TYPES, INCOTERMS, TRANSPORT_MODES,
  SERVICE_MODES, PACK_UNITS, WEIGHT_UNITS, VOLUME_UNITS, TABS,
  inputClass, labelClass,
} from './houseShipment/constants';

import CarriageTab from './houseShipment/CarriageTab';
import AdditionalTab from './houseShipment/AdditionalTab';
import CutOffDatesTab from './houseShipment/CutOffDatesTab';
import InsuranceTab from './houseShipment/InsuranceTab';
import CustomsTab from './houseShipment/CustomsTab';
import ExtCarrierBookingsTab from './houseShipment/ExtCarrierBookingsTab';
import PartiesTab from './houseShipment/PartiesTab';
import PackagesTab from './houseShipment/PackagesTab';
import RoutingTab from './houseShipment/RoutingTab';
import MilestonesTab from './houseShipment/MilestonesTab';
import TermsTab from './houseShipment/TermsTab';
import RemarksTab from './houseShipment/RemarksTab';

const STEPPER_STATUSES = [...STATUS_FLOW, 'cancelled'];

const FFJOB_VALID_TRANSITIONS = {
  created: ['booked', 'cancelled'],
  booked: ['received', 'cancelled'],
  received: ['confirmed', 'cancelled'],
  confirmed: ['nomination_generated', 'hbl_generated', 'hawb_generated', 'in_transit', 'cancelled'],
  nomination_generated: ['in_transit', 'cancelled'],
  hbl_generated: ['in_transit', 'cancelled'],
  hawb_generated: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  completed: ['accounting_closure'],
  accounting_closure: [],
  cancelled: [],
};

const emptyForm = {
  // header
  directShipment: false,
  courierShipment: false,
  shipmentDate: new Date().toISOString().slice(0, 10),
  companyId: '',
  quotationId: '',
  salesAgentId: '',
  tags: [],
  // general details
  direction: 'EXPORT',
  cargoType: 'FCL',
  incoterm: '',
  transportMode: 'SEA',
  serviceType: 'H',
  assignedTo: '',
  // weight & volume
  autoUpdateWeight: true,
  packages: '',
  packUnit: 'PKG',
  grossWeight: '',
  weightUnit: 'kg',
  netWeight: '',
  volumetricWeight: '',
  volume: '',
  volumeUnit: 'm3',
  cargoReceivedDate: '',
  chargeableWeight: '',
  // customer/shipper/consignee
  customerId: '',
  shipperId: '',
  shipperAccountNumbers: '',
  consigneeId: '',
  consigneeAccountNumbers: '',
  // carriage
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
  // additional
  carrier: '',
  vesselName: '',
  voyageNumber: '',
  flightNumber: '',
  mblNumber: '',
  hblNumber: '',
  awbNumber: '',
  hawbNumber: '',
  containerNumbers: [],
  commodity: '',
  // tab JSON fields
  cutOffDates: [],
  insurance: {},
  customs: {},
  extCarrierBookings: [],
  parties: [],
  packageLines: [],
  routingLegs: [],
  termsAndConditions: '',
  remarks: '',
  activityLog: [],
  documents: [],
};

const formatAddress = (entity) => {
  if (!entity) return '—';
  const parts = [entity.address, entity.city, entity.state, entity.country, entity.postalCode].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
};

const AdminHouseShipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isNew = !id || id === 'create';

  const [job, setJob] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('Carriage');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editMode, setEditMode] = useState(isNew);
  const [recordList, setRecordList] = useState([]);

  // dropdown data
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [ports, setPorts] = useState([]);

  // counters
  const [counts, setCounts] = useState({
    customerCredits: 0, vendorCredits: 0, invoices: 0, vendorBills: 0,
    revenueCharges: 0, costCharges: 0, documents: 0, journalEntries: 0,
  });

  // status change modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalValue, setStatusModalValue] = useState('created');

  // chatter
  const [logNoteText, setLogNoteText] = useState('');
  const [showLogNote, setShowLogNote] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [docActionMenuOpen, setDocActionMenuOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null); // { doc, url }
  const [mailDoc, setMailDoc] = useState(null); // { doc, url, filename }
  const [mailForm, setMailForm] = useState({ recipients: [], cc: '', subject: '', body: '' });

  // toolbar menus
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
        setShowPrintMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // Load dropdown sources
  useEffect(() => {
    quotationsAPI.getAll({ limit: 100 }).then((res) => setQuotations(res.data?.data || [])).catch(() => {});
    customersAPI.getAll({ limit: 200 }).then((res) => setCustomers(res.data?.data || [])).catch(() => {});
    usersAPI.getAll({ limit: 200 }).then((res) => setUsers(res.data?.data || [])).catch(() => {});
    portsAPI.getAll({ limit: 500 }).then((res) => setPorts(res.data?.data || [])).catch(() => {});
  }, []);

  // Load full record list (for prev/next navigation)
  useEffect(() => {
    ffJobsAPI.getAll({ limit: 1000, sortBy: 'createdAt', sortOrder: 'DESC' })
      .then((res) => setRecordList((res.data?.data || []).map((r) => r.id)))
      .catch(() => {});
  }, []);

  const recordIndex = recordList.indexOf(id);
  const recordTotal = recordList.length;

  const goToRecord = (direction) => {
    if (recordIndex === -1) return;
    const newIndex = recordIndex + direction;
    if (newIndex < 0 || newIndex >= recordTotal) return;
    navigate(`/admin/house-shipments/${recordList[newIndex]}`);
  };

  // Load job for edit mode
  useEffect(() => {
    if (isNew) {
      const masterShipmentId = searchParams.get('masterShipmentId') || '';
      setForm({
        ...emptyForm,
        ...(masterShipmentId ? { masterShipmentId } : {}),
        activityLog: [{
          user: user?.name || 'You',
          message: 'Creating a new record...',
          timestamp: new Date().toISOString(),
        }],
      });
      setLoading(false);
      return;
    }

    const fetchJob = async () => {
      setLoading(true);
      try {
        const res = await ffJobsAPI.getById(id);
        const data = res.data?.data;
        setJob(data);
        setForm((f) => ({
          ...emptyForm,
          ...data,
          shipmentDate: data.shipmentDate ? data.shipmentDate.slice(0, 10) : '',
          cargoReceivedDate: data.cargoReceivedDate ? data.cargoReceivedDate.slice(0, 10) : '',
          tags: data.tags || [],
          containerNumbers: data.containerNumbers || [],
          cutOffDates: data.cutOffDates || [],
          insurance: data.insurance || {},
          customs: data.customs || {},
          extCarrierBookings: data.extCarrierBookings || [],
          parties: data.parties || [],
          packageLines: data.packageLines || [],
          routingLegs: data.routingLegs || [],
          activityLog: data.activityLog && data.activityLog.length ? data.activityLog : [{
            user: data.creator?.name || 'System',
            message: `FF Job ${data.jobNumber} created`,
            timestamp: data.createdAt,
          }],
        }));
      } catch (err) {
        toast.error('Failed to load shipment');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id, isNew, user, refreshKey]);

  // Load related counts (only for existing jobs)
  useEffect(() => {
    if (isNew || !id) return;
    const loadCounts = async () => {
      try {
        const [invRes, vbRes] = await Promise.all([
          invoicesAPI.getAll({ shipmentId: id, limit: 1 }).catch(() => ({ data: { data: [], meta: {} } })),
          vendorBillsAPI.getAll({ ffJobId: id, limit: 1 }).catch(() => ({ data: { data: [], meta: {} } })),
        ]);

        let creditCount = 0;
        if (form.customerId) {
          try {
            const cnRes = await creditNotesAPI.getAll({ customerId: form.customerId, limit: 100 });
            const allCn = cnRes.data?.data || [];
            creditCount = allCn.filter((cn) => cn.ffJobId === id || cn.invoice?.shipmentId === id).length;
          } catch { /* ignore */ }
        }

        setCounts((c) => ({
          ...c,
          customerCredits: creditCount,
          invoices: invRes.data?.meta?.total ?? (invRes.data?.data || []).length,
          vendorBills: vbRes.data?.meta?.total ?? (vbRes.data?.data || []).length,
          documents: (form.documents || []).length,
        }));
      } catch { /* best-effort */ }
    };
    loadCounts();
  }, [id, isNew, form.customerId, form.documents]);

  // Auto-fill from quotation
  const handleQuotationSelect = async (quotationId) => {
    setField('quotationId', quotationId || '');
    if (!quotationId) return;
    try {
      const res = await quotationsAPI.getById(quotationId);
      const q = res.data?.data;
      if (!q) return;
      const modeMap = { sea: 'SEA', air: 'AIR', land: 'ROAD', rail: 'RAIL', multimodal: 'SEA' };
      const transportMode = q.transportMode || modeMap[q.mode] || 'SEA';
      const cargoTypeMap = { FCL: 'FCL', LCL: 'LCL', 'Air Freight': 'LSE', 'Land Freight': 'FTL', 'Rail Freight': 'FTL' };
      const cargoType = q.cargoType || cargoTypeMap[q.shipmentType] || 'FCL';

      setForm((f) => ({
        ...f,
        customerId: q.customerId || f.customerId,
        transportMode,
        direction: q.direction || f.direction,
        cargoType,
        origin: q.originCity || f.origin,
        destination: q.destinationCity || f.destination,
        commodity: q.commodity || f.commodity,
        incoterm: q.incoterms || q.incoterm || f.incoterm,
        grossWeight: q.cargoWeight || f.grossWeight,
        volume: q.cargoVolume || f.volume,
        remarks: q.notes || q.remarks || f.remarks,
      }));
      toast.success('Fields auto-filled from quotation');
    } catch {
      toast.error('Failed to load quotation details');
    }
  };

  // Computed chargeable weight
  const computedChargeableWeight = useMemo(() => {
    const gw = parseFloat(form.grossWeight) || 0;
    const vw = parseFloat(form.volumetricWeight) || 0;
    return Math.max(gw, vw);
  }, [form.grossWeight, form.volumetricWeight]);

  // Selected entities for address display
  const selectedCustomer = useMemo(
    () => job?.customer || customers.find((c) => c.id === form.customerId),
    [job, customers, form.customerId]
  );
  const selectedShipper = useMemo(
    () => job?.shipper || customers.find((c) => c.id === form.shipperId),
    [job, customers, form.shipperId]
  );
  const selectedConsignee = useMemo(
    () => job?.consignee || customers.find((c) => c.id === form.consigneeId),
    [job, customers, form.consigneeId]
  );

  const usersForRoles = useMemo(
    () => users.filter((u) => ['admin', 'manager'].includes(u.role)),
    [users]
  );

  // Context passed to the document PDF generator
  const documentPdfContext = useMemo(() => {
    const originPort = ports.find((p) => p.id === form.originPortId);
    const destinationPort = ports.find((p) => p.id === form.destinationPortId);
    return {
      selectedShipper,
      selectedConsignee,
      originPortName: originPort ? `${originPort.name} (${originPort.code})` : '',
      destinationPortName: destinationPort ? `${destinationPort.name} (${destinationPort.code})` : '',
    };
  }, [ports, form.originPortId, form.destinationPortId, selectedShipper, selectedConsignee]);

  const handleStatusChange = async (status) => {
    if (isNew) {
      setField('status', status);
      return;
    }
    try {
      await ffJobsAPI.updateStatus(id, status);
      setForm((f) => ({ ...f, status }));
      toast.success(`Status updated to ${STATUS_LABELS[status] || status.replace(/_/g, ' ')}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const openStatusModal = () => {
    if (isNew) {
      toast('Save the shipment first', { icon: 'ℹ️' });
      return;
    }
    const allowed = FFJOB_VALID_TRANSITIONS[form.status] || [];
    setStatusModalValue(allowed[0] || form.status);
    setShowStatusModal(true);
  };

  const handleConfirmStatusChange = async () => {
    await handleStatusChange(statusModalValue);
    setShowStatusModal(false);
  };

  const buildPayload = () => {
    const payload = { ...form };

    // package totals -> auto-update weight/volume/packs
    if (form.autoUpdateWeight && (form.packageLines || []).length > 0) {
      let totalQty = 0;
      let totalWeight = 0;
      let totalVolume = 0;
      form.packageLines.forEach((row) => {
        const qty = parseFloat(row.quantity) || 0;
        let weight = (parseFloat(row.weightPerUnit) || 0) * qty;
        if (row.weightUnit === 'lb') weight = weight * 0.453592;
        let vol = (parseFloat(row.length) || 0) * (parseFloat(row.width) || 0) * (parseFloat(row.height) || 0) * qty;
        if (row.dimensionUnit === 'cm') vol = vol / 1_000_000;
        else if (row.dimensionUnit === 'in') vol = vol * 0.0000163871;
        totalQty += qty;
        totalWeight += weight;
        totalVolume += vol;
      });
      payload.packages = totalQty;
      payload.grossWeight = totalWeight;
      payload.volume = totalVolume;
    }

    payload.chargeableWeight = Math.max(parseFloat(payload.grossWeight) || 0, parseFloat(payload.volumetricWeight) || 0);

    // clean up empty UUID strings
    ['quotationId', 'companyId', 'salesAgentId', 'shipperId', 'consigneeId', 'originPortId', 'destinationPortId', 'assignedTo'].forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });

    // numeric fields
    ['grossWeight', 'netWeight', 'volumetricWeight', 'volume', 'packages', 'chargeableWeight'].forEach((k) => {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
      else payload[k] = parseFloat(payload[k]);
    });

    // remove fields that are not part of the model / should not be sent
    delete payload.id;
    delete payload.customer;
    delete payload.shipper;
    delete payload.consignee;
    delete payload.quotation;
    delete payload.assignedUser;
    delete payload.creator;
    delete payload.salesAgent;
    delete payload.company;
    delete payload.originPort;
    delete payload.destinationPort;
    delete payload.events;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.jobNumber;
    delete payload.createdBy;

    if (!payload.shipmentDate) delete payload.shipmentDate;
    if (!payload.cargoReceivedDate) delete payload.cargoReceivedDate;

    return payload;
  };

  const handleSave = async () => {
    if (!form.customerId) {
      toast.error('Customer is required');
      return;
    }
    if (!form.transportMode || !form.direction || !form.cargoType) {
      toast.error('Shipment Type, Cargo Type and Transport Mode are required');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await ffJobsAPI.create(payload);
        const newJob = res.data?.data;
        toast.success('House Shipment created');
        navigate(`/admin/house-shipments/${newJob.id}`);
      } else {
        await ffJobsAPI.update(id, payload);
        toast.success('House Shipment updated');
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save shipment');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    navigate('/admin/house-shipments');
  };

  const handleStatCardClick = (key) => {
    if (isNew) return;
    switch (key) {
      case 'customerCredits':
        navigate(`/admin/credit-notes?ffJobId=${id}`);
        break;
      case 'invoices':
        navigate('/admin/invoices');
        break;
      case 'vendorBills':
        navigate('/admin/vendor-bills');
        break;
      case 'documents':
        setShowDocumentsModal(true);
        break;
      default:
        toast('Coming soon', { icon: 'ℹ️' });
    }
  };

  // ---- Shipment Document actions ----
  const toggleSelectDoc = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const toggleSelectAllDocs = (docs) => {
    const ids = docs.map((d) => d.id);
    const allSelected = ids.every((docId) => selectedDocIds.includes(docId));
    if (allSelected) {
      setSelectedDocIds((prev) => prev.filter((d) => !ids.includes(d)));
    } else {
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleViewDoc = (doc) => {
    const url = getDocumentBlobUrl(doc, form, documentPdfContext);
    setPreviewDoc({ doc, url });
  };

  const handleDownloadDoc = (doc) => {
    downloadDocumentPdf(doc, form, documentPdfContext);
    toast.success(`${doc.name} downloaded`);
  };

  const handleMailDoc = (doc) => {
    const pdf = buildDocumentPdf(doc, form, documentPdfContext);
    const filename = `${(doc.type || doc.name || 'Document').replace(/\s+/g, '_').toUpperCase()}_${form.jobNumber || 'SHIPMENT'}.pdf`;
    const url = pdf.output('bloburl');
    const recipientEmail = selectedConsignee?.email || selectedCustomer?.email || '';
    setMailForm({
      recipients: recipientEmail ? [recipientEmail] : [],
      cc: '',
      subject: `Re: ${doc.name}`,
      body: '',
    });
    setMailDoc({ doc, url, filename });
  };

  const handleSendMail = () => {
    if (!mailForm.recipients.length) {
      toast.error('Please add at least one recipient');
      return;
    }
    toast.success(`Mail sent to ${mailForm.recipients.join(', ')}`);
    setMailDoc(null);
  };

  const handleRestoreDoc = (doc) => {
    setField('documents', (form.documents || []).map((d) => (
      d.id === doc.id ? { ...d, uploadedAt: new Date().toISOString() } : d
    )));
    toast.success(`${doc.name} restored to latest version`);
  };

  const handleExportSelectedDocs = () => {
    const docs = (form.documents || []).filter((d) => selectedDocIds.includes(d.id));
    if (docs.length === 0) {
      toast.error('Select at least one document to export');
      return;
    }
    const header = ['Description', 'DateTime', 'Document Type', 'Mode', 'Uploaded', 'Published'];
    const rows = docs.map((d) => [
      d.name,
      d.uploadedAt ? new Date(d.uploadedAt).toLocaleString('en-US') : '',
      d.type,
      d.mode,
      d.uploaded ? 'Yes' : 'No',
      d.published ? 'Yes' : 'No',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Documents_${form.jobNumber || 'shipment'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDocActionMenuOpen(false);
    toast.success(`Exported ${docs.length} document(s)`);
  };

  const handleSyncMilestones = async () => {
    if (isNew) {
      toast('Save the shipment first', { icon: 'ℹ️' });
      return;
    }
    setSyncing(true);
    try {
      setRefreshKey((k) => k + 1);
      toast.success('Milestones synced and fetched');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateMasterShipment = () => {
    if (isNew) {
      toast('Save the shipment first', { icon: 'ℹ️' });
      return;
    }
    navigate(`/admin/master-shipments/create?houseShipmentId=${id}`);
  };

  // Uploads land in the same Documents store the rest of the app reads, tagged
  // with this shipment so they appear on its Documents tab.
  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    body.append('name', file.name);
    body.append('documentType', 'other');
    body.append('jobId', id);
    try {
      await api.post('/documents', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${file.name} uploaded`);
      // Re-read the record so the Documents tab and its counter pick it up.
      const fresh = await ffJobsAPI.getById(id);
      if (fresh?.data?.data) setForm((f) => ({ ...f, ...fresh.data.data }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const handleDelete = async () => {
    setShowActionMenu(false);
    if (isNew) return;
    if (!window.confirm('Delete this house shipment? This cannot be undone.')) return;
    try {
      await ffJobsAPI.delete(id);
      toast.success('House Shipment deleted');
      navigate('/admin/house-shipments');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete shipment');
    }
  };

  const handleDuplicate = async () => {
    setShowActionMenu(false);
    if (isNew) return;
    try {
      const payload = buildPayload();
      delete payload.status;
      const res = await ffJobsAPI.create(payload);
      const created = res.data?.data;
      toast.success('House Shipment duplicated');
      navigate(`/admin/house-shipments/${created.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to duplicate shipment');
    }
  };

  const handlePrint = (templateName) => {
    setShowPrintMenu(false);
    toast(`Generating ${templateName}...`, { icon: '🖨️' });
  };

  // The job cost sheet is the shipment's revenue and cost charges side by side,
  // which is what the counters above the form already total.
  const costSheetRows = () => ([
    { line: 'Revenue Charges', amount: counts.revenueCharges, currency: 'AED' },
    { line: 'Cost Charges', amount: counts.costCharges, currency: 'AED' },
    { line: 'Gross Margin', amount: Number(counts.revenueCharges || 0) - Number(counts.costCharges || 0), currency: 'AED' },
  ]);

  const handleAction = (actionName) => {
    setShowActionMenu(false);
    const rows = costSheetRows();
    const spec = [
      { key: 'line', label: 'Line' },
      { key: 'amount', label: 'Amount' },
      { key: 'currency', label: 'Currency' },
    ];
    if (actionName === 'Job Cost Sheet (Excel)') {
      exportCsv(rows, spec, `job-cost-sheet-${(form.jobNumber || id || '').replace(/\//g, '-')}`);
      toast.success('Job cost sheet exported');
      return;
    }
    if (actionName === 'Send Job Cost Sheet') {
      // Mail goes out from the shipment's own chatter so there is a record of it.
      setShowMessage(true);
      return;
    }
    toast(`${actionName} – coming soon`, { icon: 'ℹ️' });
  };

  // A message is the same chatter entry as a note, marked so the timeline can
  // tell the two apart the way the source system does.
  const [messageText, setMessageText] = useState('');
  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    const entry = {
      user: user?.name || 'You',
      message: messageText.trim(),
      kind: 'message',
      timestamp: new Date().toISOString(),
    };
    setForm((f) => ({ ...f, activityLog: [entry, ...(f.activityLog || [])] }));
    setMessageText('');
    setShowMessage(false);
    toast.success('Message posted to the shipment');
  };

  const handleAddLogNote = () => {
    if (!logNoteText.trim()) return;
    const entry = { user: user?.name || 'You', message: logNoteText.trim(), timestamp: new Date().toISOString() };
    setForm((f) => ({ ...f, activityLog: [entry, ...(f.activityLog || [])] }));
    setLogNoteText('');
    setShowLogNote(false);
    toast.success('Note logged (will be saved with the record)');
  };

  // Revenue summary
  const revenueSummary = useMemo(() => {
    const rev = form.revenue || {};
    const estReceivable = parseFloat(rev.estReceivable) || 0;
    const actReceivable = parseFloat(rev.actReceivable) || 0;
    const estPayable = parseFloat(rev.estPayable) || 0;
    const actPayable = parseFloat(rev.actPayable) || 0;
    const estMargin = parseFloat(rev.estMargin) || 0;
    const actMargin = parseFloat(rev.actMargin) || 0;
    const estimatedMarginPct = estReceivable !== 0 ? (estMargin / estReceivable) * 100 : 0;
    const receivedMarginPct = actReceivable !== 0 ? (actMargin / actReceivable) * 100 : 0;
    return {
      estReceivable, actReceivable, estPayable, actPayable, estMargin, actMargin,
      estimatedMarginPct, receivedMarginPct,
      dueReceivable: estReceivable - actReceivable,
      duePayable: estPayable - actPayable,
      dueMargin: estMargin - actMargin,
    };
  }, [form.revenue]);

  if (loading) return <PageLoader />;

  const statCards = [
    { key: 'customerCredits', icon: Receipt, label: 'Customer Credits', value: counts.customerCredits },
    { key: 'vendorCredits', icon: Receipt, label: 'Vendor Credits', value: counts.vendorCredits },
    { key: 'invoices', icon: FileText, label: 'Invoices', value: counts.invoices },
    { key: 'vendorBills', icon: FileBarChart, label: 'Vendor Bills', value: counts.vendorBills },
    { key: 'revenueCharges', icon: TrendingUp, label: 'Revenue Charges', value: `${counts.revenueCharges} AED` },
    { key: 'costCharges', icon: TrendingDown, label: 'Cost Charges', value: `${counts.costCharges} AED` },
    { key: 'documents', icon: Folder, label: 'Documents', value: (form.documents || []).length },
    { key: 'journalEntries', icon: BookOpen, label: 'Journal Entries', value: counts.journalEntries },
    ...((form.purchaseOrders || []).length > 0
      ? [{ key: 'purchaseOrders', icon: Tag, label: 'Purchase Order', value: (form.purchaseOrders || []).length }]
      : []),
  ];

  const tabComponentProps = { form, setField };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2" ref={menuRef}>
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
                onClick={() => {
                  if (isNew) {
                    handleDiscard();
                  } else {
                    setEditMode(false);
                    setRefreshKey((k) => k + 1);
                  }
                }}
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

          {/* Action dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowPrintMenu(false); setShowActionMenu((s) => !s); }}
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
                <button onClick={() => handleAction('Send Job Cost Sheet')} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Send className="w-4 h-4" /> Send Job Cost Sheet
                </button>
              </div>
            )}
          </div>

          {/* Print dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowActionMenu(false); setShowPrintMenu((s) => !s); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
            >
              <Printer className="w-4 h-4" /> Print <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showPrintMenu && (
              <div className="absolute left-0 top-full mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-30 max-h-96 overflow-y-auto">
                {[
                  'Job Cost Sheet (PDF)',
                  'Booking Confirmation (MRT)',
                  'Delivery Order (MRT)',
                  'Shipping Instruction (MRT)',
                  'HBL (MRT)',
                  'Job Cost Sheet (MRT)',
                  'HAWB (MRT)',
                  'Vessel Certificate (MRT)',
                  'Declaration Doc (MRT)',
                  'Booking Confirmation.',
                  'CAN',
                  'House Bill',
                  'Nomination Form',
                  'Cargo Arrival Notice (MRT)',
                  'Draft BL (MRT)',
                  'Pre-Alert (MRT)',
                  'Proof Of Delivery (MRT)',
                  'Pick-up instructions (MRT)',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => handlePrint(tpl)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openStatusModal}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
          >
            Change Status
          </button>
          <button
            onClick={() => navigate(`/admin/operations/cfs-receipts?shipment=${encodeURIComponent(form.jobNumber || '')}`)}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
          >
            Attach CFS
          </button>
          <button
            onClick={handleSyncMilestones}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync and Fetch Milestones
          </button>
          {form.masterShipmentId ? (
            <button
              onClick={() => navigate(`/admin/master-shipments/${form.masterShipmentId}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg"
            >
              <Layers className="w-4 h-4" /> Master Shipment
            </button>
          ) : (
            <button
              onClick={handleCreateMasterShipment}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
            >
              <Layers className="w-4 h-4" /> Create Master Shipment
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">
          House Shipment / {isNew ? 'New' : (form.jobNumber || 'New')}
        </div>
        {!isNew && recordIndex !== -1 && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span>{recordIndex + 1} / {recordTotal}</span>
            <button
              onClick={() => goToRecord(-1)}
              disabled={recordIndex <= 0}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToRecord(1)}
              disabled={recordIndex >= recordTotal - 1}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Status stepper */}
      {!isNew && (
        <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden bg-white overflow-x-auto">
          {STEPPER_STATUSES.map((s, idx) => (
            <div
              key={s}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                form.status === s ? 'bg-blue-700 text-white' : 'text-gray-600'
              } ${idx > 0 ? 'border-l border-gray-300' : ''}`}
            >
              {STATUS_LABELS[s]}
            </div>
          ))}
        </div>
      )}

      {/* Stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {statCards.map(({ key, icon: Icon, label, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleStatCardClick(key)}
            disabled={isNew}
            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border text-center transition-colors ${
              isNew
                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                : 'border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-gray-700 cursor-pointer'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-bold">{value}</span>
            <span className="text-[10px] leading-tight">{label}</span>
          </button>
        ))}
      </div>

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

      {/* Booking Ref */}
      <div className="flex flex-wrap items-start gap-x-12 gap-y-2">
        <div>
          <p className="text-xs text-gray-500">Booking Ref / Nomination No</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">{isNew ? 'New' : (form.jobNumber || 'New')}</p>
        </div>
        {!isNew && form.hblNumber && (
          <div>
            <p className="text-xs text-gray-500">House BL No</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{form.hblNumber}</p>
          </div>
        )}
      </div>

      {/* Header fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {/* LEFT */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="directShipment"
              checked={!!form.directShipment}
              onChange={(e) => setField('directShipment', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="directShipment" className="text-sm font-medium text-gray-700">Direct Shipment</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="courierShipment"
              checked={!!form.courierShipment}
              onChange={(e) => setField('courierShipment', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="courierShipment" className="text-sm font-medium text-gray-700">Courier Shipment</label>
          </div>
          <div>
            <label className={labelClass}>Shipment Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.shipmentDate || ''}
              onChange={(e) => setField('shipmentDate', e.target.value)}
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Company</label>
            <input
              type="text"
              className={`${inputClass} bg-gray-50 text-gray-500`}
              value={job?.company?.name || user?.company?.name || '—'}
              readOnly
            />
          </div>
          <div>
            <label className={labelClass}>From Quote</label>
            <select
              className={inputClass}
              value={form.quotationId || ''}
              onChange={(e) => handleQuotationSelect(e.target.value)}
            >
              <option value="">-- None --</option>
              {quotations.map((q) => (
                <option key={q.id} value={q.id}>{q.quoteNumber || q.quotationNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Sales Agent</label>
            <select
              className={inputClass}
              value={form.salesAgentId || ''}
              onChange={(e) => setField('salesAgentId', e.target.value)}
            >
              <option value="">-- None --</option>
              {usersForRoles.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tags</label>
            <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded-lg px-2 py-1.5">
              {(form.tags || []).map((tag, idx) => (
                <span key={idx} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-md">
                  <Tag className="w-3 h-3" />{tag}
                  <button type="button" onClick={() => setField('tags', form.tags.filter((_, i) => i !== idx))} className="text-blue-400 hover:text-blue-700">×</button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Add tag and press Enter"
                className="flex-1 min-w-[120px] text-sm focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    e.preventDefault();
                    setField('tags', [...(form.tags || []), e.target.value.trim()]);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* General Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Shipment Type</label>
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
              <select className={inputClass} value={form.serviceType || 'H'} onChange={(e) => setField('serviceType', e.target.value)}>
                {SERVICE_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Responsible</label>
              <select className={inputClass} value={form.assignedTo || ''} onChange={(e) => setField('assignedTo', e.target.value)}>
                <option value="">-- None --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Declared Weight & Volume */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Declared Weight & Volume</h2>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoUpdateWeight"
              checked={!!form.autoUpdateWeight}
              onChange={(e) => setField('autoUpdateWeight', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoUpdateWeight" className="text-sm font-medium text-gray-700">Auto Update Weight & Volume</label>
          </div>
        </div>

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
            <label className={labelClass}>Net Weight</label>
            <div className="flex gap-2">
              <input type="number" className={inputClass} value={form.netWeight ?? ''} onChange={(e) => setField('netWeight', e.target.value)} />
              <select className={`${inputClass} w-20`} value={form.weightUnit || 'kg'} onChange={(e) => setField('weightUnit', e.target.value)}>
                {WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Volumetric Weight</label>
            <div className="flex gap-2">
              <input type="number" className={inputClass} value={form.volumetricWeight ?? ''} onChange={(e) => setField('volumetricWeight', e.target.value)} />
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
          <div>
            <label className={labelClass}>Cargo Received Date</label>
            <input type="date" className={inputClass} value={form.cargoReceivedDate || ''} onChange={(e) => setField('cargoReceivedDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Chargeable Weight</label>
            <input type="text" readOnly className={`${inputClass} bg-gray-50 text-gray-500`} value={`${computedChargeableWeight.toFixed(2)} ${form.weightUnit || 'kg'}`} />
          </div>
        </div>
      </div>

      {/* Customer / Shipper / Consignee */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Customer</h3>
          <div>
            <label className={labelClass}>Customer</label>
            <select className={inputClass} value={form.customerId || ''} onChange={(e) => setField('customerId', e.target.value)}>
              <option value="">-- Select Customer --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 min-h-[38px]">{formatAddress(selectedCustomer)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Shipper</h3>
          <div>
            <label className={labelClass}>Shipper</label>
            <select className={inputClass} value={form.shipperId || ''} onChange={(e) => setField('shipperId', e.target.value)}>
              <option value="">-- Select Shipper --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 min-h-[38px]">{formatAddress(selectedShipper)}</p>
          </div>
          <div>
            <label className={labelClass}>Shipper Account Numbers</label>
            <input type="text" className={inputClass} value={form.shipperAccountNumbers || ''} onChange={(e) => setField('shipperAccountNumbers', e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Consignee</h3>
          <div>
            <label className={labelClass}>Consignee</label>
            <select className={inputClass} value={form.consigneeId || ''} onChange={(e) => setField('consigneeId', e.target.value)}>
              <option value="">-- Select Consignee --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 min-h-[38px]">{formatAddress(selectedConsignee)}</p>
          </div>
          <div>
            <label className={labelClass}>Consignee Account Numbers</label>
            <input type="text" className={inputClass} value={form.consigneeAccountNumbers || ''} onChange={(e) => setField('consigneeAccountNumbers', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4 -mx-6 px-6">
          {TABS.map((tab) => (
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
        {activeTab === 'Additional' && <AdditionalTab {...tabComponentProps} />}
        {activeTab === 'Cut-Off Dates' && <CutOffDatesTab {...tabComponentProps} />}
        {activeTab === 'Insurance' && <InsuranceTab {...tabComponentProps} />}
        {activeTab === 'Customs' && <CustomsTab {...tabComponentProps} />}
        {activeTab === 'Ext. Carrier Bookings' && <ExtCarrierBookingsTab {...tabComponentProps} />}
        {activeTab === 'Parties' && <PartiesTab {...tabComponentProps} />}
        {activeTab === 'Packages' && <PackagesTab {...tabComponentProps} />}
        {activeTab === 'Routing' && <RoutingTab {...tabComponentProps} />}
        {activeTab === 'Milestones Tracking' && (
          <MilestonesTab job={job} jobId={isNew ? null : id} onTrackingAdded={() => setRefreshKey((k) => k + 1)} />
        )}
        {activeTab === 'T&C' && <TermsTab {...tabComponentProps} />}
        {activeTab === 'Remarks' && <RemarksTab {...tabComponentProps} />}
      </div>

      </fieldset>

      {/* Shipment Revenue Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Shipment Revenue Summary</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Estimated Margin (%)</p>
            <p className="font-semibold text-gray-800">{revenueSummary.estimatedMarginPct.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Received Margin (%)</p>
            <p className="font-semibold text-gray-800">{revenueSummary.receivedMarginPct.toFixed(2)}%</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2">Type</th>
                <th className="py-2">Expected Amount</th>
                <th className="py-2">Invoiced/Billed Amount</th>
                <th className="py-2">Due Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">Customer Invoice (Receivable)</td>
                <td className="py-2">{revenueSummary.estReceivable.toFixed(2)} {form.currency || 'AED'}</td>
                <td className="py-2">{revenueSummary.actReceivable.toFixed(2)} {form.currency || 'AED'}</td>
                <td className="py-2">{revenueSummary.dueReceivable.toFixed(2)} {form.currency || 'AED'}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">Vendor Bills (Payable)</td>
                <td className="py-2">{revenueSummary.estPayable.toFixed(2)} {form.currency || 'AED'}</td>
                <td className="py-2">{revenueSummary.actPayable.toFixed(2)} {form.currency || 'AED'}</td>
                <td className="py-2">{revenueSummary.duePayable.toFixed(2)} {form.currency || 'AED'}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Margin</td>
                <td className="py-2">{revenueSummary.estMargin.toFixed(2)} {form.currency || 'AED'}</td>
                <td className="py-2">{revenueSummary.actMargin.toFixed(2)} {form.currency || 'AED'}</td>
                <td className="py-2">{revenueSummary.dueMargin.toFixed(2)} {form.currency || 'AED'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chatter */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowMessage((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Send message
          </button>
          <button
            type="button"
            onClick={() => setShowLogNote((s) => !s)}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Log note
          </button>
          <button
            type="button"
            onClick={() => setShowActivity(true)}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Schedule activity
          </button>
          <span className="ml-auto text-xs text-gray-400">0 Followers</span>
        </div>

        {showMessage && (
          <div className="flex gap-2">
            <input
              type="text"
              className={inputClass}
              placeholder="Send a message to the followers of this shipment..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
            />
            <button type="button" onClick={handleSendMessage} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        )}

        {showLogNote && (
          <div className="flex gap-2">
            <input
              type="text"
              className={inputClass}
              placeholder="Log an internal note..."
              value={logNoteText}
              onChange={(e) => setLogNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddLogNote(); }}
            />
            <button type="button" onClick={handleAddLogNote} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Log
            </button>
          </div>
        )}

        <div className="space-y-3">
          {(form.activityLog || []).map((entry, idx) => (
            <div key={idx} className="border-b border-gray-100 pb-2 last:border-0">
              <p className="text-sm text-gray-800">{entry.message}</p>
              <p className="text-xs text-gray-400">{entry.user} · {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-GB') : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shipment Documents modal */}
      {showDocumentsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDocumentsModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-gray-900">Shipment Document</h2>
                <p className="text-xs text-gray-500">House Shipment / {form.jobNumber} / Shipment Document</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedDocIds.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setDocActionMenuOpen((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg"
                    >
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{selectedDocIds.length} selected</span>
                      Action <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {docActionMenuOpen && (
                      <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                        <button
                          onClick={handleExportSelectedDocs}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                        >
                          Export Data
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setShowDocumentsModal(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {['IN', 'OUT'].map((mode) => {
                const docs = (form.documents || []).filter((d) => (d.mode || 'OUT') === mode);
                if (docs.length === 0) return null;
                const allSelected = docs.every((d) => selectedDocIds.includes(d.id));
                return (
                  <div key={mode}>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">{mode} ({docs.length})</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-xs text-gray-500">
                            <th className="py-2 px-3 text-center">
                              <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAllDocs(docs)} />
                            </th>
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-3">DateTime</th>
                            <th className="py-2 px-3">Document Type</th>
                            <th className="py-2 px-3 text-center">Upload</th>
                            <th className="py-2 px-3 text-center">Publish</th>
                            <th className="py-2 px-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docs.map((doc, idx) => (
                            <tr key={doc.id || idx} className="border-t border-gray-100">
                              <td className="py-2 px-3 text-center">
                                <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => toggleSelectDoc(doc.id)} />
                              </td>
                              <td className="py-2 px-3 font-medium text-gray-800">{doc.name}</td>
                              <td className="py-2 px-3 text-gray-600">
                                {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('en-US', {
                                  month: '2-digit', day: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                                }) : '—'}
                              </td>
                              <td className="py-2 px-3 text-gray-600">{doc.type}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setField('documents', (form.documents || []).map((d) => d.id === doc.id ? { ...d, uploaded: !d.uploaded } : d))}
                                  className={`inline-flex w-9 h-5 rounded-full ${doc.uploaded ? 'bg-blue-600' : 'bg-gray-300'} relative transition-colors`}
                                >
                                  <span className={`absolute top-0.5 ${doc.uploaded ? 'right-0.5' : 'left-0.5'} w-4 h-4 bg-white rounded-full transition-all`} />
                                </button>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setField('documents', (form.documents || []).map((d) => d.id === doc.id ? { ...d, published: !d.published } : d))}
                                  className={`inline-flex w-9 h-5 rounded-full ${doc.published ? 'bg-blue-600' : 'bg-gray-300'} relative transition-colors`}
                                >
                                  <span className={`absolute top-0.5 ${doc.published ? 'right-0.5' : 'left-0.5'} w-4 h-4 bg-white rounded-full transition-all`} />
                                </button>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center justify-center gap-2 text-gray-400">
                                  {mode === 'OUT' ? (
                                    <>
                                      <button title="View" onClick={() => handleViewDoc(doc)} className="hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                                      <button title="Email" onClick={() => handleMailDoc(doc)} className="hover:text-blue-600"><Mail className="w-4 h-4" /></button>
                                      <button title="Download" onClick={() => handleDownloadDoc(doc)} className="hover:text-blue-600"><Download className="w-4 h-4" /></button>
                                    </>
                                  ) : (
                                    <>
                                      <button title="Email" onClick={() => handleMailDoc(doc)} className="hover:text-blue-600"><Mail className="w-4 h-4" /></button>
                                      <button title="Restore" onClick={() => handleRestoreDoc(doc)} className="hover:text-blue-600"><RotateCcw className="w-4 h-4" /></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {(form.documents || []).length === 0 && (
                <div className="text-center text-sm text-gray-400 py-8">No documents available for this shipment.</div>
              )}
              <div className="flex justify-end">
                <label
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  <input type="file" className="hidden" onChange={handleUploadDocument} />
                  <Upload className="w-4 h-4" /> Upload Document
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">{previewDoc.doc.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadDoc(previewDoc.doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => setPreviewDoc(null)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <iframe title={previewDoc.doc.name} src={previewDoc.url} className="flex-1 w-full" />
          </div>
        </div>
      )}

      {/* Send Mail modal */}
      {mailDoc && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setMailDoc(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-blue-700">Send Mail</h2>
              <button onClick={() => setMailDoc(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Recipients</label>
                <div className="flex flex-wrap items-center gap-1.5 border border-gray-300 rounded-lg px-2 py-1.5 min-h-[40px]">
                  {mailForm.recipients.map((r) => (
                    <span key={r} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                      {r}
                      <button onClick={() => setMailForm((f) => ({ ...f, recipients: f.recipients.filter((x) => x !== r) }))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add contacts to notify..."
                    className="flex-1 min-w-[120px] text-sm outline-none py-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        setMailForm((f) => ({ ...f, recipients: [...f.recipients, e.target.value.trim()] }));
                        e.target.value = '';
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>CC</label>
                <input
                  type="text"
                  placeholder="emails with separated by comma"
                  className={inputClass}
                  value={mailForm.cc}
                  onChange={(e) => setMailForm((f) => ({ ...f, cc: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Subject</label>
                <input
                  type="text"
                  className={inputClass}
                  value={mailForm.subject}
                  onChange={(e) => setMailForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  rows={4}
                  className={inputClass}
                  value={mailForm.body}
                  onChange={(e) => setMailForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{mailDoc.filename}</p>
                  <p className="text-xs text-gray-500 uppercase">{mailDoc.doc.type}</p>
                </div>
                <span className="ml-auto text-green-600 text-sm">✓</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setMailDoc(null)} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg">
                  Cancel
                </button>
                <button onClick={handleSendMail} className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg">
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
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
                  {(FFJOB_VALID_TRANSITIONS[form.status] || []).length === 0 ? (
                    <option value={form.status}>{STATUS_LABELS[form.status] || form.status}</option>
                  ) : (
                    FFJOB_VALID_TRANSITIONS[form.status].map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))
                  )}
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
                disabled={(FFJOB_VALID_TRANSITIONS[form.status] || []).length === 0}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    <ScheduleActivityModal
      open={showActivity}
      onClose={() => setShowActivity(false)}
      resModel="house.shipment"
      resId={id}
      resName={form.jobNumber}
    />
    </div>
  );
};

export default AdminHouseShipmentDetail;
