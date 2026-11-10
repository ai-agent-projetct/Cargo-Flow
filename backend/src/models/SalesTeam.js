const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A sales team (upstream: crm.prospect.team). `memberIds` is the roster; the
// team is what scopes the Sales Strategy dashboard and the agent reports, so
// a salesperson sees their team's pipeline rather than everybody's.
const SalesTeam = sequelize.define('SalesTeam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
    validate: { notEmpty: true },
  },
  code: { type: DataTypes.STRING(30), allowNull: true },
  sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  leaderId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Team lead (upstream user_id)',
  },
  memberIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of user ids on this team',
  },
  targetCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  description: { type: DataTypes.TEXT, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'sales_teams',
});

module.exports = SalesTeam;
