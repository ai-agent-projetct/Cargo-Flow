const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Procurement > Purchase" — a purchase order raised against a shipment,
// moving RFQ → To Approve → Approved, with Cancelled/Rejected as end states.
const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  poNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
    comment: 'Format: P00151',
  },
  poDate: { type: DataTypes.DATE, allowNull: true },

  // draft renders as "RFQ" — the demo keeps the internal name but relabels it.
  state: {
    type: DataTypes.ENUM('draft', 'to_approve', 'approved', 'cancel', 'reject'),
    defaultValue: 'draft',
  },
  // The list's favourite star.
  priority: { type: DataTypes.INTEGER, defaultValue: 0 },

  vendor: { type: DataTypes.STRING(200), allowNull: true },
  vendorInvoiceNo: { type: DataTypes.STRING(80), allowNull: true },
  vendorInvoiceDate: { type: DataTypes.DATEONLY, allowNull: true },
  contact: { type: DataTypes.STRING(150), allowNull: true },

  shipmentNo: { type: DataTypes.STRING(80), allowNull: true },
  createdByName: { type: DataTypes.STRING(150), allowNull: true },
  approvedByName: { type: DataTypes.STRING(150), allowNull: true },
  purchaseApprover: { type: DataTypes.STRING(150), allowNull: true },
  approvedDate: { type: DataTypes.DATEONLY, allowNull: true },

  // Charge Detail grid: [{ sNo, product, uom, noOfUnit, chargeCurrency,
  // exchangeRate, amountPerUnit, amount, currencyTotalAmount, orderCurrencyTotalAmount }]
  chargeLines: { type: DataTypes.JSON, defaultValue: [] },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  amountTotal: { type: DataTypes.DECIMAL(16, 2), defaultValue: 0 },

  // Cancel PO captures a reason; both fields only surface once cancelled.
  cancelReason: { type: DataTypes.STRING(150), allowNull: true },
  cancelRemark: { type: DataTypes.TEXT, allowNull: true },

  // Drives whether Create Vendor Bill / Cancel PO are still offered.
  billCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  documentCount: { type: DataTypes.INTEGER, defaultValue: 0 },

  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'purchase_orders',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.poNumber) {
        // Continue from the highest number issued — a plain count collides as
        // soon as the sequence has gaps (the demo's does).
        const last = await PurchaseOrder.findOne({
          order: [['poNumber', 'DESC']], attributes: ['poNumber'], raw: true,
        });
        const next = last ? Number(String(last.poNumber).replace(/\D/g, '')) + 1 : 132;
        rec.poNumber = `P${String(next).padStart(5, '0')}`;
      }
      // Order Currency Amount is what the PO total is measured in. Only
      // recompute when lines are present — several seeded POs carry the demo's
      // stored total without their (unextracted) lines, and an empty array
      // must not silently wipe it.
      if (Array.isArray(rec.chargeLines) && rec.chargeLines.length) {
        rec.amountTotal = rec.chargeLines
          .reduce((sum, l) => sum + Number(l.orderCurrencyTotalAmount || l.amount || 0), 0);
      }
    },
  },
});

// Which header buttons the form should offer, mirroring the demo's attrs.
PurchaseOrder.prototype.availableActions = function availableActions() {
  const noBills = (this.billCount || 0) === 0;
  return {
    sendForApproval: this.state === 'draft',
    approve: this.state === 'to_approve',
    reject: this.state === 'to_approve',
    createVendorBill: noBills && this.state === 'approved',
    cancelPO: noBills && ['draft', 'approved'].includes(this.state),
  };
};

module.exports = PurchaseOrder;
