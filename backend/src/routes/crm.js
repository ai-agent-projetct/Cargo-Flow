const express = require('express');
const router = express.Router();
const crm = require('../controllers/crmController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

// Sales Strategy > Dashboard
router.get('/dashboard', crm.dashboard);

// Configurations > Lead Stage / Opportunity Stage (one table, `kind` filters)
router.get('/stages', requireAccess('crm.stage', { action: 'read' }), crm.stages.getAll);
router.post('/stages', requireAccess('crm.stage', { action: 'create' }), crm.stages.create);
router.get('/stages/:id', requireAccess('crm.stage', { action: 'read' }), crm.stages.getById);
router.put('/stages/:id', requireAccess('crm.stage', { action: 'write' }), crm.stages.update);
router.delete('/stages/:id', requireAccess('crm.stage', { action: 'delete' }), crm.stages.remove);

// Configurations > Sales Team
router.get('/teams', requireAccess('crm.team', { action: 'read' }), crm.teams.getAll);
router.post('/teams', requireAccess('crm.team', { action: 'create' }), crm.teams.create);
router.get('/teams/:id', requireAccess('crm.team', { action: 'read' }), crm.teams.getById);
router.get('/teams/:id/members', requireAccess('crm.team', { action: 'read' }), crm.teams.getMembers);
router.put('/teams/:id', requireAccess('crm.team', { action: 'write' }), crm.teams.update);
router.delete('/teams/:id', requireAccess('crm.team', { action: 'delete' }), crm.teams.remove);

// Configurations > Quote Template
router.get('/quote-templates', requireAccess('shipment.quote.template', { action: 'read' }), crm.templates.getAll);
router.post('/quote-templates', requireAccess('shipment.quote.template', { action: 'create' }), crm.templates.create);
router.get('/quote-templates/:id', requireAccess('shipment.quote.template', { action: 'read' }), crm.templates.getById);
router.put('/quote-templates/:id', requireAccess('shipment.quote.template', { action: 'write' }), crm.templates.update);
router.delete('/quote-templates/:id', requireAccess('shipment.quote.template', { action: 'delete' }), crm.templates.remove);

// Sales Strategy > Targets.
// `/targets/recompute` is declared before `/targets/:id` so "recompute" is
// never read as an id.
router.get('/targets', requireAccess('crm.sale.target', { action: 'read' }), crm.targets.getAll);
router.post('/targets', requireAccess('crm.sale.target', { action: 'create' }), crm.targets.create);
router.post('/targets/recompute', requireAccess('crm.sale.target', { action: 'write' }), crm.targets.recompute);
router.get('/targets/:id', requireAccess('crm.sale.target', { action: 'read' }), crm.targets.getById);
router.put('/targets/:id', requireAccess('crm.sale.target', { action: 'write' }), crm.targets.update);
router.delete('/targets/:id', requireAccess('crm.sale.target', { action: 'delete' }), crm.targets.remove);
router.post('/targets/:id/recompute', requireAccess('crm.sale.target', { action: 'write' }), crm.targets.recompute);

// Sales > Prospect
router.get('/prospects', requireAccess('crm.prospect', { action: 'read' }), crm.prospects.getAll);
router.post('/prospects', requireAccess('crm.prospect', { action: 'create' }), crm.prospects.create);
router.get('/prospects/:id', requireAccess('crm.prospect', { action: 'read' }), crm.prospects.getById);
router.put('/prospects/:id', requireAccess('crm.prospect', { action: 'write' }), crm.prospects.update);
router.delete('/prospects/:id', requireAccess('crm.prospect', { action: 'delete' }), crm.prospects.remove);
router.post('/prospects/:id/convert', requireAccess('crm.prospect', { action: 'write' }), crm.prospects.convertToOrganization);

// Sales > Leads. `/leads/kanban` comes first for the same reason as above.
router.get('/leads/kanban', requireAccess('crm.prospect.lead', { action: 'read' }), crm.leads.kanban);
router.get('/leads', requireAccess('crm.prospect.lead', { action: 'read' }), crm.leads.getAll);
router.post('/leads', requireAccess('crm.prospect.lead', { action: 'create' }), crm.leads.create);
router.get('/leads/:id', requireAccess('crm.prospect.lead', { action: 'read' }), crm.leads.getById);
router.put('/leads/:id', requireAccess('crm.prospect.lead', { action: 'write' }), crm.leads.update);
router.delete('/leads/:id', requireAccess('crm.prospect.lead', { action: 'delete' }), crm.leads.remove);
router.post('/leads/:id/stage', requireAccess('crm.prospect.lead', { action: 'write' }), crm.leads.setStage);
// Converting raises an opportunity, so it needs create rights on that model
// as well as write on the lead.
router.post(
  '/leads/:id/convert',
  requireAccess('crm.prospect.lead', { action: 'write' }),
  requireAccess('crm.prospect.opportunity', { action: 'create' }),
  crm.leads.convertToOpportunity,
);

module.exports = router;
