// Charge-line arithmetic: line totals, margin, tax, billing status, and the
// roll-up onto the owning quote / shipment / service job.
//
// Every money figure is stored twice: in the charge's own currency and
// converted to company currency via the line's conversion rate. Reports and
// P&L only ever read the converted figures, so a multi-currency job still
// totals correctly.

const { computeChargeable, quantityForBasis, round } = require('./chargeableWeight');

const num = (v, fallback = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
};

const money = (v) => {
  const f = 100;
  return Math.round((num(v) + Number.EPSILON) * f) / f;
};

/**
 * Sum of tax percentages that are added on top of the net amount.
 * `includedInPrice` taxes are already inside the rate, so they add nothing.
 * @param {{name?:string, percent?:number, includedInPrice?:boolean}[]} taxes
 */
const taxAmount = (netAmount, taxes) => {
  if (!Array.isArray(taxes) || !taxes.length) return 0;
  const pct = taxes
    .filter((t) => t && !t.includedInPrice)
    .reduce((s, t) => s + num(t.percent ?? t.amount), 0);
  return money((num(netAmount) * pct) / 100);
};

/**
 * Sell rate implied by a cost rate plus a margin instruction.
 * Returns null when the line is not margin-driven, so a hand-entered sell
 * rate is never silently overwritten.
 */
const sellRateFromMargin = (line) => {
  if (!line || !line.useMargin) return null;
  const cost = num(line.costAmountRate);
  if (line.marginType === 'percentage') {
    return money(cost * (1 + num(line.marginPercentage) / 100));
  }
  if (line.marginType === 'amount') {
    return money(cost + num(line.marginAmount));
  }
  return null;
};

/**
 * Recompute one charge line in place and return it.
 *
 * Quantity comes from the measurement basis when cargo figures are supplied,
 * so changing a shipment's weight reprices every per-kg charge on it without
 * anyone retyping quantities.
 *
 * @param {object} line a ChargeLine instance or plain object
 * @param {object} [cargo] cargo context: transportMode, shipmentType,
 *        grossWeight, volume, packages, containerCount, truckCount, divisor
 */
const recalcLine = (line, cargo = null) => {
  if (!line) return line;

  let figures = null;
  if (cargo) {
    figures = computeChargeable({
      transportMode: cargo.transportMode || line.transportMode,
      shipmentType: cargo.shipmentType,
      grossWeight: cargo.grossWeight,
      volume: cargo.volume,
      packages: cargo.packages,
      divisor: cargo.divisor ?? cargo.volumetricDivisor,
      roadKgPerM3: cargo.roadKgPerM3,
      containerCount: cargo.containerCount,
      truckCount: cargo.truckCount,
    });
    line.chargeableWeight = figures.chargeableWeight;
    // Only a basis-driven line gets its quantity rewritten. A line with no
    // measurement basis keeps whatever quantity was entered.
    if (line.measurementBasis) {
      line.quantity = round(
        quantityForBasis(line.measurementBasis, figures, {
          containerCount: cargo.containerCount,
          truckCount: cargo.truckCount,
          packageCount: cargo.packUnit ?? cargo.packageCount,
          netWeight: cargo.netWeight,
          quantity: line.quantity,
        }),
      );
    }
  }

  const qty = num(line.quantity, 1);
  const costRate = num(line.costAmountRate);
  const derivedSell = sellRateFromMargin(line);
  if (derivedSell != null) line.sellAmountRate = derivedSell;
  const sellRate = num(line.sellAmountRate);

  const costFx = num(line.costConversionRate, 1) || 1;
  const sellFx = num(line.sellConversionRate, 1) || 1;

  const netCost = money(qty * costRate);
  const netSell = money(qty * sellRate);

  // Company-currency figures - what every report and the P&L read.
  line.totalCostAmount = money(netCost * costFx);
  line.totalSellAmount = money(netSell * sellFx);
  line.totalCostAmountIncl = money(
    line.totalCostAmount + taxAmount(line.totalCostAmount, line.supplierTaxes),
  );
  line.totalSellAmountIncl = money(
    line.totalSellAmount + taxAmount(line.totalSellAmount, line.taxes),
  );
  line.companyCurrencyAmount = line.side === 'cost'
    ? line.totalCostAmount
    : line.totalSellAmount;

  line.estimatedMargin = money(line.totalSellAmount - line.totalCostAmount);
  line.estimatedMarginPercentage = line.totalSellAmount
    ? round((line.estimatedMargin / line.totalSellAmount) * 100, 4)
    : 0;

  // Chargeable-weight unit economics, used by the profitability reports.
  const cw = num(line.chargeableWeight);
  line.totalCostAmountChargeable = cw ? round(line.totalCostAmount / cw, 4) : 0;
  line.totalSellAmountChargeable = cw ? round(line.totalSellAmount / cw, 4) : 0;

  recalcBillingStatus(line);
  return line;
};

