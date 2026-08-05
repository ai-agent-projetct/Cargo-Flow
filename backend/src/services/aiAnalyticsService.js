const { Op, fn, col } = require('sequelize');
const { FFJob, Organization, Invoice, Consolidation } = require('../models');

// Predictive/analytics computations over historical CargoFlo data. These are
// deterministic (no model call) so they're cheap to run on every dashboard load;
// the AI assistant reads them through the `insights` tool when asked to explain
// or prioritise what they surface.

const num = (v) => Number(v || 0);
const round = (v) => Math.round(v * 100) / 100;

// FFJob money lives in a single JSON column:
// {estReceivable, actReceivable, estPayable, actPayable, estMargin, actMargin}
const rev = (job) => num((job.revenue || {}).estReceivable);
const cost = (job) => num((job.revenue || {}).estPayable);

// Margin forecast: per-transport-mode realised margin on completed jobs, applied
// to the open pipeline to project where it lands.
const marginForecast = async () => {
  const jobs = await FFJob.findAll({
    attributes: ['transportMode', 'status', 'revenue'],
    raw: true,
  });

  const byMode = {};
  for (const j of jobs) {
    const mode = j.transportMode || 'UNKNOWN';
    byMode[mode] = byMode[mode] || { mode, closedRevenue: 0, closedCost: 0, openRevenue: 0, openCost: 0, closed: 0, open: 0 };
    const bucket = byMode[mode];
    const isClosed = ['completed', 'accounting_closure'].includes(j.status);
    if (isClosed) {
      bucket.closedRevenue += rev(j);
      bucket.closedCost += cost(j);
      bucket.closed += 1;
    } else if (j.status !== 'cancelled') {
      bucket.openRevenue += rev(j);
      bucket.openCost += cost(j);
      bucket.open += 1;
    }
  }

  return Object.values(byMode).map((b) => {
    const realisedMargin = b.closedRevenue > 0 ? (b.closedRevenue - b.closedCost) / b.closedRevenue : null;
    const pipelineMargin = b.openRevenue - b.openCost;
    return {
      mode: b.mode,
      closedJobs: b.closed,
      openJobs: b.open,
      realisedMarginPct: realisedMargin === null ? null : round(realisedMargin * 100),
      openPipelineRevenue: round(b.openRevenue),
      openPipelineMargin: round(pipelineMargin),
      // Project the open pipeline at the mode's own realised rate, falling back
      // to its booked margin when there's no closed history to learn from.
      forecastMargin: realisedMargin === null ? round(pipelineMargin) : round(b.openRevenue * realisedMargin),
    };
  }).sort((a, b) => b.openPipelineRevenue - a.openPipelineRevenue);
};

// ETA slippage: jobs sitting in a pre-arrival state past their ETA, ranked by
// how far overdue they are.
const etaSlippage = async () => {
  const PRE_ARRIVAL = ['created', 'booked', 'received', 'confirmed', 'nomination_generated', 'hbl_generated', 'hawb_generated', 'in_transit'];
  const jobs = await FFJob.findAll({
    where: { status: { [Op.in]: PRE_ARRIVAL }, eta: { [Op.ne]: null } },
    attributes: ['jobNumber', 'status', 'origin', 'destination', 'eta', 'transportMode'],
    raw: true,
  });

  const now = Date.now();
  return jobs
    .map((j) => ({
      jobNumber: j.jobNumber,
      status: j.status,
      mode: j.transportMode,
      route: [j.origin, j.destination].filter(Boolean).join(' → ') || null,
      eta: j.eta,
      daysOverdue: Math.floor((now - new Date(j.eta).getTime()) / 86400000),
    }))
    .filter((j) => j.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 50);
};

// Credit risk: score organizations on exposure vs. approved limit, payment
// terms, and whether credit was ever formally approved.
const creditRisk = async () => {
  const orgs = await Organization.findAll({
    where: { parentId: null },
    attributes: ['name', 'customerCode', 'country', 'totalReceivable', 'approvedCreditLimit', 'internalCreditLimit', 'isCredit', 'approvedCreditDays'],
    raw: true,
  });

  return orgs
    .map((o) => {
      const exposure = num(o.totalReceivable);
      const limit = num(o.approvedCreditLimit) || num(o.internalCreditLimit);
      const utilisation = limit > 0 ? exposure / limit : null;

      let score = 0;
      const reasons = [];
      if (utilisation !== null && utilisation > 0.9) { score += 40; reasons.push('Over 90% of credit limit used'); }
      else if (utilisation !== null && utilisation > 0.7) { score += 20; reasons.push('Over 70% of credit limit used'); }
      if (exposure > 0 && limit === 0) { score += 35; reasons.push('Outstanding balance with no approved credit limit'); }
      if (o.isCredit && !o.approvedCreditDays) { score += 15; reasons.push('Credit customer with no approved credit days'); }
      if (num(o.approvedCreditDays) > 90) { score += 10; reasons.push('Credit terms longer than 90 days'); }

      return {
        name: o.name,
        code: o.customerCode,
        country: o.country,
        exposure: round(exposure),
        creditLimit: round(limit),
        utilisationPct: utilisation === null ? null : round(utilisation * 100),
        riskScore: Math.min(score, 100),
        reasons,
      };
    })
    .filter((o) => o.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 50);
};

// Charge anomalies: jobs whose cost ratio sits far from the peer median for the
// same transport mode. Median + MAD rather than mean + stddev, so a couple of
// extreme jobs don't mask the rest.
const chargeAnomalies = async () => {
  const all = await FFJob.findAll({
    attributes: ['jobNumber', 'transportMode', 'revenue', 'status'],
    raw: true,
  });
  const jobs = all.filter((j) => rev(j) > 0);

  const median = (xs) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const byMode = {};
  for (const j of jobs) {
    const ratio = cost(j) / rev(j);
    const mode = j.transportMode || 'UNKNOWN';
    (byMode[mode] = byMode[mode] || []).push({ ...j, ratio });
  }

  const out = [];
  for (const [mode, rows] of Object.entries(byMode)) {
    if (rows.length < 4) continue;
    const ratios = rows.map((r) => r.ratio);
    const med = median(ratios);
    const mad = median(ratios.map((r) => Math.abs(r - med))) || 0.0001;
    for (const r of rows) {
      // 0.6745 rescales MAD to be comparable to a standard deviation.
      const z = (0.6745 * (r.ratio - med)) / mad;
      if (Math.abs(z) >= 3.5) {
        out.push({
          jobNumber: r.jobNumber,
          mode,
          status: r.status,
          revenue: round(rev(r)),
          cost: round(cost(r)),
          costRatioPct: round(r.ratio * 100),
          peerMedianPct: round(med * 100),
          direction: r.ratio > med ? 'cost unusually high' : 'cost unusually low',
          severity: round(Math.abs(z)),
        });
      }
    }
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, 50);
};

const summary = async () => {
  const [margin, slippage, risk, anomalies] = await Promise.all([
    marginForecast(), etaSlippage(), creditRisk(), chargeAnomalies(),
  ]);
  return {
    marginForecast: margin,
    etaSlippage: slippage,
    creditRisk: risk,
    chargeAnomalies: anomalies,
    headline: {
      forecastMarginTotal: round(margin.reduce((s, m) => s + m.forecastMargin, 0)),
      overdueShipments: slippage.length,
      highRiskOrganizations: risk.filter((r) => r.riskScore >= 40).length,
      chargeAnomalies: anomalies.length,
    },
  };
};

module.exports = { marginForecast, etaSlippage, creditRisk, chargeAnomalies, summary };
