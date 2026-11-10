const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Pipeline stages for both the lead and the opportunity funnels
// (upstream: crm.prospect.lead.stage and crm.prospect.opportunity.stage).
// They differ only in which gate flag they carry, so one table with a `kind`
// discriminator covers both and keeps the stage-ordering code in one place.
//
// The flags are gates, not labels: `isCreateOpportunity` is what lets a lead
// in this stage raise an opportunity, and `allowQuoteCreation` is what lets an
// opportunity in this stage raise a quote. The server re-checks them, so a
// stale form cannot skip a stage.
const CrmStage = sequelize.define('CrmStage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  kind: {
    type: DataTypes.ENUM('lead', 'opportunity'),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true },
  },
  sequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  isCreateOpportunity: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Lead stages only: a lead here may be converted to an opportunity',
  },
  allowQuoteCreation: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Opportunity stages only: an opportunity here may raise a quote',
  },
  isWon: { type: DataTypes.BOOLEAN, defaultValue: false },
  isLost: { type: DataTypes.BOOLEAN, defaultValue: false },
  fold: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Collapse this column by default in the kanban view',
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'crm_stages',
  indexes: [{ fields: ['kind', 'sequence'] }],
});

module.exports = CrmStage;