/**
 * Billing status and residual for a line, from what has actually been
 * billed/invoiced against it. Credit notes reduce the billed figure.
 */
const recalcBillingStatus = (line) => {
  const isCost = line.side === 'cost';
  const target = isCost ? num(line.totalCostAmountIncl) : num(line.totalSellAmountIncl);
  const settledGross = isCost ? num(line.billedAmount) : num(line.invoicedAmount);
  const settled = money(settledGross - num(line.creditNoteAmount));

  line.residualAmount = money(Math.max(0, target - settled));

  if (line.billingStatus === 'pro_forma' || line.billingStatus === 'pro_forma_cancel') {
    // A pro forma is not a posted document; leave the flag for the UI and do
    // not promote it to billed.
    return line;
  }
  if (settled <= 0) {
    line.billingStatus = 'no';
  } else if (line.residualAmount > 0.009) {
    line.billingStatus = 'partial';
  } else {
    line.billingStatus = isCost ? 'fully_billed' : 'fully_invoiced';
  }
  return line;
};

/**
 * Roll a set of charge lines up into the figures a quote / shipment / job
 * header shows. `revenue` counts lines that can sell ('revenue' or 'both'),
 * `cost` counts lines that can buy ('cost' or 'both').
 */
const rollup = (lines = []) => {
  const out = {
    estimatedRevenue: 0,
    estimatedCost: 0,
    estimatedMargin: 0,
    estimatedMarginPercentage: 0,
    // `receivedRevenue` and `paidCost` are the actuals the job cost sheet
    // compares against the estimates, so they must be the same kind of
    // figure on both sides: what has been invoiced out, and what has been
    // billed in. Reading cash receipts on one side and vendor bills on the
    // other made every margin wrong by the amount outstanding.
    receivedRevenue: 0,
    paidCost: 0,
    receivedMargin: 0,
    receivedMarginPercentage: 0,
    // Cash actually collected, which lags invoicing. Kept separate so the
    // collections view can show it without disturbing the margin.
    cashReceived: 0,
    dueRevenue: 0,
    dueCost: 0,
    revenueLineCount: 0,
    costLineCount: 0,
    revenueStatus: 'no',
    costStatus: 'no',
  };

  const revenueLines = [];
  const costLines = [];

  for (const l of lines) {
    if (!l || l.isActive === false) continue;
    const side = l.side || 'both';
    if (side === 'revenue' || side === 'both') {
      revenueLines.push(l);
      out.estimatedRevenue += num(l.totalSellAmountIncl) || num(l.totalSellAmount);
      out.receivedRevenue += num(l.invoicedAmount);
      out.cashReceived += num(l.receivedAmount);
      out.dueRevenue += side === 'revenue' ? num(l.residualAmount) : 0;
    }
    if (side === 'cost' || side === 'both') {
      costLines.push(l);
      out.estimatedCost += num(l.totalCostAmountIncl) || num(l.totalCostAmount);
      out.paidCost += num(l.billedAmount);
      out.dueCost += side === 'cost' ? num(l.residualAmount) : 0;
    }
  }

  out.estimatedRevenue = money(out.estimatedRevenue);
  out.estimatedCost = money(out.estimatedCost);
  out.receivedRevenue = money(out.receivedRevenue);
  out.cashReceived = money(out.cashReceived);
  out.paidCost = money(out.paidCost);
  out.dueRevenue = money(out.dueRevenue);
  out.dueCost = money(out.dueCost);

  out.estimatedMargin = money(out.estimatedRevenue - out.estimatedCost);
  out.estimatedMarginPercentage = out.estimatedRevenue
    ? round((out.estimatedMargin / out.estimatedRevenue) * 100, 4)
    : 0;
  out.receivedMargin = money(out.receivedRevenue - out.paidCost);
  out.receivedMarginPercentage = out.receivedRevenue
    ? round((out.receivedMargin / out.receivedRevenue) * 100, 4)
    : 0;

  out.revenueLineCount = revenueLines.length;
  out.costLineCount = costLines.length;
  out.revenueStatus = aggregateStatus(revenueLines, 'fully_invoiced');
  out.costStatus = aggregateStatus(costLines, 'fully_billed');
  return out;
};

