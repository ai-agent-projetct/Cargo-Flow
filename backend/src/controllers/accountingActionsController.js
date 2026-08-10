const { Op } = require('sequelize');
const { AccountMove, AccountPayment, AppSetting } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

const CUSTOMER_TYPES = ['out_invoice', 'out_refund', 'out_debit'];
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Reconciliation ──────────────────────────────────────────────────────────
// Show what is still open on both sides so a payment can be matched to the
// invoice it settles.
exports.reconciliation = async (req, res, next) => {
  try {
    const [openInvoices, openPayments] = await Promise.all([
      AccountMove.findAll({
        where: {
          moveType: { [Op.in]: CUSTOMER_TYPES },
          state: 'posted',
          paymentState: { [Op.in]: ['not_paid', 'partial'] },
        },
        order: [['invoiceDate', 'ASC']],
        limit: 200,
      }),
      AccountPayment.findAll({
        where: { state: 'posted', paymentType: 'inbound' },
        order: [['paymentDate', 'ASC']],
        limit: 200,
      }),
    ]);

    return successResponse(res, {
      invoices: openInvoices.map((m) => ({
        id: m.id, name: m.name, partner: m.partner, partnerId: m.partnerId,
        date: m.invoiceDate, dueDate: m.invoiceDateDue,
        total: round(m.amountTotal), residual: round(m.amountResidual || m.amountTotal),
        currency: m.currency,
      })),
      payments: openPayments.map((p) => ({
        id: p.id, name: p.name, partner: p.partner, partnerId: p.partnerId,
        date: p.paymentDate, amount: round(p.amount), currency: p.currency,
        journal: p.journal,
      })),
    }, 'Reconciliation');
  } catch (error) { return next(error); }
};

// Match one payment against one invoice. Partial settlement leaves the invoice
// open with a reduced residual, which is what the payment status reflects.
exports.reconcile = async (req, res, next) => {
  try {
    const { paymentId, moveId } = req.body;
    const payment = await AccountPayment.findByPk(paymentId);
    const move = await AccountMove.findByPk(moveId);
    if (!payment || !move) return errorResponse(res, 'Payment or invoice not found', 404);
    if (payment.state !== 'posted') return errorResponse(res, 'Only a posted payment can be reconciled', 400);
    if (move.state !== 'posted') return errorResponse(res, 'Only a posted invoice can be reconciled', 400);

    const residual = round(move.amountResidual || move.amountTotal);
    const applied = Math.min(round(payment.amount), residual);
    const left = round(residual - applied);

    await move.update({
      amountResidual: left,
      paymentState: left <= 0 ? 'paid' : 'partial',
    });
    await payment.update({
      state: 'reconciled',
      invoiceNumbers: [...new Set([...(payment.invoiceNumbers || []), move.name])],
    });

    return successResponse(res, {
      applied, remaining: left, move: move.name, payment: payment.name,
    }, `Reconciled ${payment.name} against ${move.name}`);
  } catch (error) { return next(error); }
};

// ── Lock dates ──────────────────────────────────────────────────────────────
const LOCK_KEYS = ['fiscalYearLockDate', 'taxLockDate', 'salesLockDate', 'purchaseLockDate'];

exports.getLockDates = async (req, res, next) => {
  try {
    const rows = await AppSetting.findAll({ where: { category: 'accounting-lock' } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return successResponse(res, Object.fromEntries(LOCK_KEYS.map((k) => [k, byKey[k] || ''])), 'Lock dates');
  } catch (error) { return next(error); }
};

exports.setLockDates = async (req, res, next) => {
  try {
    for (const key of LOCK_KEYS) {
      if (req.body[key] === undefined) continue;
      const value = req.body[key] || '';
      const [row, created] = await AppSetting.findOrCreate({
        where: { category: 'accounting-lock', key },
        defaults: { category: 'accounting-lock', key, value, kind: 'date' },
      });
      if (!created) await row.update({ value });
    }
    return exports.getLockDates(req, res, next);
  } catch (error) { return next(error); }
};

// ── Import statement ────────────────────────────────────────────────────────
// Accepts parsed rows from the client and raises a draft payment per line, so
// an imported statement lands in the same Payments list as everything else.
exports.importStatement = async (req, res, next) => {
  try {
    const { journal, lines } = req.body;
    if (!Array.isArray(lines) || !lines.length) {
      return errorResponse(res, 'No statement lines to import', 400);
    }

    const created = [];
    for (const l of lines) {
      const amount = Number(l.amount || 0);
      if (!amount) continue;
      created.push(await AccountPayment.create({
        name: '/',
        // A credit on the statement is money in; a debit is money out.
        paymentType: amount >= 0 ? 'inbound' : 'outbound',
        paymentDate: l.date || null,
        journal: journal || 'Bank',
        paymentMethod: 'Manual',
        partner: l.partner || '',
        memo: l.label || l.reference || 'Imported statement line',
        amount: Math.abs(amount),
        currency: l.currency || 'AED',
        state: 'draft',
        company: 'SearatesERP (Dubai)',
      }));
    }

    return successResponse(res, {
      imported: created.length,
      payments: created.map((p) => ({ id: p.id, amount: p.amount, partner: p.partner })),
    }, `Imported ${created.length} statement lines`, 201);
  } catch (error) { return next(error); }
};
