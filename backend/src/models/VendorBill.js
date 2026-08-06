const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VendorBill = sequelize.define('VendorBill', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  billNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  vendorId: {
    // Nullable because procurement vendors are free text on the PO and may not
    // exist as a customer record.
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'References Customer table (acting as vendor)',
  },
  vendorName: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Vendor label carried over from the purchase order',
  },
  purchaseOrderId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Set when the bill was raised from Procurement > Purchase',
  },
  ffJobId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  serviceJobId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  billDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  subtotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  amountPaid: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('draft', 'posted', 'paid', 'cancelled'),
    defaultValue: 'draft',
  },
  items: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {description, quantity, unitPrice, amount, category}',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'vendor_bills',
  hooks: {
    beforeValidate: async (bill) => {
      if (!bill.billNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const count = await VendorBill.count({
          where: {
            createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        bill.billNumber = `BILL/${year}/${seq}`;
      }
      // Auto-compute balance
      bill.balance = parseFloat(bill.totalAmount || 0) - parseFloat(bill.amountPaid || 0);
    },
    beforeUpdate: (bill) => {
      if (bill.changed('totalAmount') || bill.changed('amountPaid')) {
        bill.balance = parseFloat(bill.totalAmount || 0) - parseFloat(bill.amountPaid || 0);
      }
    },
  },
});

module.exports = VendorBill;
