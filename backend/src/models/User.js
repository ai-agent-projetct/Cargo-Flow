const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true, len: [2, 100] },
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'user'),
    defaultValue: 'user',
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  avatar: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resetPasswordToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  allowedCompanyIds: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  defaultCompanyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  creditLimitSetup: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  creditLimitApproval: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  quotationApproval: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  accessRights: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  otherPermissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  preferences: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  customsBroker: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  connectionStatus: {
    type: DataTypes.ENUM('never_connected', 'confirmed', 'pending'),
    defaultValue: 'never_connected',
  },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.refreshToken;
  delete values.resetPasswordToken;
  delete values.resetPasswordExpires;
  return values;
};

module.exports = User;
