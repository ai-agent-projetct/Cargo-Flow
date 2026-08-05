const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { OCRDocument } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { fileName: { [Op.like]: `%${search}%` } },
        { shipmentRef: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await OCRDocument.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'OCR documents retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const doc = await OCRDocument.findByPk(req.params.id);
    if (!doc) return errorResponse(res, 'OCR document not found', 404);
    return successResponse(res, doc, 'OCR document retrieved');
  } catch (error) {
    next(error);
  }
};

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded', 400);

    const { shipmentRef, ffJobId } = req.body;
    const filePath = `/uploads/ocr/${req.file.filename}`;

    // Simulated OCR processing - extracts a mock payload from the uploaded document.
    const ocrPayload = {
      detectedFields: {
        documentType: 'Bill of Lading',
        shipper: 'Auto-detected Shipper Pte Ltd',
        consignee: 'Auto-detected Consignee LLC',
        portOfLoading: 'Jebel Ali, AE',
        portOfDischarge: 'Singapore, SG',
      },
      confidence: 0.92,
      processedAt: new Date().toISOString(),
    };

    const doc = await OCRDocument.create({
      fileName: req.file.originalname,
      shipmentRef: shipmentRef || null,
      ffJobId: ffJobId || null,
      filePath,
      charge: 2.5,
      ocrPayload,
      createdBy: req.user.id,
    });

    return successResponse(res, doc, 'Document uploaded and processed', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const doc = await OCRDocument.findByPk(req.params.id);
    if (!doc) return errorResponse(res, 'OCR document not found', 404);
    await doc.update(req.body);
    return successResponse(res, doc, 'OCR document updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const doc = await OCRDocument.findByPk(req.params.id);
    if (!doc) return errorResponse(res, 'OCR document not found', 404);

    if (doc.filePath) {
      const fullPath = path.join(process.cwd(), doc.filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await doc.destroy();
    return successResponse(res, null, 'OCR document deleted');
  } catch (error) {
    next(error);
  }
};