const aggregateStatus = (lines, doneValue) => {
  if (!lines.length) return 'no';
  const statuses = lines.map((l) => l.billingStatus || 'no');
  if (statuses.every((s) => s === doneValue)) return doneValue;
  if (statuses.every((s) => s === 'no')) return 'no';
  return 'partial';
};

/**
 * Split a 'both' quote line into the cost and revenue charges a shipment or
 * service job needs. Returns the two payloads, cross-linked by convention -
 * the caller sets the real ids after insert.
 */
const splitQuoteLine = (quoteLine, parent) => {
  const shared = {
    parentType: parent.parentType,
    parentId: parent.parentId,
    sequence: quoteLine.sequence,
    productId: quoteLine.productId,
    chargeCode: quoteLine.chargeCode,
    serviceName: quoteLine.serviceName,
    chargeDescription: quoteLine.chargeDescription,
    uom: quoteLine.uom,
    quantity: quoteLine.quantity,
    measurementBasis: quoteLine.measurementBasis,
    containerType: quoteLine.containerType,
    chargeableWeight: quoteLine.chargeableWeight,
    quoteLineId: quoteLine.id,
    multimodalLineId: quoteLine.multimodalLineId,
    transportMode: quoteLine.transportMode,
    modeTypeSequence: quoteLine.modeTypeSequence,
    originPortId: quoteLine.originPortId,
    destinationPortId: quoteLine.destinationPortId,
    originCountry: quoteLine.originCountry,
    destinationCountry: quoteLine.destinationCountry,
    carrierId: quoteLine.carrierId,
    incotermId: quoteLine.incotermId,
    carrierServiceType: quoteLine.carrierServiceType,
    transitTime: quoteLine.transitTime,
    dueBy: quoteLine.dueBy,
    chargeType: quoteLine.chargeType,
    companyId: quoteLine.companyId,
    chargeSource: quoteLine.chargeSource || 'erp',
  };

  const cost = recalcLine({
    ...shared,
    side: 'cost',
    costCurrency: quoteLine.costCurrency,
    costConversionRate: quoteLine.costConversionRate,
    costAmountRate: quoteLine.costAmountRate,
    creditorPartnerId: quoteLine.creditorPartnerId,
    creditorAddressId: quoteLine.creditorAddressId,
    costRemarks: quoteLine.costRemarks,
    supplierTaxes: quoteLine.supplierTaxes,
    currency: quoteLine.costCurrency,
  });

  const revenue = recalcLine({
    ...shared,
    side: 'revenue',
    sellCurrency: quoteLine.sellCurrency,
    sellConversionRate: quoteLine.sellConversionRate,
    sellAmountRate: quoteLine.sellAmountRate,
    debtorPartnerId: quoteLine.debtorPartnerId || parent.clientId,
    debtorAddressId: quoteLine.debtorAddressId,
    sellRemarks: quoteLine.sellRemarks,
    taxes: quoteLine.taxes,
    currency: quoteLine.sellCurrency,
  });

  return { cost, revenue };
};

module.exports = {
  taxAmount,
  sellRateFromMargin,
  recalcLine,
  recalcBillingStatus,
  rollup,
  splitQuoteLine,
  money,
};

