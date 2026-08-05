// One-off script: sets the exact creation date/time, activity log entry
// ("House Shipment created" by the responsible user) and document
// upload timestamps for the 5 "Created" House Shipment records that were
// matched against the live SeaRates demo screenshots.
//
// Run with: node src/config/updateCreatedRecordsTimestamps.js

const { sequelize, connectDB } = require('./database');
const { FFJob, User } = require('../models');

const updates = [
  // Demo screenshot: "March 29, 2026 · Gaurav Lashkari · House Shipment created",
  // Documents DateTime = 03/29/2026 21:02:31
  { jobNumber: 'SEA-E-FCL-H-N-2026-01851', createdAt: '2026-03-29T21:02:31Z', creator: 'Gaurav Lashkari' },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01850', createdAt: '2026-03-26T21:02:31Z', creator: 'Gaurav Lashkari' },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01848', createdAt: '2026-01-30T11:04:51Z', creator: 'Moneesh (Tech Support)' },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01847', createdAt: '2026-01-30T11:04:51Z', creator: 'Syed (Tech Support)' },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01845', createdAt: '2026-01-30T11:04:51Z', creator: 'Mohd (Tech Support)' },
];

const run = async () => {
  await connectDB();

  for (const { jobNumber, createdAt, creator } of updates) {
    const job = await FFJob.findOne({ where: { jobNumber } });
    if (!job) {
      console.warn(`Job ${jobNumber} not found, skipping`);
      continue;
    }

    const createdAtDate = new Date(createdAt);
    const documents = (job.documents || []).map((d) => ({ ...d, uploadedAt: createdAtDate.toISOString() }));
    const activityLog = [
      {
        message: 'House Shipment created',
        user: creator,
        timestamp: createdAtDate.toISOString(),
      },
    ];

    await job.update({ createdAt: createdAtDate, documents, activityLog });
    console.log(`Updated timestamps for ${jobNumber} -> ${createdAtDate.toISOString()} (${creator})`);
  }

  await sequelize.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
