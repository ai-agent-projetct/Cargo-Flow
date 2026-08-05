const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config/constants');

/**
 * Build pagination object
 */
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(parseInt(query.limit) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Build pagination metadata
 */
const getPaginationMeta = (count, page, limit) => {
  const totalPages = Math.ceil(count / limit);
  return {
    total: count,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/**
 * Success response helper
 */
const successResponse = (res, data, message = 'Success', statusCode = 200, pagination = null) => {
  const response = { success: true, message, data };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

/**
 * Error response helper
 */
const errorResponse = (res, message = 'Error occurred', statusCode = 400, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Build Sequelize where clause from query filters
 */
const buildSearchConditions = (query, searchFields) => {
  const { Op } = require('sequelize');
  const conditions = {};

  if (query.search && searchFields.length > 0) {
    conditions[Op.or] = searchFields.map((field) => ({
      [field]: { [Op.like]: `%${query.search}%` },
    }));
  }

  return conditions;
};

/**
 * Format currency
 */
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

/**
 * Generate reference number
 */
const generateRefNumber = (prefix, length = 6) => {
  const random = Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${random}`;
};

/**
 * Calculate days between dates
 */
const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
};

/**
 * Check if date is overdue
 */
const isOverdue = (dueDate) => {
  return new Date(dueDate) < new Date();
};

/**
 * Sanitize filename
 */
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Parse sort query parameter
 */
const parseSortQuery = (sortQuery, allowedFields, defaultField = 'createdAt', defaultOrder = 'DESC') => {
  if (!sortQuery) return [[defaultField, defaultOrder]];

  const [field, order] = sortQuery.split(':');
  const sanitizedField = allowedFields.includes(field) ? field : defaultField;
  const sanitizedOrder = ['ASC', 'DESC'].includes(order?.toUpperCase()) ? order.toUpperCase() : defaultOrder;

  return [[sanitizedField, sanitizedOrder]];
};

/**
 * Capitalize first letter
 */
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Deep merge objects
 */
const deepMerge = (target, source) => {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};

const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);

module.exports = {
  getPagination,
  getPaginationMeta,
  successResponse,
  errorResponse,
  buildSearchConditions,
  formatCurrency,
  generateRefNumber,
  daysBetween,
  isOverdue,
  sanitizeFilename,
  parseSortQuery,
  capitalize,
  deepMerge,
};
