// /api/odoo - the SearatesERP Agency clone, speaking Odoo's web-client
// protocol (call_kw) so the upstream views render unchanged.
const express = require('express');
const { authenticate: auth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');
const permissions = require('../services/permissionService');
const R = require('../odoo/registry');
const orm = require('../odoo/orm');

const router = express.Router();
router.use(auth, attachPermissions);

// Which CargoFlo ACL model guards each upstream model.
const ACL_OF = (m) => {
  if (/^nvocc\.pre\.booking/.test(m) || m === 'wizard.cro.customer.summary.report') return 'nvocc.pre.booking';
  if (/^nvocc\.manifest/.test(m)) return 'nvocc.manifest';
  if (/^(nvocc\.|wizard\.(operation|freight|principal)|detention|security\.deposit|received\.|refunded\.)/.test(m)) return 'nvocc.service.job';
  if (/^container\.(activity|registry|upload)/.test(m)) return 'nvocc.container';
  if (/^charges\.tariff|^slab\.line/.test(m)) return 'charges.tariff';
  if (/^edi\./.test(m)) return 'edi.template';
  if (/^maintenance\.repair/.test(m)) return 'maintenance.repair.request';
  if (/^maintenance\./.test(m)) return 'maintenance.request';
  if (/^account\.|^wiz|^invoice\./.test(m)) return 'invoice';
  return 'nvocc.config';
};
const READS = new Set(['fields_get', 'fields_view_get', 'load_views', 'search_read', 'read', 'name_search', 'name_get', 'search_count', 'search', 'read_group', 'default_get', 'onchange', 'web_search_read']);
const WRITES = { create: 'create', write: 'write', unlink: 'delete', copy: 'create' };

const allowed = async (req, model, action) => {
  const ctx = req.permissions || await permissions.forUser(req.user);
  return permissions.can(ctx, ACL_OF(model), action);
};

const ctxOf = (req, extra = {}) => ({ uid: req.user && req.user.id, userName: req.user && (req.user.name || req.user.email), ...extra });

const views = (m, types) => {
  const v = R.viewsOf(m);
  const out = {};
  for (const t of types) if (v[t]) out[t] = { arch: v[t].arch, fields: v[t].fields, view_id: v[t].view_id, name: v[t].name };
  return out;
};

const DISPATCH = {
  fields_get: (m) => R.fieldsOf(m),
  fields_view_get: (m, args, kw) => {
    const vt = kw.view_type || args[1] || 'form';
    const alt = require('../odoo/methods').viewById && require('../odoo/methods').viewById(kw.view_id || args[0]);
    return alt || views(m, [vt])[vt] || null;
  },
  // A menu's action can name specific views; fall back to the defaults.
  load_views: (m, args, kw) => {
    const { viewById } = require('../odoo/methods');
    const out = {};
    for (const [vid, type] of (kw.views || args[0] || [])) {
      const t = type === 'list' ? 'tree' : type;
      const byId = vid ? viewById(vid) : null;
      out[t] = byId && byId.model === m ? byId : views(m, [t])[t];
    }
    return { fields: R.fieldsOf(m), fields_views: out };
  },
  search_read: (m, args, kw, ctx) => (async () => {
    const domain = kw.domain || args[0] || [];
    const fields = kw.fields || args[1] || null;
    const opts = { offset: kw.offset || 0, limit: kw.limit || null, order: kw.order || null };
    const ids = await orm.search(m, domain, opts);
    const records = await orm.read(m, ids, fields);
    return kw.count !== false ? { length: await orm.searchCount(m, domain), records } : records;
  })(),
  read: (m, args, kw) => orm.read(m, (args[0] || []).map(Number), kw.fields || args[1] || null),
  search: (m, args, kw) => orm.search(m, args[0] || kw.domain || [], { offset: kw.offset, limit: kw.limit, order: kw.order }),
  search_count: (m, args, kw) => orm.searchCount(m, args[0] || kw.domain || []),
  name_search: (m, args, kw) => orm.nameSearch(m, kw.name ?? args[0] ?? '', kw.args || args[1] || [], kw.operator || 'ilike', kw.limit ?? 8),
  name_get: (m, args) => orm.nameGet(m, args[0] || []),
  default_get: (m, args, kw, ctx) => orm.defaultGet(m, args[0] || kw.fields_list || null, ctx),
  read_group: (m, args, kw) => orm.readGroup(m, kw.domain || args[0] || [], kw.groupby || args[2] || []),
  create: (m, args, kw, ctx) => orm.create(m, args[0] || kw.vals || {}, ctx),
  write: (m, args, kw, ctx) => orm.write(m, (args[0] || []).map(Number), args[1] || kw.vals || {}, ctx),
  unlink: (m, args, kw, ctx) => orm.unlink(m, (args[0] || []).map(Number), ctx),
  onchange: (m, args, kw, ctx) => require('../odoo/methods').onchange(m, args[0] || {}, args[1], ctx),
};

router.post('/call', async (req, res, next) => {
  const { model, method, args = [], kwargs = {} } = req.body || {};
  try {
    if (!model || !method) return res.status(400).json({ success: false, message: 'model and method are required' });
    if (!R.isOwn(model) && !['name_search', 'name_get'].includes(method)) {
      return res.status(404).json({ success: false, message: `Model ${model} is not part of the Agency clone` });
    }
    const action = READS.has(method) ? 'read' : (WRITES[method] || 'write');
    if (!['name_search', 'name_get'].includes(method) && !(await allowed(req, model, action))) {
      return res.status(403).json({ success: false, message: `You are not allowed to ${action} ${model}` });
    }
    const ctx = ctxOf(req, kwargs.context || {});
    let result;
    if (DISPATCH[method]) result = await DISPATCH[method](model, args, kwargs, ctx);
    else result = await require('../odoo/methods').callButton(model, method, (args[0] || []).map(Number), kwargs, ctx);
    return res.json({ success: true, result });
  } catch (e) {
    if (e.statusCode && e.statusCode < 500) return res.status(e.statusCode).json({ success: false, message: e.message });
    return next(e);
  }
});

// Printed documents: the instance's Stimulsoft templates for a model, and one
// template filled with a record's data.
router.get('/print/templates', (req, res) => {
  res.json({ success: true, result: require('../odoo/print').templatesFor(String(req.query.model || '')) });
});
router.get('/print/:templateId', async (req, res, next) => {
  try {
    const printing = require('../odoo/print');
    const model = printing.modelOf(req.params.templateId);
    if (!model) return res.status(404).json({ success: false, message: 'Print template not found' });
    if (!(await allowed(req, model, 'read'))) return res.status(403).json({ success: false, message: `You are not allowed to read ${model}` });
    if (req.query.format === 'json') {
      return res.json({ success: true, result: await printing.render(req.params.templateId, Number(req.query.res_id), ctxOf(req)) });
    }
    const out = await printing.renderPdf(req.params.templateId, Number(req.query.res_id), ctxOf(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${out.name.replace(/[^\w.-]+/g, '_')}.pdf"`);
    return res.end(out.pdf);
  } catch (e) {
    if (e.statusCode && e.statusCode < 500) return res.status(e.statusCode).json({ success: false, message: e.message });
    return next(e);
  }
});

// A window action by id (smart buttons and type="action" buttons open these).
router.get('/action/:id', (req, res) => {
  const a = R.U.actions.find((x) => x.id === Number(req.params.id));
  if (!a || !R.isOwn(a.res_model)) return res.status(404).json({ success: false, message: 'This action is not part of the Agency clone' });
  return res.json({ success: true, result: { type: 'ir.actions.act_window', ...a } });
});

// The instance's menu tree with each entry's window action, filtered to the
// apps the clone covers.
router.get('/menus', (req, res) => {
  const methods = require('../odoo/methods');
  const actions = new Map(R.U.actions.map((a) => [a.id, a]));
  const menus = R.U.menus
    .filter((m) => methods.MENU_ROOTS.some((root) => m.complete_name === root || m.complete_name.startsWith(`${root}/`)))
    .map((m) => {
      const [kind, id] = String(m.action).split(',');
      const act = kind === 'ir.actions.act_window' ? actions.get(Number(id)) : null;
      return {
        id: m.id, name: m.complete_name.split('/').pop(), path: m.complete_name, sequence: m.sequence,
        parent: m.parent_id ? m.parent_id[1] : null,
        action: act && R.isOwn(act.res_model) ? {
          id: act.id, name: act.name, res_model: act.res_model, domain: act.domain, context: act.context,
          views: act.views, search_view_id: act.search_view_id, limit: act.limit, help: act.help,
        } : null,
        report: methods.MENU_REPORTS[m.complete_name] || null,
      };
    })
    .filter((m) => m.action || m.report);
  res.json({ success: true, result: menus });
});

module.exports = router;
