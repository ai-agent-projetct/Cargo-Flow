const aiService = require('../services/aiService');
const analytics = require('../services/aiAnalyticsService');
const documentAI = require('../services/aiDocumentService');
const { successResponse, errorResponse } = require('../utils/helpers');

exports.status = async (req, res) => successResponse(res, {
  configured: aiService.isConfigured(),
  provider: aiService.providerName(),
  model: aiService.activeModel(),
  tools: [...aiService.READ_TOOLS, ...aiService.WRITE_TOOLS].map((t) => ({ name: t.name, description: t.description })),
}, 'AI status');

exports.chat = async (req, res, next) => {
  try {
    const { messages, allowWrites } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse(res, 'messages array is required', 400);
    }
    // Writes stay off unless the client explicitly opts in for this request,
    // which the UI only does after the user confirms the change.
    const result = await aiService.chat({ messages, allowWrites: allowWrites === true });
    return successResponse(res, result, 'AI response');
  } catch (error) {
    next(error);
  }
};

exports.insights = async (req, res, next) => {
  try {
    return successResponse(res, await analytics.summary(), 'Insights computed');
  } catch (error) {
    next(error);
  }
};

exports.insightsByType = async (req, res, next) => {
  try {
    const fn = {
      'margin-forecast': analytics.marginForecast,
      'eta-slippage': analytics.etaSlippage,
      'credit-risk': analytics.creditRisk,
      'charge-anomalies': analytics.chargeAnomalies,
    }[req.params.type];
    if (!fn) return errorResponse(res, 'Unknown insight type', 404);
    return successResponse(res, await fn(), 'Insight computed');
  } catch (error) {
    next(error);
  }
};

exports.extractDocument = async (req, res, next) => {
  try {
    const { fileBase64, mimeType, filename } = req.body;
    if (!fileBase64 || !mimeType) {
      return errorResponse(res, 'fileBase64 and mimeType are required', 400);
    }
    const result = await documentAI.extractDocument({
      file: { data: Buffer.from(fileBase64, 'base64'), mimeType },
      filename,
    });
    if (result.error) return errorResponse(res, result.error, result.configured === false ? 503 : 422);
    return successResponse(res, result.data, 'Document extracted');
  } catch (error) {
    next(error);
  }
};
