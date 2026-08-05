const path = require('path');
const fs = require('fs');
const { Document, Shipment, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'uploader', attributes: ['id', 'name', 'email'] },
  { association: 'shipment', attributes: ['id', 'shipmentNumber'] },
  { association: 'customer', attributes: ['id', 'companyName'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { shipmentId, jobId, quotationId, customerId, documentType } = req.query;

    const where = {};
    if (shipmentId) where.shipmentId = shipmentId;
    if (jobId) where.jobId = jobId;
    if (quotationId) where.quotationId = quotationId;
    if (customerId) where.customerId = customerId;
    if (documentType) where.documentType = documentType;

    const { count, rows } = await Document.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Documents retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id, { include: getIncludes() });
    if (!doc) return errorResponse(res, 'Document not found', 404);
    return successResponse(res, doc, 'Document retrieved');
  } catch (error) {
    next(error);
  }
};

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded', 400);

    const { shipmentId, jobId, quotationId, customerId, documentType, description, referenceNumber, expiryDate, isConfidential } = req.body;

    const subDir = req.uploadSubDir || 'general';
    const filePath = `/uploads/${subDir}/${req.file.filename}`;

    const doc = await Document.create({
      shipmentId: shipmentId || null,
      jobId: jobId || null,
      quotationId: quotationId || null,
      customerId: customerId || null,
      documentType: documentType || 'other',
      name: req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      filePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      description,
      referenceNumber,
      expiryDate: expiryDate || null,
      isConfidential: isConfidential === 'true' || isConfidential === true,
      uploadedBy: req.user.id,
    });

    if (req.io && shipmentId) {
      req.io.emit('document:uploaded', { shipmentId, documentId: doc.id, type: doc.documentType });
    }

    const result = await Document.findByPk(doc.id, { include: getIncludes() });
    return successResponse(res, result, 'Document uploaded', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return errorResponse(res, 'Document not found', 404);
    await doc.update(req.body);
    return successResponse(res, doc, 'Document updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return errorResponse(res, 'Document not found', 404);

    // Delete file from disk
    const fullPath = path.join(process.cwd(), doc.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await doc.destroy();
    return successResponse(res, null, 'Document deleted');
  } catch (error) {
    next(error);
  }
};

exports.download = async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return errorResponse(res, 'Document not found', 404);

    const fullPath = path.join(process.cwd(), doc.filePath);
    if (!fs.existsSync(fullPath)) {
      return errorResponse(res, 'File not found on server', 404);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}"`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    return res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
};
