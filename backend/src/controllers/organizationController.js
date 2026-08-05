const { Op } = require('sequelize');
const {
  Organization, Customer, Opportunity, Quotation, FFJob, MasterShipment,
  Invoice, CreditNote, VendorBill, CFSDelivery,
} = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

// The workflow ribbon across the top of the Organization form. Each step counts
// the transactional documents linked to this partner, in the order the demo
// shows them: Customer › Opportunity › Quotation › Booking › Milestone Activity
// › Job Card Sheet › BL › Invoice › Credit Note › Vendor Invoice ›
// Vendor Credit Note › Delivery Order.
const WORKFLOW_STEPS = [
  { key: 'customer', label: 'Customer', icon: 'user' },
  { key: 'opportunity', label: 'Opportunity', icon: 'users' },
  { key: 'quotation', label: 'Quotation', icon: 'file-check' },
  { key: 'booking', label: 'Booking', icon: 'truck' },
  { key: 'milestone-activity', label: 'Milestone Activity', icon: 'list' },
  { key: 'job-card-sheet', label: 'Job Card Sheet', icon: 'file-text' },
  { key: 'bl', label: 'BL', icon: 'credit-card' },
  { key: 'invoice', label: 'Invoice', icon: 'file-dollar' },
  { key: 'credit-note', label: 'Credit Note', icon: 'file-minus' },
  { key: 'vendor-invoice', label: 'Vendor Invoice', icon: 'building' },
  { key: 'vendor-credit-note', label: 'Vendor Credit Note', icon: 'folder-plus' },
  { key: 'delivery-order', label: 'Delivery Order', icon: 'clipboard-check' },
];

// Organizations are the partner master; the transactional models still key off
// Customer. Resolve the link once (explicit customerId, else a name/email match)
// so the ribbon can count documents without a schema-wide migration.
const resolveCustomerId = async (org) => {
  if (org.customerId) return org.customerId;
  // Customers store the name as companyName/contactName, not `name`.
  const where = [];
  if (org.name) where.push({ companyName: org.name }, { contactName: org.name });
  if (org.email) where.push({ email: org.email });
  if (!where.length) return null;
  const match = await Customer.findOne({ where: { [Op.or]: where }, attributes: ['id'] });
  return match ? match.id : null;
};

// [Model, how to label a row] per step. Steps with no backing model yet resolve
// to an empty list rather than erroring.
const stepQuery = (key) => ({
  opportunity: { model: Opportunity, label: (r) => r.name },
  quotation: { model: Quotation, label: (r) => r.quotationNumber },
  booking: { model: FFJob, label: (r) => r.hblNumber || r.jobNumber },
  'job-card-sheet': { model: FFJob, label: (r) => r.hblNumber || r.jobNumber },
  bl: { model: MasterShipment, label: (r) => r.mblNumber || r.masterShipmentNumber },
  invoice: { model: Invoice, label: (r) => r.invoiceNumber },
  'credit-note': { model: CreditNote, label: (r) => r.creditNoteNumber },
  'vendor-invoice': { model: VendorBill, label: (r) => r.billNumber },
  'vendor-credit-note': { model: VendorBill, label: (r) => r.billNumber },
  'delivery-order': { model: CFSDelivery, label: (r) => r.deliveryNumber },
}[key]);

const rowsForStep = async (key, org, customerId) => {
  if (key === 'customer') return [org];
  if (key === 'milestone-activity') {
    // Milestones live inside each master shipment's JSON, so flatten them out.
    if (!customerId) return [];
    const masters = await MasterShipment.findAll({ where: { customerId }, attributes: ['masterShipmentNumber', 'milestones'] });
    return masters.flatMap((m) => (m.milestones || []).map((ms) => ({ ...ms, master: m.masterShipmentNumber })));
  }
  const spec = stepQuery(key);
  if (!spec || !spec.model || !customerId) return [];
  const where = { customerId };
  // Vendor credit notes are the negative-value side of the vendor bill ledger.
  if (key === 'vendor-credit-note') where.isCreditNote = true;
  if (key === 'vendor-invoice') where.isCreditNote = { [Op.not]: true };
  try {
    return await spec.model.findAll({ where, limit: 200, order: [['createdAt', 'DESC']] });
  } catch {
    // Model lacks one of the columns we filtered on — treat as no records.
    return [];
  }
};

// Child address rows (Invoice/Delivery/Other Address) are nested under their
// parent on the Addresses tab, so the main list only shows top-level partners.
const TOP_LEVEL = { parentId: null };

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { companyType, country, city, transactionType, search, includeChildren } = req.query;

    const where = includeChildren === 'true' ? {} : { ...TOP_LEVEL };
    if (companyType) where.companyType = companyType;
    if (country) where.country = country;
    if (city) where.city = city;
    if (transactionType) where.transactionType = transactionType;

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { customerCode: { [Op.like]: `%${search}%` } },
        { vat: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { country: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Organization.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'Organizations retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await Organization.findByPk(req.params.id, {
      include: [{ association: 'addresses' }],
    });
    if (!record) return errorResponse(res, 'Organization not found', 404);
    return successResponse(res, record, 'Organization retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const record = await Organization.create({ ...req.body, createdBy: req.user?.id || null });
    return successResponse(res, record, 'Organization created', 201);
  } catch (error) {
    next(error);
  }
};

