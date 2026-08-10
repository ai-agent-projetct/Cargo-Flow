const models = require('../models');
const { runReport, listReports } = require('../services/reportEngine');
const { successResponse, errorResponse } = require('../utils/helpers');

// Empty date inputs arrive as '' from the form; MySQL rejects those.
const orNull = (v) => (v === '' || v === undefined ? null : v);

exports.list = async (req, res, next) => {
  try {
    return successResponse(res, listReports(), 'Reports');
  } catch (error) { return next(error); }
};

exports.run = async (req, res, next) => {
  try {
    const result = await runReport(req.params.id, {
      models,
      dateFrom: orNull(req.query.dateFrom),
      dateTo: orNull(req.query.dateTo),
      partnerId: orNull(req.query.partnerId),
    });
    if (!result) return errorResponse(res, `Unknown report '${req.params.id}'`, 404);
    return successResponse(res, result, result.title);
  } catch (error) { return next(error); }
};
