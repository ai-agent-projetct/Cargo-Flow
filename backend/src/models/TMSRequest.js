const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "TMS > TMS Requests" — mirrors freight.tms.request.
//
// This model is READ-ONLY in the UI (the demo's tree and form both carry
// create="false" delete="false" edit="false"). Rows are written by the system
// when a shipment is pushed to the transport provider, never by hand — which is
// why the list has an export button and no Create.
const TMSRequest = sequelize.define('TMSRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(80), allowNull: false, comment: 'Shipment ID' },
  requestUuid: { type: DataTypes.STRING(80), allowNull: true, comment: 'Request ID' },

  providerMessageType: { type: DataTypes.STRING(60), allowNull: true, comment: 'Declaration/Emanifest' },
  requestDate: { type: DataTypes.DATE, allowNull: true },
  requestCompleteDate: { type: DataTypes.DATE, allowNull: true },
  resubmitUrl: { type: DataTypes.STRING(400), allowNull: true },

  requestedBy: { type: DataTypes.STRING(150), allowNull: true },
  requestedById: { type: DataTypes.UUID, allowNull: true },

  providerStatus: { type: DataTypes.STRING(250), allowNull: true },
  status: {
    type: DataTypes.ENUM('init', 'success', 'fail', 'invalid'),
    defaultValue: 'init',
  },

  // The document the request was raised for — the Shipment ID links through to it.
  resModel: { type: DataTypes.STRING(80), allowNull: true },
  resId: { type: DataTypes.STRING(80), allowNull: true },
  reference: { type: DataTypes.STRING(150), allowNull: true, comment: 'Record' },

  jsonPayload: { type: DataTypes.TEXT, allowNull: true },
  requestResponse: { type: DataTypes.TEXT, allowNull: true },

  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
}, {
  tableName: 'tms_requests',
});

module.exports = TMSRequest;