// --- self-check -------------------------------------------------------------
// node src/services/chargeRollup.js
if (require.main === module) {
  const assert = require('assert');

  // Straight line: 5 units, buy 100, sell 150.
  let l = recalcLine({
    side: 'both', quantity: 5, costAmountRate: 100, sellAmountRate: 150,
  });
  assert.strictEqual(l.totalCostAmount, 500);
  assert.strictEqual(l.totalSellAmount, 750);
  assert.strictEqual(l.estimatedMargin, 250);
  assert.strictEqual(l.estimatedMarginPercentage, 33.3333);

  // UAE VAT 5% on the sell side only.
  l = recalcLine({
    side: 'both', quantity: 1, costAmountRate: 1000, sellAmountRate: 2000,
    taxes: [{ name: 'VAT 5%', percent: 5 }],
  });
  assert.strictEqual(l.totalSellAmountIncl, 2100);
  assert.strictEqual(l.totalCostAmountIncl, 1000);

  // A tax already inside the price adds nothing.
  assert.strictEqual(taxAmount(1000, [{ percent: 5, includedInPrice: true }]), 0);

  // Multi-currency: 1000 USD at 3.6725 -> AED.
  l = recalcLine({
    side: 'revenue', quantity: 1, sellAmountRate: 1000,
    sellCurrency: 'USD', sellConversionRate: 3.6725,
  });
  assert.strictEqual(l.totalSellAmount, 3672.5);

  // Margin-driven sell rate, percentage.
  l = recalcLine({
    side: 'both', quantity: 2, costAmountRate: 500,
    useMargin: true, marginType: 'percentage', marginPercentage: 20,
  });
  assert.strictEqual(l.sellAmountRate, 600);
  assert.strictEqual(l.totalSellAmount, 1200);

  // Margin-driven sell rate, flat amount.
  l = recalcLine({
    side: 'both', quantity: 1, costAmountRate: 500,
    useMargin: true, marginType: 'amount', marginAmount: 125,
  });
  assert.strictEqual(l.sellAmountRate, 625);

  // A hand-entered sell rate survives when useMargin is off.
  l = recalcLine({ side: 'both', quantity: 1, costAmountRate: 500, sellAmountRate: 999 });
  assert.strictEqual(l.sellAmountRate, 999);

  // Quantity driven by measurement basis: air 1:6000 on 2 m3 / 100 kg.
  l = recalcLine(
    { side: 'both', measurementBasis: 'Chargeable Weight', costAmountRate: 2, sellAmountRate: 3 },
    { transportMode: 'AIR', grossWeight: 100, volume: 2 },
  );
  assert.strictEqual(l.quantity, 333.333);
  assert.strictEqual(l.chargeableWeight, 333.333);
  assert.strictEqual(l.totalSellAmount, 1000);

  // Per-shipment charge ignores cargo size.
  l = recalcLine(
    { side: 'revenue', measurementBasis: 'Per Shipment', sellAmountRate: 250 },
    { transportMode: 'AIR', grossWeight: 5000, volume: 40 },
  );
  assert.strictEqual(l.quantity, 1);
  assert.strictEqual(l.totalSellAmount, 250);

  // Billing status walks no -> partial -> fully_invoiced.
  l = recalcLine({ side: 'revenue', quantity: 1, sellAmountRate: 1000 });
  assert.strictEqual(l.billingStatus, 'no');
  l.invoicedAmount = 400; recalcBillingStatus(l);
  assert.strictEqual(l.billingStatus, 'partial');
  assert.strictEqual(l.residualAmount, 600);
  l.invoicedAmount = 1000; recalcBillingStatus(l);
  assert.strictEqual(l.billingStatus, 'fully_invoiced');
  assert.strictEqual(l.residualAmount, 0);

  // A credit note reopens the line.
  l.creditNoteAmount = 250; recalcBillingStatus(l);
  assert.strictEqual(l.billingStatus, 'partial');
  assert.strictEqual(l.residualAmount, 250);

  // Over-invoicing must not produce a negative residual.
  l = recalcLine({ side: 'revenue', quantity: 1, sellAmountRate: 200, invoicedAmount: 900 });
  assert.strictEqual(l.residualAmount, 0);
  assert.strictEqual(l.billingStatus, 'fully_invoiced');

  // Roll-up across mixed sides.
  const lines = [
    recalcLine({ side: 'cost', quantity: 1, costAmountRate: 800 }),
    recalcLine({ side: 'revenue', quantity: 1, sellAmountRate: 1200 }),
    recalcLine({ side: 'revenue', quantity: 1, sellAmountRate: 300, invoicedAmount: 300 }),
  ];
  let r = rollup(lines);
  assert.strictEqual(r.estimatedRevenue, 1500);
  assert.strictEqual(r.estimatedCost, 800);
  assert.strictEqual(r.estimatedMargin, 700);
  assert.strictEqual(r.revenueLineCount, 2);
  assert.strictEqual(r.costLineCount, 1);
  assert.strictEqual(r.revenueStatus, 'partial');
  assert.strictEqual(r.costStatus, 'no');
  // Actuals are invoiced vs billed, the same kind of figure on both sides.
  assert.strictEqual(r.receivedRevenue, 300);
  assert.strictEqual(r.paidCost, 0);
  assert.strictEqual(r.receivedMargin, 300);
  // Cash collected is tracked apart from invoicing and lags it.
  assert.strictEqual(r.cashReceived, 0);

  // A fully invoiced job with nothing yet billed shows the full revenue as
  // the actual, not zero - that was the bug this pair of fields had.
  r = rollup([
    recalcLine({ side: 'revenue', quantity: 1, sellAmountRate: 1000, invoicedAmount: 1000 }),
    recalcLine({ side: 'cost', quantity: 1, costAmountRate: 600, billedAmount: 600 }),
  ]);
  assert.strictEqual(r.receivedRevenue, 1000);
  assert.strictEqual(r.paidCost, 600);
  assert.strictEqual(r.receivedMargin, 400);
  assert.strictEqual(r.receivedMarginPercentage, 40);

  // A 'both' quote line counts once on each side, not twice on one.
  r = rollup([recalcLine({ side: 'both', quantity: 1, costAmountRate: 100, sellAmountRate: 160 })]);
  assert.strictEqual(r.estimatedRevenue, 160);
  assert.strictEqual(r.estimatedCost, 100);
  assert.strictEqual(r.estimatedMargin, 60);

  // Inactive lines are excluded.
  r = rollup([recalcLine({ side: 'revenue', quantity: 1, sellAmountRate: 500, isActive: false })]);
  assert.strictEqual(r.estimatedRevenue, 0);

  // Empty roll-up is zeroed, not NaN.
  r = rollup([]);
  assert.strictEqual(r.estimatedMarginPercentage, 0);
  assert.strictEqual(r.revenueStatus, 'no');

  // Splitting a quote line keeps buy on the cost charge and sell on the
  // revenue charge, and never leaks one side into the other.
  const { cost, revenue } = splitQuoteLine({
    id: 'ql-1', sequence: 10, chargeDescription: 'Ocean Freight',
    quantity: 2, costAmountRate: 400, sellAmountRate: 650,
    costCurrency: 'USD', costConversionRate: 3.6725,
    sellCurrency: 'AED', sellConversionRate: 1,
    creditorPartnerId: 'vendor-1', taxes: [{ percent: 5 }],
  }, { parentType: 'house_shipment', parentId: 'hs-1', clientId: 'cust-1' });
  assert.strictEqual(cost.side, 'cost');
  assert.strictEqual(cost.totalCostAmount, 2938);
  assert.strictEqual(cost.totalSellAmount, 0);
  assert.strictEqual(cost.creditorPartnerId, 'vendor-1');
  assert.strictEqual(revenue.side, 'revenue');
  assert.strictEqual(revenue.totalSellAmount, 1300);
  assert.strictEqual(revenue.totalSellAmountIncl, 1365);
  assert.strictEqual(revenue.totalCostAmount, 0);
  assert.strictEqual(revenue.debtorPartnerId, 'cust-1');
  assert.strictEqual(revenue.quoteLineId, 'ql-1');

  console.log('chargeRollup self-check OK');
}
