// One-off script: populates the `documents` JSON field on every existing
// ff_jobs record with the 15 standard "Shipment Document" entries observed
// on the live CargoFlo demo (demo.cargoflo.tech) Documents smart button —
// 4 IN docs + 11 OUT docs, grouped by `mode`.
//
// Run with: node src/config/populateDocuments.js

const { sequelize, connectDB } = require('./database');
const { FFJob } = require('../models');

const IN_DOCS = [
  { type: 'Packing List', name: 'Packing List' },
  { type: 'Others', name: 'Others' },
  { type: 'Commercial Invoice', name: 'Commercial Invoice' },
  { type: 'User Document History', name: 'User Document History' },
];

const OUT_DOCS = [
  { type: 'Nomination Form', name: 'Nomination Form' },
  { type: 'Line Order Delivery', name: 'Line Order Delivery' },
  { type: 'Clearance', name: 'Clearance' },
  { type: 'Draft House Bill', name: 'Draft House Bill' },
  { type: 'House Bill', name: 'House Bill' },
  { type: 'Packing List', name: 'Packing List' },
  { type: 'Transport Instruction', name: 'Transport Instruction' },
  { type: 'Shipping Instruction', name: 'Shipping Instruction' },
  { type: 'Freight Manifest', name: 'Freight Manifest' },
  { type: 'Cargo Manifest', name: 'Cargo Manifest' },
  { type: 'Booking Confirmation', name: 'Booking Confirmation' },
];

const buildDocuments = (createdAt) => {
  const timestamp = (createdAt instanceof Date ? createdAt : new Date()).toISOString();
  const all = [
    ...IN_DOCS.map((d) => ({ ...d, mode: 'IN' })),
    ...OUT_DOCS.map((d) => ({ ...d, mode: 'OUT' })),
  ];
  return all.map((d) => ({
    id: require('crypto').randomUUID(),
    type: d.type,
    name: d.name,
    mode: d.mode,
    url: null,
    notes: null,
    uploaded: true,
    published: d.mode === 'OUT',
    uploadedAt: timestamp,
    uploadedBy: null,
  }));
};

const run = async () => {
  await connectDB();

  const jobs = await FFJob.findAll();
  let updated = 0;

  for (const job of jobs) {
    await job.update({ documents: buildDocuments(job.createdAt) });
    updated += 1;
  }

  console.log(`Populated documents for ${updated} FFJob records (15 each: 4 IN + 11 OUT).`);
  await sequelize.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
