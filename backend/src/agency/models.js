// Sequelize models for every Liner Agency resource, generated from spec.js.
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { RESOURCES, fieldsOf } = require('./spec');

const columnFor = (f) => {
  switch (f.type) {
    case 't': case 'h': return { type: DataTypes.TEXT };
    case 'i': return { type: DataTypes.INTEGER, defaultValue: f.defaultValue ?? 0 };
    case 'f': return { type: DataTypes.DECIMAL(14, 3), defaultValue: f.defaultValue ?? 0 };
    case '$': return { type: DataTypes.DECIMAL(18, 2), defaultValue: f.defaultValue ?? 0 };
    case 'b': return { type: DataTypes.BOOLEAN, defaultValue: f.defaultValue ?? false };
    case 'd': return { type: DataTypes.DATEONLY };
    case 'dt': return { type: DataTypes.DATE };
    case 'm2o': return { type: DataTypes.UUID };
    case 'm2m': case 'json': return { type: DataTypes.JSON, defaultValue: f.defaultValue ?? [] };
    case 'sel': return { type: DataTypes.STRING(60), defaultValue: f.defaultValue ?? null };
    default: return { type: DataTypes.STRING(255), defaultValue: f.defaultValue ?? null };
  }
};

// Mixed into the model name so it never collides with an existing model.
const modelName = (key) => `Ag${key.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')}`;

const AGENCY_MODELS = {};
for (const [key, spec] of Object.entries(RESOURCES)) {
  const attrs = {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  };
  for (const f of fieldsOf(key)) attrs[f.name] = { ...columnFor(f), allowNull: true };
  if (spec.stateField && !attrs[spec.stateField]) {
    attrs[spec.stateField] = { type: DataTypes.STRING(40), defaultValue: spec.states[0][0] };
  }
  attrs.activityLog = { type: DataTypes.JSON, defaultValue: [] };
  attrs.createdBy = { type: DataTypes.UUID, allowNull: true };

  const indexes = fieldsOf(key).filter((f) => f.type === 'm2o').slice(0, 8).map((f) => ({ fields: [f.name] }));
  AGENCY_MODELS[key] = sequelize.define(modelName(key), attrs, { tableName: spec.table, indexes });
}

module.exports = { AGENCY_MODELS, modelName };
