// /api/agency - the Liner Agency / NVOCC module (Booking, Operations, Manifest,
// Container tracking, EDI, Tariffs, Maintenance & Repair). One generic set of
// routes serves every resource declared in agency/spec.js; each request is
// checked against that resource's own ACL model.
const express = require('express');
const models = require('../models');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const svc = require('../agency/service');
const { importEdi } = require('../agency/actions');
const { RESOURCES } = require('../agency/spec');
const { AGENCY_MODELS } = require('../agency/models');

const router = express.Router();
router.use(auth, attachPermissions);

const ctxOf = (req) => ({ userId: req.user && req.user.id, userName: req.user && (req.user.name || req.user.email) });

// Workflow and validation errors carry their HTTP status; anything else is a
// real fault and goes to the global handler.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.statusCode && e.statusCode < 500) return res.status(e.statusCode).json({ success: false, message: e.message });
    return next(e);
  }
};

const acl = (action) => (req, res, next) => {
  const spec = RESOURCES[req.params.resource];
  if (!spec) return res.status(404).json({ success: false, message: `Unknown resource '${req.params.resource}'` });
  return requireAccess(spec.acl, { action })(req, res, next);
};

router.get('/meta', (req, res) => res.json({ success: true, data: svc.meta() }));

router.get('/lookup/:ref', handle(async (req, res) => {
  const filter = Object.fromEntries(Object.entries(req.query).filter(([k]) => k.startsWith('f_')).map(([k, v]) => [k.slice(2), v]));
  const data = await svc.lookup(models, req.params.ref, { search: req.query.search, limit: req.query.limit, filter });
  res.json({ success: true, data });
}));

// Contacts > Principal: the lines this agency represents, with their volume.
router.get('/principals', requireAccess('organization', { action: 'read' }), handle(async (req, res) => {
  const orgs = await models.Organization.findAll({ attributes: ['id', 'name', 'companyName', 'email', 'phone', 'country', 'partyTypes', 'customerCode'], raw: true });
  const principals = orgs.filter((o) => JSON.stringify(o.partyTypes || '').toLowerCase().includes('principal'));
  const out = [];
  for (const p of principals) {
    const [jobs, open, containers] = await Promise.all([
      AGENCY_MODELS.job.count({ where: { principalId: p.id } }),
      AGENCY_MODELS.job.count({ where: { principalId: p.id, state: ['created', 'bl_generated', 'arrival_notice', 'request_for_do', 'booked', 'confirmed'] } }),
      AGENCY_MODELS['container-registry'].count({ where: { principalId: p.id } }),
    ]);
    out.push({ ...p, name: p.companyName || p.name, jobs, openJobs: open, containers });
  }
  res.json({ success: true, data: out });
}));

// Operations > EDI > Import EDI
router.post('/edi/import', requireAccess('nvocc.service.job', { action: 'create' }), handle(async (req, res) => {
  const result = await importEdi(models, req.body || {}, ctxOf(req));
  res.status(201).json({ success: true, data: result, message: result.message });
}));

router.get('/:resource', acl('read'), handle(async (req, res) => {
  const data = await svc.list(models, req.params.resource, req.query);
  res.json({ success: true, data: data.rows, stateCounts: data.stateCounts, pagination: data.pagination });
}));

router.post('/:resource', acl('create'), handle(async (req, res) => {
  const rec = await svc.create(models, req.params.resource, req.body || {}, ctxOf(req));
  res.status(201).json({ success: true, data: await svc.get(models, req.params.resource, rec.id), message: `${RESOURCES[req.params.resource].label} created` });
}));

// List-level actions on several records, e.g. Operations > Charge Assignment.
router.post('/:resource/bulk/:action', acl('write'), handle(async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(422).json({ success: false, message: 'Select at least one record' });
  const results = [];
  for (const id of ids) {
    try {
      const r = await svc.runAction(models, req.params.resource, id, req.params.action, req.body.params || {}, ctxOf(req));
      results.push({ id, ok: true, message: r.message });
    } catch (e) {
      if (!e.statusCode) throw e;
      results.push({ id, ok: false, message: e.message });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  return res.json({ success: true, data: results, message: `${ok} of ${ids.length} done` });
}));

router.get('/:resource/:id', acl('read'), handle(async (req, res) => {
  res.json({ success: true, data: await svc.get(models, req.params.resource, req.params.id) });
}));

router.put('/:resource/:id', acl('write'), handle(async (req, res) => {
  await svc.update(models, req.params.resource, req.params.id, req.body || {}, ctxOf(req));
  res.json({ success: true, data: await svc.get(models, req.params.resource, req.params.id), message: `${RESOURCES[req.params.resource].label} updated` });
}));

router.delete('/:resource/:id', acl('delete'), handle(async (req, res) => {
  await svc.remove(models, req.params.resource, req.params.id, ctxOf(req));
  res.json({ success: true, data: null, message: `${RESOURCES[req.params.resource].label} deleted` });
}));

router.post('/:resource/:id/actions/:action', acl('write'), handle(async (req, res) => {
  const result = await svc.runAction(models, req.params.resource, req.params.id, req.params.action, req.body || {}, ctxOf(req));
  const data = await svc.get(models, req.params.resource, req.params.id).catch(() => null);
  res.json({ success: true, data, result, message: result.message });
}));

module.exports = router;
