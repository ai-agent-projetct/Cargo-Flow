// Model registry for the SearatesERP "Agency" clone.
//
// Every model, field and view comes from the instance itself
// (agency/upstream/agency-upstream.json: fields_get + fields_view_get of 127
// models, read from unifeeder-shipping-staging on 2026-11-19). Each model gets
// a table `og_<model>` whose columns are the upstream stored field names, so
// the upstream form/list/search XML binds to the data with no translation.
//
// Relations to records CargoFlo already owns point at CargoFlo's tables:
//   res.partner -> organizations, res.users -> users, account.move ->
//   account_moves, account.payment -> account_payments.
// Every other reference model (currencies, countries, UoM, taxes, accounts,
// products...) lives in one table, og_refs, keyed by model.
const path = require('path');
const fs = require('fs');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UPSTREAM = path.join(__dirname, '../agency/upstream/agency-upstream.json');
const MASTERS = path.join(__dirname, '../agency/upstream/agency-masters.json');

const U = JSON.parse(fs.readFileSync(UPSTREAM, 'utf8'));
const MASTER_DATA = fs.existsSync(MASTERS) ? JSON.parse(fs.readFileSync(MASTERS, 'utf8')) : null;

// Upstream models that are CargoFlo records.
const EXTERNAL = {
  'res.partner': { key: 'org', model: 'Organization', label: (r) => (r.customerCode ? `${r.customerCode}: ${r.companyName || r.name}` : (r.companyName || r.name)), search: ['name', 'companyName', 'customerCode'], attrs: ['id', 'name', 'companyName', 'customerCode', 'email', 'phone', 'streetName', 'city', 'country', 'partyTypes'] },
  'res.users': { key: 'user', model: 'User', label: (r) => r.name || r.email, search: ['name', 'email'], attrs: ['id', 'name', 'email'] },
  'account.move': { key: 'move', model: 'AccountMove', label: (r) => (r.name && r.name !== '/' ? r.name : `Draft ${String(r.id).slice(0, 8)}`), search: ['name', 'partner'], attrs: ['id', 'name', 'partner', 'moveType', 'state', 'amountTotal'] },
  'account.payment': { key: 'payment', model: 'AccountPayment', label: (r) => r.name || r.id, search: ['name'], attrs: ['id', 'name'] },
};

// Platform plumbing the clone does not reproduce.
const SKIP = /^(mail\.|calendar\.|crm\.|payment\.|account\.edi|ir\.|utm\.|bus\.|res\.partner\.bank$|account\.asset$)/;

const SYSTEM_FIELDS = new Set(['id', 'display_name', '__last_update', 'create_uid', 'create_date', 'write_uid', 'write_date']);

const OWN = Object.keys(U.models).filter((m) => !SKIP.test(m) && !EXTERNAL[m]);
const isOwn = (m) => OWN.includes(m);
const isExternal = (m) => !!EXTERNAL[m];
const isRef = (m) => !!m && !isOwn(m) && !isExternal(m);

const tableOf = (m) => `og_${m.replace(/\./g, '_')}`.slice(0, 64);

const columnFor = (f) => {
  switch (f.type) {
    case 'char': return DataTypes.TEXT;
    case 'text': return DataTypes.TEXT('medium');
    case 'html': return DataTypes.TEXT('medium');
    case 'integer': return DataTypes.INTEGER;
    case 'float': return DataTypes.DOUBLE;
    case 'monetary': return DataTypes.DECIMAL(18, 2);
    case 'boolean': return DataTypes.BOOLEAN;
    case 'date': return DataTypes.DATEONLY;
    case 'datetime': return DataTypes.DATE;
    // Ids and selection keys are ASCII. utf8mb4 would reserve 4 bytes a
    // character and the 150-column job table would pass InnoDB's 8126-byte
    // row limit.
    case 'selection': return 'VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci';
    case 'many2one': return 'VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci';
    case 'many2many': return DataTypes.JSON;
    case 'binary': return DataTypes.TEXT('long');
    case 'reference': return 'VARCHAR(128) CHARACTER SET ascii COLLATE ascii_general_ci';
    default: return null;
  }
};

/** Stored, column-backed fields of a model (one2many is the inverse side). */
const storedFields = (m) => Object.entries(U.models[m].fields)
  .filter(([k, f]) => f.store !== false && !SYSTEM_FIELDS.has(k) && f.type !== 'one2many' && columnFor(f));

const MODELS = {};
for (const m of OWN) {
  const attrs = { id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true } };
  for (const [k, f] of storedFields(m)) attrs[k] = { type: columnFor(f), allowNull: true };
  attrs.create_uid = { type: DataTypes.STRING(40), allowNull: true };
  attrs.write_uid = { type: DataTypes.STRING(40), allowNull: true };
  // The upstream display name, kept for seeded rows so links read exactly as
  // they do upstream; new rows derive it from the learnt pattern.
  attrs.x_display = { type: DataTypes.TEXT, allowNull: true };
  // Explicit short names: table + column can pass MySQL's 64-char limit.
  const m2o = storedFields(m).filter(([, f]) => f.type === 'many2one').slice(0, 24)
    .map(([k], i) => ({ name: `ix_${tableOf(m).slice(3, 40)}_${i}`, fields: [k] }));
  MODELS[m] = sequelize.define(`Og_${m.replace(/\./g, '_')}`, attrs, {
    tableName: tableOf(m),
    timestamps: true,
    createdAt: 'create_date',
    updatedAt: 'write_date',
    indexes: m2o,
  });
}

// Reference models: one row per (model, id).
const OgRef = sequelize.define('OgRef', {
  pk: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  model: { type: DataTypes.STRING(64), allowNull: false },
  ref_id: { type: DataTypes.STRING(40), allowNull: false },
  name: { type: DataTypes.TEXT },
  data: { type: DataTypes.JSON },
}, { tableName: 'og_refs', timestamps: false, indexes: [{ fields: ['model', 'ref_id'] }] });

const fieldsOf = (m) => (U.models[m] ? U.models[m].fields : {});
const viewsOf = (m) => (U.models[m] ? U.models[m].views : {});

module.exports = {
  U, MASTER_DATA, MODELS, OgRef, EXTERNAL, OWN, isOwn, isExternal, isRef, tableOf, fieldsOf, viewsOf, storedFields, SYSTEM_FIELDS,
};
