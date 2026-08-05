const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FreightBooking = sequelize.define('FreightBooking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bookingNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  ffJobId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  carrierId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  transportMode: {
    type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL'),
    defaultValue: 'SEA',
  },
  cargoType: {
    type: DataTypes.ENUM('FCL', 'LCL', 'FTL', 'LTL', 'LSE'),
    defaultValue: 'FCL',
  },
  origin: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  destination: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  etd: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  eta: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  containerCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  containerType: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  grossWeight: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },
  volume: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },
  commodity: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  bookingReference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Carrier booking reference number',
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'confirmed', 'cancelled'),
    defaultValue: 'draft',
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'freight_bookings',
  timestamps: true,
  hooks: {
    beforeValidate: async (booking) => {
      if (!booking.bookingNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const count = await FreightBooking.count({
          where: {
            createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        booking.bookingNumber = `BKG/${year}/${seq}`;
      }
    },
  },
});

module.exports = FreightBooking;
