const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Shipment Sharing" - Operations > Shipment Sharing.
// 4 sub-views: Import->Export Pending/Converted, Export->Import Pending/Converted.
const ShipmentSharing = sequelize.define('ShipmentSharing', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sharingNumber: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    comment: 'Format: SHR-2026-00001',
  },
  direction: {
    type: DataTypes.ENUM('import_to_export', 'export_to_import'),
    allowNull: false,
    defaultValue: 'import_to_export',
  },
  company: { type: DataTypes.STRING(150), allowNull: true },
  ffJobId: { type: DataTypes.UUID, allowNull: true },
  shipmentType: { type: DataTypes.STRING(10), defaultValue: 'EXP' },
  transportMode: { type: DataTypes.STRING(10), defaultValue: 'SEA' },
  cargoType: { type: DataTypes.STRING(20), defaultValue: 'FCL' },
  bookingId: { type: DataTypes.STRING(60), allowNull: true },
  shipmentDate: { type: DataTypes.DATEONLY, allowNull: true },
  shipper: { type: DataTypes.STRING(150), allowNull: true },
  consignee: { type: DataTypes.STRING(150), allowNull: true },
  originPort: { type: DataTypes.STRING(200), allowNull: true },
  destinationPort: { type: DataTypes.STRING(200), allowNull: true },
  status: {
    type: DataTypes.ENUM('created', 'booked', 'confirmed', 'nomination_generated', 'in_transit', 'arrived', 'completed', 'cancelled'),
    defaultValue: 'created',
  },
  converted: { type: DataTypes.BOOLEAN, defaultValue: false },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'shipment_sharings',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.sharingNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const count = await ShipmentSharing.count({
          where: { createdAt: { [Op.gte]: new Date(`${year}-01-01`) } },
        });
        const seq = String(count + 1).padStart(5, '0');
        rec.sharingNumber = `SHR-${year}-${seq}`;
      }
    },
  },
});

module.exports = ShipmentSharing;
