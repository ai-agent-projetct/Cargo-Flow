const { Op } = require('sequelize');
const { Notification } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { isRead, type } = req.query;

    const where = { userId: req.user.id };
    if (isRead !== undefined) where.isRead = isRead === 'true';
    if (type) where.type = type;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const unreadCount = await Notification.count({ where: { userId: req.user.id, isRead: false } });

    return successResponse(res, { notifications: rows, unreadCount }, 'Notifications retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notification) return errorResponse(res, 'Notification not found', 404);

    await notification.update({ isRead: true, readAt: new Date() });
    return successResponse(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notification) return errorResponse(res, 'Notification not found', 404);
    await notification.destroy();
    return successResponse(res, null, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};

exports.deleteAll = async (req, res, next) => {
  try {
    await Notification.destroy({ where: { userId: req.user.id, isRead: true } });
    return successResponse(res, null, 'Read notifications cleared');
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.count({ where: { userId: req.user.id, isRead: false } });
    return successResponse(res, { count }, 'Unread count');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    // Admin only: create notifications for users
    const { userId, type, title, message, referenceId, referenceType, priority } = req.body;
    const notification = await Notification.create({
      userId, type, title, message, referenceId, referenceType, priority,
    });

    if (req.io) {
      req.io.to(`user:${userId}`).emit('notification:new', notification);
    }

    return successResponse(res, notification, 'Notification created', 201);
  } catch (error) {
    next(error);
  }
};
