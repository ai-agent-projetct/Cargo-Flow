const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { User, Company } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/emailService');

const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
};

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', 422, errors.array());
    }

    const { name, email, password, role = 'user', phone, companyId } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return errorResponse(res, 'Email already registered', 409);
    }

    const user = await User.create({ name, email, password, role, phone, companyId });
    const { accessToken, refreshToken } = generateTokens(user);

    await user.update({ refreshToken });
    await sendWelcomeEmail(user).catch(() => {});

    return successResponse(res, { user, accessToken, refreshToken }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', 422, errors.array());
    }

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email }, include: [{ association: 'company' }] });

    if (!user || !(await user.comparePassword(password))) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (user.status !== 'active') {
      return errorResponse(res, 'Account is inactive or suspended', 403);
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await user.update({ refreshToken, lastLogin: new Date() });

    return successResponse(res, { user, accessToken, refreshToken }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorResponse(res, 'Refresh token required', 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch {
      return errorResponse(res, 'Invalid or expired refresh token', 401);
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    const tokens = generateTokens(user);
    await user.update({ refreshToken: tokens.refreshToken });

    return successResponse(res, tokens, 'Tokens refreshed successfully');
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await req.user.update({ refreshToken: null });
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ association: 'company' }],
    });
    return successResponse(res, user, 'Profile retrieved');
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (req.file) {
      updateData.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await req.user.update(updateData);
    const updated = await User.findByPk(req.user.id, { include: [{ association: 'company' }] });
    return successResponse(res, updated, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!(await user.comparePassword(currentPassword))) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    await user.update({ password: newPassword });
    return successResponse(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return successResponse(res, null, 'If that email exists, a reset link has been sent');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.update({ resetPasswordToken: resetToken, resetPasswordExpires: resetExpires });
    await sendPasswordResetEmail(user, resetToken).catch(() => {});

    return successResponse(res, null, 'If that email exists, a reset link has been sent');
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const { Op } = require('sequelize');

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return errorResponse(res, 'Invalid or expired reset token', 400);
    }

    await user.update({
      password: newPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    return successResponse(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};
