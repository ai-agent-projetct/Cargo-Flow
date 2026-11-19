// The bridge between operations charges and accounting documents.
//
// Pulling: a customer invoice takes a shipment's revenue charges that are not
// yet fully invoiced; a vendor bill takes its cost charges not yet fully
// billed, narrowed to that vendor's charges when the bill names one. Each
// invoice line remembers the charge line it came from.
//
// Posting: when the document posts, each source charge line's invoiced (or
// billed, or credited) amount moves by what the document charged, so the
// shipment's billing status, its actual margin and the outstanding reports
// all follow the documents. Cancelling or resetting a posted document moves
// them back by the same amount.

const { Op } = require('sequelize');
const { recalcLine, money } = require('./chargeRollup');

const ACCOUNTS = {
  revenue: '500001 Sales',
  cost: '501001 Cost of Services',
  receivable: '101001 Accounts Receivable',
  payable: '201001 Accounts Payable',
  vatOutput: '201005 VAT Payable',
  vatInput: '101005 VAT Receivable',
};

const CUSTOMER_TYPES = ['out_invoice', 'out_refund', 'out_debit'];
const isCustomerDoc = (moveType) => CUSTOMER_TYPES.includes(moveType);
const isRefund = (moveType) => moveType === 'out_refund' || moveType === 'in_refund';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Find the shipments, consols or service jobs a list of references names. */
const resolveParents = async (models, kind, refs) => {
  const { FFJob, MasterShipment, ServiceJob } = models;
  const list = refs.map((r) => String(r).trim()).filter(Boolean);
  if (kind === 'house') {
    const rows = await FFJob.findAll({
      where: {
        [Op.or]: [
          { id: { [Op.in]: list } },
          { jobNumber: { [Op.in]: list } },
          { hblNumber: { [Op.in]: list } },
          { hawbNumber: { [Op.in]: list } },
        ],
      },
    });
    return rows.map((r) => ({ parentType: 'house_shipment', record: r, ref: r.hblNumber || r.jobNumber }));
  }
  if (kind === 'master') {
    const rows = await MasterShipment.findAll({
      where: {
        [Op.or]: [
          { id: { [Op.in]: list } },
          { masterShipmentNumber: { [Op.in]: list } },
          { mblNumber: { [Op.in]: list } },
        ],
      },
    });
    return rows.map((r) => ({ parentType: 'master_shipment', record: r, ref: r.mblNumber || r.masterShipmentNumber }));
  }
  const rows = await ServiceJob.findAll({
    where: { [Op.or]: [{ id: { [Op.in]: list } }, { jobNumber: { [Op.in]: list } }] },
  });
  // Liner Agency jobs bill through the same "service job" source.
  const agency = models.AgencyJob ? await models.AgencyJob.findAll({
    where: { [Op.or]: [{ id: { [Op.in]: list } }, { name: { [Op.in]: list } }, { hblNumber: { [Op.in]: list } }] },
  }) : [];
  return [
    ...rows.map((r) => ({ parentType: 'service_job', record: r, ref: r.jobNumber })),
    ...agency.map((r) => ({ parentType: 'nvocc_job', record: r, ref: r.name })),
  ];
};

/**
 * Invoice lines for a draft document, built from the parents' charge lines.
 * Returns { lines, skipped } - `skipped` counts charges already settled.
 */