// Fields worth showing in the chatter when they change — the demo logs these as
// "Status: New → KYC Done", "Email: a@x → b@y".
const TRACKED_FIELDS = {
  kycStatus: 'Status', name: 'Name', email: 'Email', phone: 'Phone', mobile: 'Mobile',
  country: 'Country', city: 'City', vat: 'VAT', customerType: 'Customer',
  inwardStrategy: 'Inward Strategy', pickStrategy: 'Pick Strategy',
  transactionType: 'Transaction Type', companyType: 'Type',
};

const KYC_LABELS = { new: 'New', kyc_pending: 'KYC Pending', kyc_done: 'KYC Done' };
const pretty = (field, value) => {
  if (value === null || value === undefined || value === '') return '';
  if (field === 'kycStatus') return KYC_LABELS[value] || value;
  return String(value);
};

exports.update = async (req, res, next) => {
  try {
    const record = await Organization.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Organization not found', 404);

    const changes = Object.keys(TRACKED_FIELDS)
      .filter((f) => f in req.body && String(req.body[f] ?? '') !== String(record[f] ?? ''))
      .map((f) => ({ field: TRACKED_FIELDS[f], from: pretty(f, record[f]), to: pretty(f, req.body[f]) }));

    await record.update(req.body);

    if (changes.length) {
      await record.update({
        activityLog: [{
          at: new Date().toISOString(),
          author: req.user?.name || req.user?.email || 'System',
          kind: 'log',
          body: '',
          changes,
        }, ...(record.activityLog || [])],
      });
    }

    return successResponse(res, record, 'Organization updated');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const record = await Organization.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Organization not found', 404);
    await record.destroy();
    return successResponse(res, null, 'Organization deleted');
  } catch (error) {
    next(error);
  }
};

// "Sync Partner" on the form toolbar - re-derives the display/company name and
// stamps the localization code from the country.
exports.syncPartner = async (req, res, next) => {
  try {
    const record = await Organization.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Organization not found', 404);

    const COUNTRY_CODES = {
      'United Arab Emirates': 'AE', India: 'IN', 'United States': 'US', Malaysia: 'MY',
      China: 'CN', Egypt: 'EG', Germany: 'DE', Afghanistan: 'AF', 'Saudi Arabia': 'SA',
    };
    await record.update({
      localizationCountryCode: COUNTRY_CODES[record.country] || record.localizationCountryCode,
      companyName: record.companyType === 'company' ? record.name : record.companyName,
    });

    return successResponse(res, record, 'Partner synced');
  } catch (error) {
    next(error);
  }
};

// Counts for every step of the workflow ribbon, plus the first few record names
// so the UI can show the demo's "Label (n) : rec1, rec2, ..." tooltip.
exports.workflow = async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) return errorResponse(res, 'Organization not found', 404);
    const customerId = await resolveCustomerId(org);

    const steps = [];
    for (const step of WORKFLOW_STEPS) {
      const rows = await rowsForStep(step.key, org, customerId);
      const spec = stepQuery(step.key);
      const names = rows.slice(0, 5).map((r) => {
        if (step.key === 'customer') return `${org.customerCode || ''}${org.customerCode ? ': ' : ''}${org.name}`;
        if (step.key === 'milestone-activity') return r.eventType || r.name || r.code || '-';
        return (spec && spec.label(r)) || '-';
      });
      steps.push({ ...step, count: rows.length, names });
    }
    return successResponse(res, { steps, linkedCustomerId: customerId }, 'Workflow retrieved');
  } catch (error) {
    next(error);
  }
};

// Rows behind one ribbon step, for the drill-down list page.
exports.related = async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) return errorResponse(res, 'Organization not found', 404);
    const step = WORKFLOW_STEPS.find((s) => s.key === req.params.type);
    if (!step) return errorResponse(res, 'Unknown workflow step', 404);

    const customerId = await resolveCustomerId(org);
    const rows = await rowsForStep(step.key, org, customerId);
    return successResponse(res, {
      step,
      organization: { id: org.id, name: org.name, customerCode: org.customerCode },
      rows,
    }, 'Related records retrieved');
  } catch (error) {
    next(error);
  }
};

// Chatter: append a message, note, or logged activity to the feed.
exports.addActivity = async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) return errorResponse(res, 'Organization not found', 404);
    const entry = {
      at: new Date().toISOString(),
      author: req.user?.name || req.user?.email || 'System',
      kind: req.body.kind || 'message',
      body: req.body.body || '',
      changes: req.body.changes || [],
    };
    await org.update({ activityLog: [entry, ...(org.activityLog || [])] });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};

// Child addresses for the Addresses tab.
exports.addAddress = async (req, res, next) => {
  try {
    const parent = await Organization.findByPk(req.params.id);
    if (!parent) return errorResponse(res, 'Organization not found', 404);
    // Matches the demo's child-address naming, e.g. "Adovan ETL, Delivery Address".
    const type = req.body.addressType || 'other';
    const address = await Organization.create({
      ...req.body,
      parentId: parent.id,
      name: req.body.name || `${parent.name}, ${type.charAt(0).toUpperCase()}${type.slice(1)} Address`,
    });
    return successResponse(res, address, 'Address added', 201);
  } catch (error) {
    next(error);
  }
};
