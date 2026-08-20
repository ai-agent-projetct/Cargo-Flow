// One-off script: updates the first 5 "Created" House Shipment records
// (seeded by seedHouseShipments.js) with the exact field values shown on
// the live CargoFlo demo (demo.cargoflo.tech) for those records —
// incoterm, service mode, sales agent, responsible, ports, weights, etc.
//
// Run with: node src/config/updateCreatedRecords.js

const { sequelize, connectDB } = require('./database');
const { FFJob, User, Port } = require('../models');

const getOrCreateUser = async (name, email) => {
  let user = await User.findOne({ where: { name } });
  if (user) return user;
  user = await User.findOne({ where: { email } });
  if (user) return user;
  return User.create({
    name,
    email,
    // Placeholder for back-filled users; override via SEED_USER_PASSWORD.
    password: process.env.SEED_USER_PASSWORD || 'ChangeMe@123',
    role: 'user',
  });
};

const getOrCreatePort = async ({ code, name, city, country, countryCode, type = 'sea' }) => {
  let port = await Port.findOne({ where: { code } });
  if (port) return port;
  return Port.create({ code, name, city, country, countryCode, type });
};

const run = async () => {
  await connectDB();

  // Sales agents / responsible users seen on the demo
  const gaurav = await getOrCreateUser('Gaurav Lashkari', 'gaurav.lashkari@cargoflo.com');
  const moneesh = await getOrCreateUser('Moneesh (Tech Support)', 'moneesh.techsupport@cargoflo.com');
  const syed = await getOrCreateUser('Syed (Tech Support)', 'syed.techsupport@cargoflo.com');
  const mohd = await getOrCreateUser('Mohd (Tech Support)', 'mohd.techsupport@cargoflo.com');

  // Ports seen on the demo
  const khorAlFakkan = await getOrCreatePort({ code: 'AEKLF', name: 'KHOR AL FAKKAN', city: 'Khor Al Fakkan', country: 'United Arab Emirates', countryCode: 'AE' });
  const testPortAndorra = await getOrCreatePort({ code: 'TEST5', name: 'Test Port', city: 'Escas', country: 'Andorra', countryCode: 'AD' });
  const abuDhabi = await getOrCreatePort({ code: 'AEAUH', name: 'ABU DHABI', city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE' });
  const svaqjAlbania = await getOrCreatePort({ code: 'SVAQJ', name: 'SVAQJ', city: 'Argyrokastro', country: 'Albania', countryCode: 'AL' });
  const haldia = await getOrCreatePort({ code: 'INHAL', name: 'HALDIA', city: 'Haldia', country: 'India', countryCode: 'IN' });
  const jebelAli = await getOrCreatePort({ code: 'AEJEA23', name: 'JEBEL ALI', city: 'Jebel Ali', country: 'United Arab Emirates', countryCode: 'AE' });
  const sanand = await getOrCreatePort({ code: 'INSAA', name: 'Sanand', city: 'Sanand', country: 'India', countryCode: 'IN' });

  const updates = [
    {
      jobNumber: 'SEA-E-FCL-H-N-2026-01851',
      data: {
        shipmentDate: '2026-03-28',
        salesAgentId: gaurav.id,
        assignedTo: gaurav.id,
        incoterm: 'FCA',
        originCountry: 'United Arab Emirates',
        origin: 'Ubungo',
        originPortId: khorAlFakkan.id,
        destinationCountry: 'Andorra',
        destination: 'Escàs',
        destinationPortId: testPortAndorra.id,
      },
    },
    {
      jobNumber: 'SEA-E-FCL-H-N-2026-01850',
      data: {
        shipmentDate: '2026-03-26',
        salesAgentId: gaurav.id,
        assignedTo: gaurav.id,
        incoterm: 'FAS',
        originCountry: 'United Arab Emirates',
        origin: 'DUBAI (UAE)',
        originPortId: abuDhabi.id,
        destinationCountry: 'Albania',
        destination: 'Argyrokastro',
        destinationPortId: svaqjAlbania.id,
      },
    },
    {
      jobNumber: 'SEA-E-FCL-H-N-2026-01848',
      data: {
        shipmentDate: '2026-01-30',
        salesAgentId: moneesh.id,
        assignedTo: syed.id,
        incoterm: 'FOB',
        autoUpdateWeight: true,
        packages: 2,
        packUnit: 'PKG',
        grossWeight: 20000,
        netWeight: 18000,
        volumetricWeight: 1500,
        volume: 200,
        chargeableWeight: 200,
        originCountry: 'United Arab Emirates',
        origin: 'Dubai',
        originPortId: abuDhabi.id,
        destinationCountry: 'India',
        destination: 'Gandhinagar',
        destinationPortId: haldia.id,
        etd: '2026-02-19T11:04:51Z',
        eta: '2026-02-28T11:04:51Z',
      },
    },
    {
      jobNumber: 'SEA-E-FCL-H-N-2026-01847',
      data: {
        shipmentDate: '2026-01-30',
        salesAgentId: syed.id,
        assignedTo: syed.id,
        incoterm: 'FOB',
        autoUpdateWeight: true,
        packages: 2,
        packUnit: 'PKG',
        grossWeight: 20000,
        netWeight: 18000,
        volumetricWeight: 1500,
        volume: 200,
        chargeableWeight: 200,
        originCountry: 'United Arab Emirates',
        origin: 'Dubai',
        originPortId: abuDhabi.id,
        destinationCountry: 'India',
        destination: 'Gandhinagar',
        destinationPortId: haldia.id,
        etd: '2026-02-19T11:04:51Z',
        eta: '2026-02-28T11:04:51Z',
      },
    },
    {
      jobNumber: 'SEA-E-FCL-H-N-2026-01845',
      data: {
        shipmentDate: '2026-01-30',
        salesAgentId: mohd.id,
        assignedTo: mohd.id,
        incoterm: 'FOB',
        originCountry: 'United Arab Emirates',
        origin: 'DUBAI (UAE)',
        originPortId: jebelAli.id,
        destinationCountry: 'India',
        destination: 'Nhava Sheva',
        destinationPortId: sanand.id,
      },
    },
  ];

  for (const { jobNumber, data } of updates) {
    const job = await FFJob.findOne({ where: { jobNumber } });
    if (!job) {
      console.warn(`Job ${jobNumber} not found, skipping`);
      continue;
    }
    await job.update(data);
    console.log(`Updated ${jobNumber}`);
  }

  await sequelize.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
