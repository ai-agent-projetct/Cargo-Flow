import React from 'react';
import ResourceManager from './ResourceManager';
import { crmAPI, masterDataAPI } from '../../../services/api';

// The five Sales & CRM configuration screens. Each is a field schema handed
// to the shared ResourceManager, because all five are list-and-form and
// nothing more.
//
// The flags on these records are gates, not labels: a lead can only become an
// opportunity from a stage marked "allows opportunity creation", and an
// opportunity can only raise a quote from a stage marked "allows quote
// creation". The server re-checks both, so a stale form cannot skip a stage.

export const LeadStages = () => (
  <ResourceManager
    title="Lead Stage"
    subtitle="The columns of the lead pipeline, in order. Mark the stage from which a qualified lead may be turned into an opportunity."
    api={crmAPI.stages}
    fixedParams={{ kind: 'lead' }}
    listKey="lead-stages"
    searchPlaceholder="Search stages…"
    emptyMessage="No lead stages yet. Add New, Contacted and Qualified to get started."
    schema={[
      { name: 'name', label: 'Stage', required: true, placeholder: 'Qualified' },
      { name: 'sequence', label: 'Order', type: 'number', defaultValue: 10, hint: 'Lower numbers come first on the board' },
      {
        name: 'isCreateOpportunity',
        label: 'Allows opportunity creation',
        type: 'checkbox',
        checkboxLabel: 'A lead in this stage may be converted',
        hint: 'Without this, the Convert button stays disabled',
      },
      { name: 'isLost', label: 'Closes as lost', type: 'checkbox', checkboxLabel: 'Moving a lead here marks it lost' },
      { name: 'fold', label: 'Collapsed', type: 'checkbox', checkboxLabel: 'Fold this column on the board by default' },
      { name: 'description', label: 'Description', type: 'textarea', width: 'full', formOnly: true },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ]}
  />
);

export const OpportunityStages = () => (
  <ResourceManager
    title="Opportunity Stage"
    subtitle="The columns of the opportunity pipeline. Mark the stages from which a quotation may be raised."
    api={crmAPI.stages}
    fixedParams={{ kind: 'opportunity' }}
    listKey="opportunity-stages"
    searchPlaceholder="Search stages…"
    emptyMessage="No opportunity stages yet."
    schema={[
      { name: 'name', label: 'Stage', required: true, placeholder: 'Pricing' },
      { name: 'sequence', label: 'Order', type: 'number', defaultValue: 10 },
      {
        name: 'allowQuoteCreation',
        label: 'Allows quote creation',
        type: 'checkbox',
        checkboxLabel: 'An opportunity in this stage may raise a quotation',
        hint: 'Without this, the Create Quote button stays disabled',
      },
      { name: 'isWon', label: 'Closes as won', type: 'checkbox' },
      { name: 'isLost', label: 'Closes as lost', type: 'checkbox' },
      { name: 'fold', label: 'Collapsed', type: 'checkbox' },
      { name: 'description', label: 'Description', type: 'textarea', width: 'full', formOnly: true },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ]}
  />
);

export const SalesTeams = () => (
  <ResourceManager
    title="Sales Team"
    subtitle="Teams scope the pipeline and the agent reports, so a salesperson sees their own team's work rather than everybody's."
    api={crmAPI.teams}
    listKey="sales-teams"
    searchPlaceholder="Search teams…"
    emptyMessage="No sales teams yet."
    schema={[
      { name: 'name', label: 'Team', required: true, placeholder: 'Sea Freight - Gulf' },
      { name: 'code', label: 'Code', placeholder: 'SF-GULF' },
      { name: 'sequence', label: 'Order', type: 'number', defaultValue: 10 },
      {
        name: 'leader',
        label: 'Team lead',
        listOnly: true,
        render: (r) => (r.leader ? (r.leader.name || r.leader.email) : '-'),
      },
      {
        name: 'memberIds',
        label: 'Members',
        listOnly: true,
        render: (r) => `${Array.isArray(r.memberIds) ? r.memberIds.length : 0} member(s)`,
      },
      { name: 'targetCurrency', label: 'Target currency', defaultValue: 'AED', formOnly: true },
      { name: 'description', label: 'Description', type: 'textarea', width: 'full', formOnly: true },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ]}
  />
);

export const QuoteTemplates = () => (
  <ResourceManager
    title="Quote Template"
    subtitle="Terms-and-conditions boilerplate offered on the quote form. Templates are filtered by mode and shipment type, so an air quote only offers air wording."
    api={crmAPI.quoteTemplates}
    listKey="quote-templates"
    searchPlaceholder="Search templates…"
    emptyMessage="No quote templates yet."
    schema={[
      { name: 'name', label: 'Template', required: true, width: 'full' },
      {
        name: 'templateFor',
        label: 'Used for',
        type: 'select',
        defaultValue: 'shipment',
        options: [
          { value: 'shipment', label: 'Shipment quote' },
          { value: 'job', label: 'Service job quote' },
        ],
      },
      {
        name: 'transportMode',
        label: 'Transport mode',
        type: 'select',
        options: ['SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER'],
        hint: 'Leave unset to offer it for every mode',
      },
      {
        name: 'shipmentType',
        label: 'Shipment type',
        type: 'select',
        options: ['FCL', 'LCL', 'Air Freight', 'FTL', 'LTL', 'BREAKBULK', 'RORO', 'BULK'],
      },
      { name: 'sequence', label: 'Order', type: 'number', defaultValue: 10 },
      { name: 'isDefault', label: 'Default', type: 'checkbox', checkboxLabel: 'Pre-select on a matching quote' },
      {
        name: 'bodyHtml',
        label: 'Terms (HTML)',
        type: 'html',
        required: true,
        width: 'full',
        formOnly: true,
        placeholder: '<p><strong>Terms &amp; Conditions</strong></p><ul><li>…</li></ul>',
        hint: 'Rendered into the quote PDF and the quote notes',
      },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ]}
  />
);

// Lead sources live in the shared master-data table, the same as the other
// Administration > Manage lists, so this one is pointed at that API with the
// `lead-source` category bound in.
const leadSourceApi = {
  getAll: (params) => masterDataAPI.getAll('lead-source', params),
  create: (data) => masterDataAPI.create('lead-source', data),
  update: (id, data) => masterDataAPI.update('lead-source', id, data),
  delete: (id) => masterDataAPI.delete('lead-source', id),
};

export const LeadSources = () => (
  <ResourceManager
    title="Lead Source"
    subtitle="Where enquiries come from. The source is reported on in the Sales Agent and Opportunity Detail reports."
    api={leadSourceApi}
    listKey="lead-sources"
    searchPlaceholder="Search sources…"
    emptyMessage="No lead sources yet."
    schema={[
      { name: 'name', label: 'Source', required: true, placeholder: 'Trade Show' },
      { name: 'code', label: 'Code', placeholder: 'TRADE' },
      { name: 'sortOrder', label: 'Order', type: 'number', defaultValue: 10 },
      { name: 'description', label: 'Description', type: 'textarea', width: 'full', formOnly: true },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ]}
  />
);