const buildInvoiceLines = async (models, move, parents) => {
  const { ChargeLine } = models;
  const customer = isCustomerDoc(move.moveType);
  const side = customer ? 'revenue' : 'cost';
  const invoiceCurrency = move.currency || move.companyCurrency || 'AED';
  const companyCurrency = move.companyCurrency || 'AED';
  const kindLabel = { house_shipment: 'houseShipment', master_shipment: 'masterShipment', service_job: 'serviceJob', nvocc_job: 'serviceJob' };

  const lines = [];
  let skipped = 0;
  for (const p of parents) {
    let charges = await ChargeLine.findAll({
      where: {
        parentType: p.parentType,
        parentId: p.record.id,
        isActive: true,
        side: { [Op.in]: [side, 'both'] },
      },
      order: [['sequence', 'ASC']],
    });

    // A vendor bill only carries that vendor's costs, and a customer invoice
    // only that customer's revenue, whenever the charges say who they are for.
    const partyField = customer ? 'debtorPartnerId' : 'creditorPartnerId';
    if (move.partnerId && charges.some((c) => c[partyField] === move.partnerId)) {
      charges = charges.filter((c) => c[partyField] === move.partnerId);
    }

    for (const c of charges) {
      const settled = customer
        ? (c.billingStatus === 'fully_invoiced')
        : (c.billingStatus === 'fully_billed');
      // A credit note may reverse a fully invoiced charge; anything else
      // skips what is already settled so nothing is invoiced twice.
      if (settled && !isRefund(move.moveType)) { skipped += 1; continue; }

      const qty = num(c.quantity) || 1;
      const nativeCurrency = customer ? c.sellCurrency : c.costCurrency;
      const nativeRate = num(customer ? c.sellAmountRate : c.costAmountRate);
      const fx = num(customer ? c.sellConversionRate : c.costConversionRate) || 1;
      const companyNet = num(customer ? c.totalSellAmount : c.totalCostAmount);
      const companyIncl = num(customer ? c.totalSellAmountIncl : c.totalCostAmountIncl);

      // Bill in the charge's own currency when it matches the document;
      // otherwise bill the company-currency figure.
      const native = nativeCurrency && nativeCurrency === invoiceCurrency;
      const price = native ? nativeRate : (qty ? companyNet / qty : companyNet);
      const subtotal = money(price * qty);
      const taxRate = companyNet ? Math.round(((companyIncl - companyNet) / companyNet) * 10000) / 100 : 0;
      const vatAmount = money(subtotal * (taxRate / 100));

      // What posting this line moves on the charge, in company currency.
      const residual = num(c.residualAmount);
      let companyAmount = native ? money((subtotal + vatAmount) * fx) : companyIncl;
      if (!isRefund(move.moveType) && residual > 0 && residual < companyAmount) {
        companyAmount = residual;
      }

      lines.push({
        kind: 'line',
        [kindLabel[p.parentType]]: p.ref,
        houseShipment: p.parentType === 'house_shipment' ? p.ref : '',
        product: c.chargeCode ? `[${c.chargeCode}] ${c.chargeDescription}` : c.chargeDescription,
        label: c.chargeDescription,
        account: customer ? ACCOUNTS.revenue : ACCOUNTS.cost,
        exRate: native ? fx : 1,
        amountQty: price,
        chargeCurrency: native ? nativeCurrency : companyCurrency,
        analyticAccount: '',
        analyticTags: [],
        quantity: qty,
        price,
        discount: 0,
        taxes: `VAT ${taxRate}%`,
        taxRate,
        vatAmount,
        subtotal,
        chargeLineId: c.id,
        chargeParentType: p.parentType,
        chargeParentId: p.record.id,
        companyAmount,
      });
    }
  }
  return { lines, skipped };
};

/**
 * Journal items for a posted document. Customer documents debit receivable
 * and credit sales and output VAT; vendor documents debit cost and input VAT
 * and credit payable. A refund is the mirror image of its document.
 */
const journalItemsFor = (move, number) => {
  const lines = (move.lines || []).filter((l) => (l.kind || 'line') === 'line');
  const customer = isCustomerDoc(move.moveType);
  const refund = isRefund(move.moveType);
  const tax = num(move.amountTax);
  const total = num(move.amountTotal);
  const partner = move.partner;
  const currency = move.currency;

  // [debit, credit] for the natural direction; a refund swaps them.
  const dc = (amount, naturalDebit) => {
    const debitSide = refund ? !naturalDebit : naturalDebit;
    return debitSide ? { debit: money(amount), credit: 0 } : { debit: 0, credit: money(amount) };
  };

  const items = lines.map((l) => ({
    account: l.account || (customer ? ACCOUNTS.revenue : ACCOUNTS.cost),
    label: l.label,
    partner,
    currency,
    ...dc(num(l.subtotal), !customer),
  }));
  if (tax) {
    items.push({
      account: customer ? ACCOUNTS.vatOutput : ACCOUNTS.vatInput,
      label: 'VAT',
      partner,
      currency,
      ...dc(tax, !customer),
    });
  }
  items.push({
    account: customer ? ACCOUNTS.receivable : ACCOUNTS.payable,
    label: number,
    partner,
    currency,
    ...dc(total, customer),
  });
  return items;
};

/**
 * Move each source charge line by what this document charged.
 * `direction` is +1 when the document posts and -1 when a posted document is
 * cancelled or reset to draft. Returns the parents that were touched so their
 * roll-ups can be refreshed.
 */
const applyToCharges = async (models, move, direction) => {
  const { ChargeLine } = models;
  const lines = (move.lines || []).filter((l) => l.chargeLineId);
  const touched = new Map();
  const customer = isCustomerDoc(move.moveType);
  const refund = isRefund(move.moveType);

  for (const l of lines) {
    const c = await ChargeLine.findByPk(l.chargeLineId);
    if (!c) continue;
    const amount = money(num(l.companyAmount) * direction);
    const merged = c.toJSON();
    if (refund) {
      merged.creditNoteAmount = money(num(merged.creditNoteAmount) + amount);
      merged.creditNoteQty = Math.max(0, num(merged.creditNoteQty) + direction);
    } else if (customer) {
      merged.invoicedAmount = money(Math.max(0, num(merged.invoicedAmount) + amount));
    } else {
      merged.billedAmount = money(Math.max(0, num(merged.billedAmount) + amount));
    }
    if (customer) merged.invoiceId = direction > 0 ? move.id : merged.invoiceId;
    // Billing status follows the amounts; a pro forma flag is a document
    // state, so it is cleared once a real document has posted against it.
    if (merged.billingStatus === 'pro_forma') merged.billingStatus = 'no';
    recalcLine(merged);
    await c.update(merged);
    touched.set(`${c.parentType}:${c.parentId}`, { parentType: c.parentType, parentId: c.parentId });
  }
  return [...touched.values()];
};

module.exports = {
  ACCOUNTS, resolveParents, buildInvoiceLines, journalItemsFor, applyToCharges, isCustomerDoc,
};
