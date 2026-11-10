const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Container Number" configuration master - Operations > Container Number.
const ContainerNumber = sequelize.define('ContainerNumber', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  containerNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('unused', 'used'),
    defaultValue: 'unused',
  },
  linkedPackageId: { type: DataTypes.UUID, allowNull: true },
  linkedShipmentNumber: { type: DataTypes.STRING(60), allowNull: true },
}, {
  tableName: 'container_numbers',
  hooks: {
    // Refuse a number that fails the ISO 6346 check digit when it is first
    // entered or changed. An existing row is left alone so its status can
    // still be updated.
    beforeSave: (rec) => {
      if (!rec.changed('containerNumber')) return;
      const { validate } = require('../utils/containerNumber');
      const r = validate(rec.containerNumber);
      if (!r.valid) {
        const err = new Error(`Invalid container number ${rec.containerNumber}: ${r.reason}`);
        err.statusCode = 422;
        throw err;
      }
      rec.containerNumber = r.normalised;
    },
  },
});

module.exports = ContainerNumber;
