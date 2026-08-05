const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "CFS Delivery Entry" - Operations > CFS > Delivery Entry.
const CFSDelivery = sequelize.define('CFSDelivery', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  deliveryNumber: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    comment: 'Format: CFS-DLV-2026-00001',
  },
  ffJobId: { type: DataTypes.UUID, allowNull: true },
  cfsLocation: { type: DataTypes.STRING(150), allowNull: true },
  gateOutDate: { type: DataTypes.DATE, allowNull: true },
  direction: { type: DataTypes.STRING(10), defaultValue: 'EXPORT' },
  transportMode: { type: DataTypes.STRING(10), defaultValue: 'SEA' },
  cargoType: { type: DataTypes.STRING(10), defaultValue: 'LCL' },
  serviceMode: { type: DataTypes.STRING(50), allowNull: true },
  supplierRefNo: { type: DataTypes.STRING(100), allowNull: true },
  origin: { type: DataTypes.STRING(150), allowNull: true },
  destination: { type: DataTypes.STRING(150), allowNull: true },
  shipper: { type: DataTypes.STRING(150), allowNull: true },
  consignee: { type: DataTypes.STRING(150), allowNull: true },
  containerNumber: { type: DataTypes.STRING(30), allowNull: true },
  vehicleNumber: { type: DataTypes.STRING(30), allowNull: true },
  driverName: { type: DataTypes.STRING(100), allowNull: true },
  packages: { type: DataTypes.INTEGER, allowNull: true },
  packUnit: { type: DataTypes.STRING(10), defaultValue: 'PKG' },
  grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  weightUnit: { type: DataTypes.STRING(5), defaultValue: 'kg' },
  volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  volumeUnit: { type: DataTypes.STRING(5), defaultValue: 'm3' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('created', 'delivered', 'cancelled'),
    defaultValue: 'created',
  },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'cfs_deliveries',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.deliveryNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const count = await CFSDelivery.count({
          where: { createdAt: { [Op.gte]: new Date(`${year}-01-01`) } },
        });
        const seq = String(count + 1).padStart(5, '0');
        rec.deliveryNumber = `CFS-DLV-${year}-${seq}`;
      }
    },
  },
});

module.exports = CFSDelivery;
