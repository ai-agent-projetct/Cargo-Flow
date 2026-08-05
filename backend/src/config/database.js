const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'cargoflo_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: false,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connection established successfully.');
    // NOTE: sequelize.sync() is intentionally NOT called here.
    // This schema has cyclic FK references (User <-> Department <-> Company, etc.),
    // and Sequelize's sync() forces a second pass with `alter: true` for any models
    // involved in cyclic references (see Sequelize#_syncModelsWithCyclicReferences),
    // regardless of the alter option passed in. That repeatedly corrupted the `users`
    // table (duplicate `email_N` unique indexes, mismatched FK constraint names) on
    // every restart. The schema is already up to date (manually migrated), so we skip
    // sync entirely. Add new columns/tables via explicit ALTER/migration scripts.
    console.log('Database sync skipped (schema manually managed).');
    await ensureTariffsTable();
    await ensureCFSTariffsTable();
    await ensureFFJobsSchema();
    await ensureOperationsTables();
    await seedIncoterms();
    await seedDepartments();
    await seedMasterData();
    await seedOperationsData();
  } catch (error) {
    console.error('Unable to connect to database:', error.message);
    process.exit(1);
  }
};

// The `tariffs` table is new (Sell Tariff / Buy Tariff under Administration >
// Tariff) and was never part of the manually-managed schema, so create it
// explicitly here if it doesn't exist yet.
const ensureTariffsTable = async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const tables = await qi.showAllTables();
    if (tables.includes('tariffs')) return;

    const { DataTypes } = require('sequelize');
    await qi.createTable('tariffs', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      tariffType: { type: DataTypes.ENUM('sell', 'buy'), allowNull: false },
      tariffName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '-' },
      jobType: { type: DataTypes.ENUM('shipment', 'service_job'), allowNull: false, defaultValue: 'shipment' },
      shipmentType: { type: DataTypes.STRING(50), allowNull: true },
      serviceJobType: { type: DataTypes.STRING(50), allowNull: true },
      transportMode: { type: DataTypes.STRING(20), allowNull: true },
      cargoType: { type: DataTypes.STRING(20), allowNull: true },
      companyId: { type: DataTypes.UUID, allowNull: true },
      incotermId: { type: DataTypes.UUID, allowNull: true },
      partyId: { type: DataTypes.UUID, allowNull: true },
      currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'USD' },
      originCountry: { type: DataTypes.STRING(100), allowNull: true },
      origin: { type: DataTypes.STRING(150), allowNull: true },
      destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
      destination: { type: DataTypes.STRING(150), allowNull: true },
      charges: { type: DataTypes.JSON, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    console.log('Created tariffs table.');
  } catch (error) {
    console.error('Error ensuring tariffs table:', error.message);
  }
};

// The House Shipment workflow (ff_jobs.status) was expanded from the original
// 6-status enum to the full 12-status SeaRates workflow. Sequelize sync is
// skipped, so widen the MySQL column directly and add the `revenue` JSON
// column used to display estimated/actual receivable, payable and margin.
const ensureFFJobsSchema = async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');
    const columns = await qi.describeTable('ff_jobs');

    const statuses = "'created','booked','received','confirmed','nomination_generated','hbl_generated','hawb_generated','in_transit','arrived','completed','accounting_closure','cancelled'";
    if (columns.status && !columns.status.type.includes('nomination_generated')) {
      // Widen to VARCHAR first so old enum values can be remapped without
      // MySQL rejecting the UPDATE ("Data truncated for column").
      await sequelize.query("ALTER TABLE ff_jobs MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'created'");
      await sequelize.query("UPDATE ff_jobs SET status = 'created' WHERE status = 'draft'");
      await sequelize.query("UPDATE ff_jobs SET status = 'completed' WHERE status = 'delivered'");
      await sequelize.query(
        `ALTER TABLE ff_jobs MODIFY COLUMN status ENUM(${statuses}) NOT NULL DEFAULT 'created'`
      );
      console.log('Widened ff_jobs.status enum to 12-status House Shipment workflow.');
    }

    // A handful of real demo job numbers use cargo type codes (CR = Courier,
    // PLT = Pallet) that aren't in the original cargoType enum.
    const cargoTypes = "'FCL','LCL','FTL','LTL','LSE','BULK','RORO','BREAKBULK','CR','PLT'";
    if (columns.cargoType && !columns.cargoType.type.includes('CR')) {
      await sequelize.query(
        `ALTER TABLE ff_jobs MODIFY COLUMN cargoType ENUM(${cargoTypes}) NOT NULL`
      );
      console.log('Widened ff_jobs.cargoType enum to include CR/PLT.');
    }

    if (!columns.revenue) {
      await qi.addColumn('ff_jobs', 'revenue', {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '{estReceivable, actReceivable, estPayable, actPayable, estMargin, actMargin}',
      });
      console.log('Added ff_jobs.revenue column.');
    }

    if (!columns.masterShipmentId) {
      await qi.addColumn('ff_jobs', 'masterShipmentId', {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Linked Master Shipment (Console) record, if attached',
      });
      console.log('Added ff_jobs.masterShipmentId column.');
    }
  } catch (error) {
    console.error('Error ensuring ff_jobs schema:', error.message);
  }
};

// The `cfs_tariffs` table backs Administration > CFS Tariff > Charges Tariff
// and likewise needs to be created explicitly since sync is skipped.
const ensureCFSTariffsTable = async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const tables = await qi.showAllTables();
    const { DataTypes } = require('sequelize');
    if (tables.includes('cfs_tariffs')) {
      // Table was created before the `status` column existed - add it if missing.
      const columns = await qi.describeTable('cfs_tariffs');
      if (!columns.status) {
        await qi.addColumn('cfs_tariffs', 'status', {
          type: DataTypes.ENUM('draft', 'approved', 'unapproved'),
          allowNull: false,
          defaultValue: 'draft',
        });
        console.log('Added status column to cfs_tariffs table.');
      }
      return;
    }

    await qi.createTable('cfs_tariffs', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      tariffType: { type: DataTypes.ENUM('sell', 'buy'), allowNull: false, defaultValue: 'sell' },
      status: { type: DataTypes.ENUM('draft', 'approved', 'unapproved'), allowNull: false, defaultValue: 'draft' },
      tariffName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
      operation: { type: DataTypes.ENUM('import', 'export'), allowNull: true },
      transportMode: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'SEA' },
      shippingLineId: { type: DataTypes.UUID, allowNull: true },
      cargoType: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'LCL' },
      companyId: { type: DataTypes.UUID, allowNull: true },
      validFrom: { type: DataTypes.DATEONLY, allowNull: true },
      validTo: { type: DataTypes.DATEONLY, allowNull: true },
      partyId: { type: DataTypes.UUID, allowNull: true },
      currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
      originCountry: { type: DataTypes.STRING(100), allowNull: true },
      origin: { type: DataTypes.STRING(150), allowNull: true },
      originPortId: { type: DataTypes.UUID, allowNull: true },
      destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
      destination: { type: DataTypes.STRING(150), allowNull: true },
      destinationPortId: { type: DataTypes.UUID, allowNull: true },
      charges: { type: DataTypes.JSON, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    console.log('Created cfs_tariffs table.');
  } catch (error) {
    console.error('Error ensuring cfs_tariffs table:', error.message);
  }
};

// New Operations-module tables (Master Shipment Console, CFS Receive/Delivery
// Entry, Export Console Generation, Shipment Sharing, OCR Document, Container
// Number master) - created explicitly since sync() is disabled.
const ensureOperationsTables = async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const tables = await qi.showAllTables();
    const { DataTypes } = require('sequelize');

    if (!tables.includes('master_shipments')) {
      await qi.createTable('master_shipments', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        masterShipmentNumber: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        transportMode: { type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL'), allowNull: false, defaultValue: 'SEA' },
        direction: { type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'), allowNull: false, defaultValue: 'EXPORT' },
        cargoType: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'FCL' },
        serviceType: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'M' },
        customerId: { type: DataTypes.UUID, allowNull: true },
        origin: { type: DataTypes.STRING(200), allowNull: true },
        originCode: { type: DataTypes.STRING(10), allowNull: true },
        originCountry: { type: DataTypes.STRING(100), allowNull: true },
        originPortId: { type: DataTypes.UUID, allowNull: true },
        destination: { type: DataTypes.STRING(200), allowNull: true },
        destinationCode: { type: DataTypes.STRING(10), allowNull: true },
        destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
        destinationPortId: { type: DataTypes.UUID, allowNull: true },
        etd: { type: DataTypes.DATE, allowNull: true },
        eta: { type: DataTypes.DATE, allowNull: true },
        atd: { type: DataTypes.DATE, allowNull: true },
        ata: { type: DataTypes.DATE, allowNull: true },
        carrier: { type: DataTypes.STRING(100), allowNull: true },
        vesselName: { type: DataTypes.STRING(100), allowNull: true },
        voyageNumber: { type: DataTypes.STRING(50), allowNull: true },
        flightNumber: { type: DataTypes.STRING(20), allowNull: true },
        mblNumber: { type: DataTypes.STRING(50), allowNull: true },
        containerNumbers: { type: DataTypes.JSON, allowNull: true },
        packages: { type: DataTypes.INTEGER, allowNull: true },
        packUnit: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'PKG' },
        grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        weightUnit: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'kg' },
        volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        volumeUnit: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'm3' },
        commodity: { type: DataTypes.STRING(200), allowNull: true },
        incoterm: { type: DataTypes.STRING(10), allowNull: true },
        currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
        status: { type: DataTypes.ENUM('draft', 'confirmed', 'in_transit', 'arrived', 'delivered', 'cancelled'), allowNull: false, defaultValue: 'draft' },
        extCarrierBookings: { type: DataTypes.JSON, allowNull: true },
        parties: { type: DataTypes.JSON, allowNull: true },
        packageLines: { type: DataTypes.JSON, allowNull: true },
        routingLegs: { type: DataTypes.JSON, allowNull: true },
        milestones: { type: DataTypes.JSON, allowNull: true },
        termsAndConditions: { type: DataTypes.TEXT, allowNull: true },
        remarks: { type: DataTypes.TEXT, allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created master_shipments table.');
    } else {
      const columns = await qi.describeTable('master_shipments');
      if (columns.status && !columns.status.type.includes('ext_booked')) {
        await sequelize.query("ALTER TABLE master_shipments MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'created'");
        await sequelize.query("UPDATE master_shipments SET status = 'created' WHERE status = 'draft'");
        await sequelize.query("UPDATE master_shipments SET status = 'ext_booked' WHERE status IN ('confirmed','in_transit','arrived')");
        await sequelize.query("UPDATE master_shipments SET status = 'completed' WHERE status = 'delivered'");
        await sequelize.query(
          "ALTER TABLE master_shipments MODIFY COLUMN status ENUM('created','ext_booked','cancelled','completed') NOT NULL DEFAULT 'created'"
        );
        console.log('Widened master_shipments.status enum to created/ext_booked/cancelled/completed workflow.');
      }
    }

    if (!tables.includes('cfs_receipts')) {
      await qi.createTable('cfs_receipts', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        receiptNumber: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        ffJobId: { type: DataTypes.UUID, allowNull: true },
        cfsLocation: { type: DataTypes.STRING(150), allowNull: true },
        gateInDate: { type: DataTypes.DATE, allowNull: true },
        direction: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'EXPORT' },
        transportMode: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'SEA' },
        cargoType: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'LCL' },
        serviceMode: { type: DataTypes.STRING(50), allowNull: true },
        supplierRefNo: { type: DataTypes.STRING(100), allowNull: true },
        origin: { type: DataTypes.STRING(150), allowNull: true },
        destination: { type: DataTypes.STRING(150), allowNull: true },
        shipper: { type: DataTypes.STRING(150), allowNull: true },
        consignee: { type: DataTypes.STRING(150), allowNull: true },
        containerNumber: { type: DataTypes.STRING(30), allowNull: true },
        vehicleNumber: { type: DataTypes.STRING(30), allowNull: true },
        driverName: { type: DataTypes.STRING(100), allowNull: true },
        packages: { type: DataTypes.INTEGER, allowNull: true },
        packUnit: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'PKG' },
        grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        weightUnit: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'kg' },
        volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        volumeUnit: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'm3' },
        remarks: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.ENUM('created', 'received', 'stuffed', 'cancelled'), allowNull: false, defaultValue: 'created' },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created cfs_receipts table.');
    } else {
      const columns = await qi.describeTable('cfs_receipts');
      if (columns.status && !columns.status.type.includes('stuffed')) {
        await sequelize.query("ALTER TABLE cfs_receipts MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'created'");
        await sequelize.query("UPDATE cfs_receipts SET status = 'created' WHERE status = 'draft'");
        await sequelize.query(
          "ALTER TABLE cfs_receipts MODIFY COLUMN status ENUM('created','received','stuffed','cancelled') NOT NULL DEFAULT 'created'"
        );
        console.log('Widened cfs_receipts.status enum to created/received/stuffed/cancelled workflow.');
      }
      const newCols = {
        direction: "VARCHAR(10) DEFAULT 'EXPORT'",
        serviceMode: 'VARCHAR(50)',
        supplierRefNo: 'VARCHAR(100)',
        origin: 'VARCHAR(150)',
        destination: 'VARCHAR(150)',
        shipper: 'VARCHAR(150)',
        consignee: 'VARCHAR(150)',
      };
      for (const [col, def] of Object.entries(newCols)) {
        if (!columns[col]) {
          await sequelize.query(`ALTER TABLE cfs_receipts ADD COLUMN ${col} ${def}`);
          console.log(`Added cfs_receipts.${col} column.`);
        }
      }
    }

    if (!tables.includes('cfs_deliveries')) {
      await qi.createTable('cfs_deliveries', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        deliveryNumber: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        ffJobId: { type: DataTypes.UUID, allowNull: true },
        cfsLocation: { type: DataTypes.STRING(150), allowNull: true },
        gateOutDate: { type: DataTypes.DATE, allowNull: true },
        direction: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'EXPORT' },
        transportMode: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'SEA' },
        cargoType: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'LCL' },
        serviceMode: { type: DataTypes.STRING(50), allowNull: true },
        supplierRefNo: { type: DataTypes.STRING(100), allowNull: true },
        origin: { type: DataTypes.STRING(150), allowNull: true },
        destination: { type: DataTypes.STRING(150), allowNull: true },
        shipper: { type: DataTypes.STRING(150), allowNull: true },
        consignee: { type: DataTypes.STRING(150), allowNull: true },
        containerNumber: { type: DataTypes.STRING(30), allowNull: true },
        vehicleNumber: { type: DataTypes.STRING(30), allowNull: true },
        driverName: { type: DataTypes.STRING(100), allowNull: true },
        packages: { type: DataTypes.INTEGER, allowNull: true },
        packUnit: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'PKG' },
        grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        weightUnit: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'kg' },
        volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        volumeUnit: { type: DataTypes.STRING(5), allowNull: true, defaultValue: 'm3' },
        remarks: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.ENUM('created', 'delivered', 'cancelled'), allowNull: false, defaultValue: 'created' },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created cfs_deliveries table.');
    } else {
      const columns = await qi.describeTable('cfs_deliveries');
      if (columns.status && columns.status.type.includes('draft')) {
        await sequelize.query("ALTER TABLE cfs_deliveries MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'created'");
        await sequelize.query("UPDATE cfs_deliveries SET status = 'created' WHERE status = 'draft'");
        await sequelize.query(
          "ALTER TABLE cfs_deliveries MODIFY COLUMN status ENUM('created','delivered','cancelled') NOT NULL DEFAULT 'created'"
        );
        console.log('Widened cfs_deliveries.status enum to created/delivered/cancelled workflow.');
      }
      const newCols = {
        direction: "VARCHAR(10) DEFAULT 'EXPORT'",
        serviceMode: 'VARCHAR(50)',
        supplierRefNo: 'VARCHAR(100)',
        origin: 'VARCHAR(150)',
        destination: 'VARCHAR(150)',
        shipper: 'VARCHAR(150)',
        consignee: 'VARCHAR(150)',
      };
      for (const [col, def] of Object.entries(newCols)) {
        if (!columns[col]) {
          await sequelize.query(`ALTER TABLE cfs_deliveries ADD COLUMN ${col} ${def}`);
          console.log(`Added cfs_deliveries.${col} column.`);
        }
      }
    }

    if (!tables.includes('consolidations')) {
      await qi.createTable('consolidations', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        consolidationNumber: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        transportMode: { type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL'), allowNull: false, defaultValue: 'SEA' },
        direction: { type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'), allowNull: false, defaultValue: 'EXPORT' },
        cargoType: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'FCL' },
        origin: { type: DataTypes.STRING(200), allowNull: true },
        destination: { type: DataTypes.STRING(200), allowNull: true },
        carrier: { type: DataTypes.STRING(100), allowNull: true },
        vesselName: { type: DataTypes.STRING(100), allowNull: true },
        voyageNumber: { type: DataTypes.STRING(50), allowNull: true },
        mblNumber: { type: DataTypes.STRING(50), allowNull: true },
        etd: { type: DataTypes.DATE, allowNull: true },
        eta: { type: DataTypes.DATE, allowNull: true },
        containerNumbers: { type: DataTypes.JSON, allowNull: true },
        houseShipmentIds: { type: DataTypes.JSON, allowNull: true },
        status: { type: DataTypes.ENUM('draft', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled'), allowNull: false, defaultValue: 'draft' },
        remarks: { type: DataTypes.TEXT, allowNull: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created consolidations table.');
    } else {
      // Export Console Generation's detail form was expanded to match the live
      // SeaRates layout (Consolidation Type / Sailing Schedule / Party /
      // POR-POD-POL-FPD / Vessel Info / Package + Commodity lines).
      const consCols = await qi.describeTable('consolidations');
      const additions = {
        shipmentType: "VARCHAR(10) DEFAULT 'EXP'",
        serviceMode: 'VARCHAR(50) NULL',
        consolidationDate: 'DATE NULL',
        consolidationType: 'VARCHAR(60) NULL',
        tags: 'VARCHAR(200) NULL',
        sailingSchedule: 'VARCHAR(150) NULL',
        company: 'VARCHAR(150) NULL',
        agent: 'VARCHAR(200) NULL',
        coLoader: 'VARCHAR(200) NULL',
        por: 'VARCHAR(200) NULL',
        pod: 'VARCHAR(200) NULL',
        pol: 'VARCHAR(200) NULL',
        fpd: 'VARCHAR(200) NULL',
        shippingLine: 'VARCHAR(150) NULL',
        carrierRefNumber: 'VARCHAR(100) NULL',
        incoterm: 'VARCHAR(20) NULL',
        atd: 'DATETIME NULL',
        packs: 'INT DEFAULT 0',
        totalVolume: 'DECIMAL(12,3) DEFAULT 0',
        totalWeight: 'DECIMAL(12,3) DEFAULT 0',
        estimatedRevenue: 'DECIMAL(14,2) DEFAULT 0',
        estimatedCost: 'DECIMAL(14,2) DEFAULT 0',
        packageLines: 'JSON NULL',
        commodityLines: 'JSON NULL',
      };
      for (const [col, def] of Object.entries(additions)) {
        if (!consCols[col]) {
          await sequelize.query(`ALTER TABLE consolidations ADD COLUMN \`${col}\` ${def}`);
          console.log(`Added consolidations.${col} column.`);
        }
      }
    }

    if (!tables.includes('organizations')) {
      // Partner master behind the Organizations module. Columns follow the
      // SeaRates Organizations form (header + its six tabs).
      await qi.createTable('organizations', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        companyType: { type: DataTypes.ENUM('person', 'company'), allowNull: false, defaultValue: 'person' },
        name: { type: DataTypes.STRING(200), allowNull: false },
        companyName: { type: DataTypes.STRING(200), allowNull: true },
        customerCode: { type: DataTypes.STRING(40), allowNull: true },
        branchCode: { type: DataTypes.STRING(40), allowNull: true },
        parentId: { type: DataTypes.UUID, allowNull: true },
        addressType: { type: DataTypes.ENUM('contact', 'invoice', 'delivery', 'other'), defaultValue: 'contact' },
        markAsDefault: { type: DataTypes.BOOLEAN, defaultValue: true },
        avatar: { type: DataTypes.TEXT, allowNull: true },
        streetName: { type: DataTypes.STRING(200), allowNull: true },
        houseNumber: { type: DataTypes.STRING(30), allowNull: true },
        doorNumber: { type: DataTypes.STRING(30), allowNull: true },
        street2: { type: DataTypes.STRING(200), allowNull: true },
        state: { type: DataTypes.STRING(100), allowNull: true },
        city: { type: DataTypes.STRING(100), allowNull: true },
        zip: { type: DataTypes.STRING(20), allowNull: true },
        country: { type: DataTypes.STRING(100), allowNull: true },
        identificationType: { type: DataTypes.STRING(30), defaultValue: 'VAT' },
        identificationNumber: { type: DataTypes.STRING(60), allowNull: true },
        vat: { type: DataTypes.STRING(60), allowNull: true },
        pst: { type: DataTypes.STRING(60), allowNull: true },
        partyTypes: { type: DataTypes.JSON, allowNull: true },
        freightCarrier: { type: DataTypes.STRING(150), allowNull: true },
        jobPosition: { type: DataTypes.STRING(120), allowNull: true },
        phone: { type: DataTypes.STRING(40), allowNull: true },
        mobile: { type: DataTypes.STRING(40), allowNull: true },
        fax: { type: DataTypes.STRING(40), allowNull: true },
        email: { type: DataTypes.STRING(150), allowNull: true },
        website: { type: DataTypes.STRING(200), allowNull: true },
        title: { type: DataTypes.STRING(40), allowNull: true },
        language: { type: DataTypes.STRING(40), defaultValue: 'English (US)' },
        tags: { type: DataTypes.JSON, allowNull: true },
        transactionType: { type: DataTypes.ENUM('b2b', 'b2c'), defaultValue: 'b2b' },
        contactPerson: { type: DataTypes.STRING(150), allowNull: true },
        govtRegNumber: { type: DataTypes.STRING(80), allowNull: true },
        internalRefNo: { type: DataTypes.STRING(80), allowNull: true },
        localizationCountryCode: { type: DataTypes.STRING(5), allowNull: true },
        salesperson: { type: DataTypes.STRING(150), allowNull: true },
        salesTeam: { type: DataTypes.STRING(150), allowNull: true },
        paymentTerms: { type: DataTypes.STRING(100), allowNull: true },
        pricelist: { type: DataTypes.STRING(100), allowNull: true },
        supplierPaymentTerms: { type: DataTypes.STRING(100), allowNull: true },
        receiptReminder: { type: DataTypes.BOOLEAN, defaultValue: false },
        daysBeforeReceipt: { type: DataTypes.INTEGER, allowNull: true },
        supplierCurrency: { type: DataTypes.STRING(10), allowNull: true },
        fiscalPosition: { type: DataTypes.STRING(100), allowNull: true },
        reference: { type: DataTypes.STRING(80), allowNull: true },
        company: { type: DataTypes.STRING(150), allowNull: true },
        industry: { type: DataTypes.STRING(100), allowNull: true },
        bankAccounts: { type: DataTypes.JSON, allowNull: true },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        accountReceivable: { type: DataTypes.STRING(100), allowNull: true },
        accountPayable: { type: DataTypes.STRING(100), allowNull: true },
        showCreditLimit: { type: DataTypes.BOOLEAN, defaultValue: false },
        internalCreditLimit: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
        totalReceivable: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
        isCredit: { type: DataTypes.BOOLEAN, defaultValue: false },
        isCreditOrCash: { type: DataTypes.BOOLEAN, defaultValue: false },
        approvedCreditDays: { type: DataTypes.INTEGER, allowNull: true },
        approvedCreditLimit: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
        creditLimitRules: { type: DataTypes.JSON, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        invoiceWarn: { type: DataTypes.STRING(30), defaultValue: 'no-message' },
        invoiceWarnMsg: { type: DataTypes.TEXT, allowNull: true },
        appCode: { type: DataTypes.STRING(60), allowNull: true },
        customerType: { type: DataTypes.ENUM('billing', 'consignee'), allowNull: true },
        inwardStrategy: { type: DataTypes.ENUM('fifo', 'fifo_batch', 'batch'), allowNull: true },
        pickStrategy: { type: DataTypes.ENUM('fifo', 'fifo_batch', 'batch'), allowNull: true },
        einNo: { type: DataTypes.STRING(60), allowNull: true },
        reportName: { type: DataTypes.STRING(120), allowNull: true },
        warehouseCode: { type: DataTypes.STRING(60), allowNull: true },
        warehouseCodes: { type: DataTypes.JSON, allowNull: true },
        operationAutoEmail: { type: DataTypes.BOOLEAN, defaultValue: false },
        customerRefId: { type: DataTypes.STRING(80), allowNull: true },
        ccEmail: { type: DataTypes.STRING(150), allowNull: true },
        bccEmail: { type: DataTypes.STRING(150), allowNull: true },
        nifNo: { type: DataTypes.STRING(60), allowNull: true },
        meetingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        totalInvoiced: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
        totalBilled: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
        vendorBillCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created organizations table.');
    } else {
      // The Organizations form later gained the KYC progress bar, the workflow
      // ribbon (which needs a Customer link to count related documents), and the
      // chatter feed.
      const orgCols = await qi.describeTable('organizations');
      const orgAdditions = {
        kycStatus: "ENUM('new','kyc_pending','kyc_done') DEFAULT 'new'",
        customerId: 'CHAR(36) NULL',
        activityLog: 'JSON NULL',
        followerCount: 'INT DEFAULT 0',
      };
      for (const [col, def] of Object.entries(orgAdditions)) {
        if (!orgCols[col]) {
          await sequelize.query(`ALTER TABLE organizations ADD COLUMN \`${col}\` ${def}`);
          console.log(`Added organizations.${col} column.`);
        }
      }
    }

    if (!tables.includes('shipment_sharings')) {
      await qi.createTable('shipment_sharings', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        sharingNumber: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        direction: { type: DataTypes.ENUM('import_to_export', 'export_to_import'), allowNull: false, defaultValue: 'import_to_export' },
        sourceCompany: { type: DataTypes.STRING(150), allowNull: true },
        targetCompany: { type: DataTypes.STRING(150), allowNull: true },
        shipmentRef: { type: DataTypes.STRING(60), allowNull: true },
        ffJobId: { type: DataTypes.UUID, allowNull: true },
        transportMode: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'SEA' },
        cargoType: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'FCL' },
        origin: { type: DataTypes.STRING(200), allowNull: true },
        destination: { type: DataTypes.STRING(200), allowNull: true },
        status: { type: DataTypes.ENUM('created', 'booked', 'confirmed', 'nomination_generated', 'in_transit', 'arrived', 'completed', 'cancelled'), allowNull: false, defaultValue: 'created' },
        converted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        remarks: { type: DataTypes.TEXT, allowNull: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created shipment_sharings table.');
    }

    if (!tables.includes('ocr_documents')) {
      await qi.createTable('ocr_documents', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        fileName: { type: DataTypes.STRING(255), allowNull: false },
        shipmentRef: { type: DataTypes.STRING(60), allowNull: true },
        ffJobId: { type: DataTypes.UUID, allowNull: true },
        filePath: { type: DataTypes.STRING(500), allowNull: true },
        charge: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        errorMessage: { type: DataTypes.TEXT, allowNull: true },
        ocrPayload: { type: DataTypes.JSON, allowNull: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created ocr_documents table.');
    }

    if (!tables.includes('container_numbers')) {
      await qi.createTable('container_numbers', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        containerNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
        status: { type: DataTypes.ENUM('unused', 'used'), allowNull: false, defaultValue: 'unused' },
        linkedPackageId: { type: DataTypes.UUID, allowNull: true },
        linkedShipmentNumber: { type: DataTypes.STRING(60), allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created container_numbers table.');
    }

    // service_jobs predates the Operations module rebuild - add the extra
    // JSON columns needed for the 7-tab Service Job detail view if missing.
    if (tables.includes('service_jobs')) {
      const columns = await qi.describeTable('service_jobs');
      if (!columns.parties) {
        await qi.addColumn('service_jobs', 'parties', { type: DataTypes.JSON, allowNull: true });
        console.log('Added parties column to service_jobs table.');
      }
      if (!columns.routingLegs) {
        await qi.addColumn('service_jobs', 'routingLegs', { type: DataTypes.JSON, allowNull: true });
        console.log('Added routingLegs column to service_jobs table.');
      }
      if (!columns.activityLog) {
        await qi.addColumn('service_jobs', 'activityLog', { type: DataTypes.JSON, allowNull: true });
        console.log('Added activityLog column to service_jobs table.');
      }
      if (!columns.termsAndConditions) {
        await qi.addColumn('service_jobs', 'termsAndConditions', { type: DataTypes.TEXT, allowNull: true });
        console.log('Added termsAndConditions column to service_jobs table.');
      }
    }
    if (!tables.includes('master_data_items')) {
      await qi.createTable('master_data_items', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        category: { type: DataTypes.STRING(60), allowNull: false },
        code: { type: DataTypes.STRING(50), allowNull: true },
        name: { type: DataTypes.STRING(150), allowNull: false },
        extra: { type: DataTypes.STRING(150), allowNull: true },
        extra2: { type: DataTypes.STRING(150), allowNull: true },
        extra3: { type: DataTypes.STRING(150), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('master_data_items', ['category']);
      console.log('Created master_data_items table.');
    } else {
      const mdiColumns = await qi.describeTable('master_data_items');
      if (!mdiColumns.extra2) {
        await qi.addColumn('master_data_items', 'extra2', { type: DataTypes.STRING(150), allowNull: true });
        console.log('Added extra2 column to master_data_items table.');
      }
      if (!mdiColumns.extra3) {
        await qi.addColumn('master_data_items', 'extra3', { type: DataTypes.STRING(150), allowNull: true });
        console.log('Added extra3 column to master_data_items table.');
      }
    }
  } catch (error) {
    console.error('Error ensuring operations tables:', error.message);
  }
};

const seedIncoterms = async () => {
  try {
    const { Incoterm } = require('../models');
    const count = await Incoterm.count();
    if (count === 0) {
      const defaults = [
        { code: 'FCA', name: 'FREE CARRIER', enablePickupDelivery: true, sortOrder: 1 },
        { code: 'FAS', name: 'FREE ALONGSIDE SHIP', enablePickupDelivery: true, sortOrder: 2 },
        { code: 'FOB', name: 'FREE ON BOARD', enablePickupDelivery: true, sortOrder: 3 },
        { code: 'CFR', name: 'COST AND FREIGHT', enablePickupDelivery: true, sortOrder: 4 },
        { code: 'CIF', name: 'COST, INSURANCE AND FREIGHT', enablePickupDelivery: false, sortOrder: 5 },
        { code: 'CPT', name: 'CARRIAGE PAID TO', enablePickupDelivery: true, sortOrder: 6 },
        { code: 'DAP', name: 'DELIVERED AT PLACE', enablePickupDelivery: true, sortOrder: 7 },
        { code: 'DDP', name: 'DELIVERED DUTY PAID', enablePickupDelivery: true, sortOrder: 8 },
        { code: 'EXW', name: 'EX WORKS', enablePickupDelivery: true, sortOrder: 9 },
      ];
      await Incoterm.bulkCreate(defaults);
      console.log('Seeded default Incoterms.');
    }
  } catch (error) {
    console.error('Error seeding incoterms:', error.message);
  }
};

// Administration > Manage master lists (Languages, Container Category,
// Vessels, Countries, etc.) - seeded once per category so each page renders
// real records instead of an empty table.
const seedMasterData = async () => {
  try {
    const { MasterDataItem } = require('../models');
    const seeds = {
      languages: [
        { code: 'EN', name: 'English' },
        { code: 'AR', name: 'Arabic' },
        { code: 'FR', name: 'French' },
        { code: 'HI', name: 'Hindi' },
        { code: 'ZH', name: 'Chinese' },
      ],
      'container-category': [
        { name: 'Dry storage container' },
        { name: 'Flat rack container' },
        { name: 'Open top container' },
        { name: 'Open side storage container' },
        { name: 'Refrigerated ISO containers' },
        { name: 'ISO Tanks' },
        { name: 'Half height containers' },
        { name: 'Special purpose containers' },
      ],
      'container-package-type': [
        { code: '20GP', name: 'Twenty foot flatrack', extra: '-' },
        { code: '40 FR', name: 'Forty foot flatrack', extra: 'Dry storage container' },
        { code: '40REHC', name: 'Forty foot high cube reefer', extra: 'Refrigerated ISO containers' },
        { code: '40GP', name: 'Forty foot general purpose', extra: '-' },
        { code: '40PL', name: 'Forty foot platform', extra: 'Flat rack container' },
        { code: '40RE', name: 'Forty foot reefer', extra: 'Refrigerated ISO containers' },
        { code: '40NOR', name: 'Forty foot non-operating reefer', extra: 'Refrigerated ISO containers' },
        { code: '40FR', name: 'Forty foot flatrack', extra: '-' },
        { code: '40HC', name: 'Forty foot high cube', extra: '-' },
        { code: '40OT', name: 'Forty foot open top', extra: '-' },
        { code: '20RE', name: 'Twenty foot reefer', extra: 'Refrigerated ISO containers' },
        { code: '20NOR', name: 'Twenty foot non-operating reefer', extra: 'Refrigerated ISO containers' },
        { code: '20HD', name: 'Twenty foot high cube', extra: '-' },
        { code: '20PL', name: 'Twenty foot platform', extra: '-' },
        { code: '20FR', name: 'Twenty foot flatrack', extra: '-' },
        { code: '20DPW', name: '20DPW', extra: '-' },
        { code: '20PF', name: '20PF', extra: '-' },
        { code: '42GP', name: '42GP', extra: '-' },
        { code: 'PM-2H', name: 'PM-2H', extra: '-' },
        { code: 'ULD', name: 'ULD', extra: '-' },
        { code: 'B.B', name: 'Break Bulk', extra: '-' },
        { code: '4T Flatbed', name: '4T Flatbed – 4 Ton Flatbed Truck', extra: '-' },
        { code: '6T Flatbed', name: '6T Flatbed – 6 Ton Flatbed Truck', extra: '-' },
        { code: '10T Flatbed', name: '10T Flatbed – 10 Ton Flatbed Truck', extra: '-' },
      ],
      'mawb-stocks': [
        { name: 'Dubai Airport-[UAE-da]', code: '0123456', extra: '-', extra2: 'Emirates1', extra3: 'Draft' },
        { name: 'Dubai-[UAE-DXB]', code: '7891234', extra: 'CPA-1', extra2: 'Emirates1', extra3: 'Draft' },
        { name: 'Dubai-[UAE-DXB]', code: '0918765', extra: '-', extra2: 'Emirates1', extra3: 'Locked' },
        { name: 'INHAL-[India-INHAL]', code: '0913777', extra: '-', extra2: 'Emirates1', extra3: 'Draft' },
      ],
      'status-change-reasons': [
        { name: 'Quote on hold by customer' },
        { name: 'Delayed Customer response' },
        { name: 'Not needed anymore' },
        { name: 'Customer booked from other agency' },
      ],
      'wms-warehouses': [
        { code: 'WH001', name: 'WH001', extra: 'Gandhinagar', extra2: '9397594854', extra3: 'hyperlift@gmail.com' },
        { code: 'SR-WH001', name: 'SR-WH001', extra: 'Dubai', extra2: '123456789', extra3: 'wh@example.com' },
        { code: 'WH-IN001', name: 'WH India', extra: 'Ahmedabad', extra2: '1234567890', extra3: 'test@example.com' },
        { code: '', name: '1211', extra: '-', extra2: '-', extra3: '-' },
        { code: 'JFZ001', name: 'JAFZA 123', extra: 'Dubai', extra2: '97100000000', extra3: 'jafza123@warehouse.com' },
        { code: '', name: 'NIL', extra: '-', extra2: '-', extra3: '-' },
      ],
      'serial-number': [
        { name: 'Delivery Entry', extra: 'CFS', extra2: 'cfs.delivery.entry', extra3: 'Sequence' },
        { name: 'Freight Booking Request Serial', extra: 'Freight Booking', extra2: 'freight.booking.request', extra3: 'Sequence' },
        { name: 'Consol Generation', extra: 'Consolidation', extra2: 'freight.consol', extra3: 'Sequence' },
        { name: 'Service Job', extra: 'Service Job', extra2: 'service.job', extra3: 'Sequence' },
        { name: 'House Shipment', extra: 'House Shipment', extra2: 'house.shipment', extra3: 'Sequence' },
        { name: 'Inspection Request Sequence', extra: 'Inspection', extra2: 'inspection.request', extra3: 'Sequence' },
        { name: 'Master Shipment', extra: 'Master Shipment', extra2: 'master.shipment', extra3: 'Sequence' },
        { name: 'Pro Forma Invoice', extra: 'Invoice', extra2: 'pro.forma.invoice', extra3: 'Sequence' },
        { name: 'Prospect Lead', extra: 'CRM', extra2: 'prospect.lead', extra3: 'Sequence' },
        { name: 'Prospect Opportunity', extra: 'CRM', extra2: 'prospect.opportunity', extra3: 'Sequence' },
        { name: 'Service-Job Quote', extra: 'Service Job', extra2: 'service.job.quote', extra3: 'Sequence' },
        { name: 'Shipment Quote', extra: 'Quotation', extra2: 'shipment.quote', extra3: 'Sequence' },
        { name: 'Receive Entry', extra: 'CFS', extra2: 'cfs.receive.entry', extra3: 'Sequence' },
      ],
      incoterm: [
        { code: 'FCA', name: 'FREE CARRIER', isActive: true },
        { code: 'FAS', name: 'FREE ALONGSIDE SHIP', isActive: true },
        { code: 'FOB', name: 'FREE ON BOARD', isActive: true },
        { code: 'CFR', name: 'COST AND FREIGHT', isActive: true },
        { code: 'CIF', name: 'COST, INSURANCE AND FREIGHT', isActive: false },
        { code: 'CPT', name: 'CARRIAGE PAID TO', isActive: true },
        { code: 'DAP', name: 'DELIVERED AT PLACE', isActive: true },
        { code: 'DDP', name: 'DELIVERED DUTY PAID', isActive: true },
        { code: 'EXW', name: 'EX WORKS', isActive: true },
      ],
      'truck-number': [
        { code: 'DXB-T-1001', name: 'Truck 1001', extra: 'Volvo FH16, 40ft Flatbed' },
        { code: 'DXB-T-1002', name: 'Truck 1002', extra: 'Mercedes Actros, 20ft Container' },
        { code: 'SHJ-T-2001', name: 'Truck 2001', extra: 'Scania R450, 40ft HC' },
      ],
      'location-type': [
        { code: 'PORT', name: 'Sea Port' },
        { code: 'AIRPORT', name: 'Airport' },
        { code: 'ICD', name: 'Inland Container Depot' },
        { code: 'CFS', name: 'Container Freight Station' },
        { code: 'WAREHOUSE', name: 'Warehouse' },
      ],
      'warehouse-depot': [
        { code: 'DEPOT-DXB', name: 'Jebel Ali Container Depot', extra: 'Dubai, UAE' },
        { code: 'DEPOT-SHJ', name: 'Sharjah Container Depot', extra: 'Sharjah, UAE' },
      ],
      'manage-milestones': [
        { code: 'BOOK-CONF', name: 'Booking Confirmed' },
        { code: 'GATE-IN', name: 'Gate In' },
        { code: 'LOADED', name: 'Loaded on Vessel' },
        { code: 'DEPARTED', name: 'Vessel Departed' },
        { code: 'ARRIVED', name: 'Vessel Arrived' },
        { code: 'GATE-OUT', name: 'Gate Out' },
        { code: 'DELIVERED', name: 'Delivered' },
      ],
      countries: [
        { name: 'United Arab Emirates', code: 'AE' },
        { name: 'India', code: 'IN' },
        { name: 'United States', code: 'US' },
        { name: 'United Kingdom', code: 'GB' },
        { name: 'China', code: 'CN' },
        { name: 'Singapore', code: 'SG' },
        { name: 'Afghanistan', code: 'AF' },
        { name: 'Albania', code: 'AL' },
        { name: 'Australia', code: 'AU' },
        { name: 'Austria', code: 'AT' },
      ],
      'fed-states': [
        { code: 'DXB', name: 'Dubai', extra: 'United Arab Emirates' },
        { code: 'AUH', name: 'Abu Dhabi', extra: 'United Arab Emirates' },
        { code: 'MH', name: 'Maharashtra', extra: 'India' },
        { code: 'CA', name: 'California', extra: 'United States' },
      ],
      'country-group': [
        { code: 'GCC', name: 'Gulf Cooperation Council' },
        { code: 'EU', name: 'European Union' },
        { code: 'ASEAN', name: 'ASEAN' },
      ],
      cities: [
        { code: 'DXB', name: 'Dubai', extra: 'United Arab Emirates' },
        { code: 'AUH', name: 'Abu Dhabi', extra: 'United Arab Emirates' },
        { code: 'BOM', name: 'Mumbai', extra: 'India' },
        { code: 'SIN', name: 'Singapore', extra: 'Singapore' },
        { code: 'SHA', name: 'Shanghai', extra: 'China' },
      ],
      'shipment-change-reason': [
        { code: 'ROUTE-CHANGE', name: 'Routing Change' },
        { code: 'VESSEL-CHANGE', name: 'Vessel Substitution' },
        { code: 'CARGO-READY-DELAY', name: 'Cargo Readiness Delay' },
      ],
      'service-job-type': [
        { code: 'CUSTOMS', name: 'Customs Clearance' },
        { code: 'TRANSPORT', name: 'Inland Transportation' },
        { code: 'WAREHOUSING', name: 'Warehousing' },
        { code: 'INSURANCE', name: 'Cargo Insurance' },
      ],
      'custom-be-type': [
        { code: 'BE-IMP', name: 'Bill of Entry - Import' },
        { code: 'BE-EXP', name: 'Shipping Bill - Export' },
        { code: 'BE-TRANSIT', name: 'Bill of Entry - Transit' },
      ],
      vessel: [
        { code: 'APOLLO LUPUS', name: 'APOLLO LUPUS', extra: '9282089', extra2: '304447000' },
        { code: 'NORTHERN PRACTISE', name: 'NORTHERN PRACTISE', extra: '9450301', extra2: '636091717' },
        { code: 'MARINA VOYAGER', name: 'MARINA VOYAGER', extra: '9400813', extra2: '352544000' },
        { code: 'INTERASIA HORIZON', name: 'INTERASIA HORIZON', extra: '9351050', extra2: '563961000' },
        { code: 'MSC GULSUN', name: 'MSC GULSUN', extra: '9839430', extra2: '215903000' },
        { code: 'EVER ACE', name: 'EVER ACE', extra: '9893890', extra2: '416902000' },
      ],
      'vessel-category': [
        { code: 'ULCV', name: 'Ultra Large Container Vessel' },
        { code: 'FEEDER', name: 'Feeder Vessel' },
        { code: 'TANKER', name: 'Tanker' },
        { code: 'BULK', name: 'Bulk Carrier' },
      ],
      'transaction-workflow': [
        { code: 'WF-HBL', name: 'House Shipment Approval Workflow', extra: 'House Shipment' },
        { code: 'WF-INV', name: 'Invoice Approval Workflow', extra: 'Invoice' },
        { code: 'WF-CFS', name: 'CFS Entry Workflow', extra: 'CFS Receive/Delivery' },
      ],
      'milestone-activity-master': [
        { code: 'ACT-BOOK', name: 'Create Booking', extra: 'Booking Stage' },
        { code: 'ACT-DOC', name: 'Submit Shipping Documents', extra: 'Documentation Stage' },
        { code: 'ACT-CUSTOMS', name: 'File Customs Declaration', extra: 'Customs Stage' },
        { code: 'ACT-DELIVERY', name: 'Arrange Final Delivery', extra: 'Delivery Stage' },
      ],
      'credit-request-master': [
        { code: 'CR-STD', name: 'Standard Credit Request', extra: '30 Days' },
        { code: 'CR-EXT', name: 'Extended Credit Request', extra: '60 Days' },
        { code: 'CR-VIP', name: 'VIP Customer Credit Request', extra: '90 Days' },
      ],
      carriers: [
        { code: '[SEA] Sea Freight', name: 'Maersk Line', extra: 'maersk@example.com', extra2: 'John Carter', extra3: 'Maersk A/S' },
        { code: '[SEA] Sea Freight', name: 'CMA CGM', extra: 'cma@example.com', extra2: 'Pierre Dubois', extra3: 'CMA CGM Group' },
        { code: '[SEA] Sea Freight', name: 'Hapag-Lloyd', extra: 'hapag@example.com', extra2: 'Lars Schmidt', extra3: 'Hapag-Lloyd AG' },
        { code: '[SEA] Sea Freight', name: 'Evergreen Line', extra: 'evergreen@example.com', extra2: 'Wei Chen', extra3: 'Evergreen Marine Corp' },
        { code: '[SEA] Sea Freight', name: 'MSC', extra: 'msc@example.com', extra2: 'Marco Rossi', extra3: 'Mediterranean Shipping Company' },
        { code: '[AIR] Air Freight', name: 'Emirates SkyCargo', extra: 'skycargo@example.com', extra2: 'Ahmed Al Falasi', extra3: 'Emirates Group' },
        { code: '[AIR] Air Freight', name: 'Qatar Airways Cargo', extra: 'cargo@example.com', extra2: 'Sara Al Thani', extra3: 'Qatar Airways' },
        { code: '[AIR] Air Freight', name: 'Lufthansa Cargo', extra: 'lhcargo@example.com', extra2: 'Hans Müller', extra3: 'Lufthansa Group' },
        { code: '[ROA] Road Freight', name: 'Aramex', extra: 'aramex@example.com', extra2: 'Khalid Hassan', extra3: 'Aramex PJSC' },
        { code: '[ROA] Road Freight', name: 'DHL Road', extra: 'dhlroad@example.com', extra2: 'Frank Weber', extra3: 'DHL Group' },
      ],
      'carrier-agent': [
        { code: 'A-4', name: 'Ahmed', extra: 'test@email.com', extra2: 'India' },
        { code: 'AL-7', name: 'Alaska LLP', extra: 'Alaska@gmail.com', extra2: '-' },
        { code: 'AS-2', name: 'AUTRANSA SL', extra: '-', extra2: 'Spain' },
        { code: 'CA-3', name: 'Carrier Agent', extra: 'EG-AGENT@EXAMPLE.COM', extra2: 'Egypt' },
        { code: 'CCS-1', name: 'CMA CGM S.A.', extra: '-', extra2: '-' },
        { code: 'FE-3', name: 'Federal Express', extra: 'test@yahoo.com', extra2: '-' },
        { code: 'JC-1', name: 'JKL Company', extra: 'jkl@jkl.com', extra2: 'Philippines' },
        { code: 'LA-2', name: 'Lumber agent', extra: 'sam@hu.com', extra2: '-' },
      ],
      'hs-codes': [
        { code: '10011100', name: 'Durum wheat seeds', extra: '12323-12323', extra2: '-' },
        { code: '10011900', name: 'Durum wheat, other than seeds', extra: '-', extra2: '-' },
        { code: '10019100', name: 'Wheat and meslin seeds', extra: '-', extra2: '-' },
        { code: '10019910', name: 'Normal wheat', extra: '-', extra2: '-' },
        { code: '10019920', name: 'Thin wheat', extra: '-', extra2: '-' },
        { code: '10019930', name: 'Meslin', extra: '-', extra2: '-' },
        { code: '10021000', name: 'Rye seeds', extra: '-', extra2: '-' },
        { code: '10029000', name: 'Other rye other than seeds', extra: '-', extra2: '-' },
        { code: '10031000', name: 'Barley seed', extra: '-', extra2: '-' },
        { code: '10039000', name: 'Barley other than seed', extra: '-', extra2: '-' },
        { code: '10041000', name: 'Oats seed', extra: '-', extra2: '-' },
        { code: '10049010', name: 'Grey oats (or black)', extra: '-', extra2: '-' },
        { code: '10049020', name: 'White oats ( or yellow )', extra: '-', extra2: '-' },
        { code: '10051000', name: 'Maize (corn) seeds.', extra: '-', extra2: '-' },
      ],
      'un-locode-locations': [
        { code: 'AEDXB', name: 'DUBAI (UAE)', extra: 'United Arab Emirates', extra2: '-' },
        { code: 'INGDH', name: 'Gandhinagar', extra: 'India', extra2: '-' },
        { code: 'DXB', name: 'Dubai', extra: 'United Arab Emirates', extra2: '-' },
        { code: 'AEJEA', name: 'JEBEL ALI SEAPORT, U.A.E', extra: 'United Arab Emirates', extra2: '-' },
        { code: 'THBKK', name: 'BANGKOK, THAILAND', extra: 'Thailand', extra2: '-' },
        { code: 'THLCH', name: 'LAEM CHABANG, THAILAND', extra: 'Thailand', extra2: '-' },
        { code: 'INPAV', name: 'PIPAVAV (VICTOR) PORT, INDIA', extra: 'India', extra2: '-' },
        { code: 'SIKOP', name: 'KOPER, SLOVENIA', extra: 'Slovenia', extra2: '-' },
        { code: 'INGGN', name: 'GURGAON, INDIA', extra: 'India', extra2: '-' },
        { code: 'LYMRA', name: 'MISURATA SEAPORT, LIBYA', extra: 'Libya', extra2: '-' },
        { code: 'LYBEN', name: 'BENGHAZI SEAPORT, LIBYA', extra: 'Libya', extra2: '-' },
        { code: 'LYKHM', name: 'KHOMS, LIBYA', extra: 'Libya', extra2: '-' },
        { code: 'INDER', name: 'NOIDA/DADRI, INDIA', extra: 'India', extra2: '-' },
        { code: 'mun', name: 'mundra', extra: 'India', extra2: '-' },
      ],
      commodity: [
        { code: 'MACNUT', name: 'MACADAMIA NUTS', extra: '12024200 - Ground-nuts, not roasted or otherwise cooked, shelled', extra2: 'No' },
        { code: 'EDBO', name: 'Edible Oil (Packed)', extra: '-', extra2: 'No' },
        { code: '1123', name: 'BICICLETAS', extra: '10011100 - Durum wheat seeds', extra2: 'No' },
        { code: 'BASMATIBR', name: 'BASMATI BROWN RICE Briyani', extra: '10061000 - Rice in the husk (paddy or rough)', extra2: 'No' },
        { code: 'CBLS', name: 'CABLES', extra: '56075010 - Twine, cordage, ropes & cables, not plaited, of synthetic fibres', extra2: 'No' },
        { code: 'FRTL', name: 'FERTILISERS', extra: '-', extra2: 'Yes' },
        { code: 'RUBBER', name: 'rubber', extra: '38121000 - Prepared rubber accelerators.', extra2: 'No' },
        { code: 'Books', name: 'Books', extra: '-', extra2: 'No' },
        { code: 'TEXTILE', name: 'TEXTILE', extra: '-', extra2: 'No' },
        { code: 'G002', name: 'FABRIC', extra: '-', extra2: 'No' },
        { code: '1234', name: 'FINEMET COIL', extra: '-', extra2: 'No' },
        { code: 'Rice', name: 'Grains', extra: '-', extra2: 'No' },
        { code: 'UN 0323', name: 'Cartridge, power device', extra: '-', extra2: 'Yes' },
        { code: 'RICE', name: 'RICE', extra: '-', extra2: 'No' },
      ],
      'partner-kyc': [
        { name: 'Company Profile' },
        { name: 'Copy of Valid Trade License copy' },
        { name: 'Copy of Valid Commercial Registration license' },
        { name: 'Copy of Chamber of Commerce Registration Certificate' },
        { name: 'Latest 3 years Audited Financials' },
        { name: 'Signed agreement copy (Order Form)' },
        { name: 'Trade Certificate' },
      ],
      'custom-locations': [
        { name: 'DUBAI', extra: 'United Arab Emirates', extra2: '-', extra3: '-' },
        { name: 'NHAVA SHEVA', extra: 'India', extra2: '-', extra3: '-' },
        { name: 'Gujarat', extra: 'India', extra2: 'Gujarat', extra3: '-' },
        { name: 'london gateway', extra: 'United Kingdom', extra2: '-', extra3: '-' },
        { name: 'FELIXSTOWE', extra: 'United Kingdom', extra2: '-', extra3: '-' },
        { name: 'Tbilisi Gezi', extra: 'Georgia', extra2: '-', extra3: '-' },
        { name: 'Poti Gezi', extra: 'Georgia', extra2: '-', extra3: '-' },
        { name: 'USA', extra: 'United States', extra2: '-', extra3: '-' },
        { name: 'usa', extra: 'United States', extra2: '-', extra3: '-' },
        { name: 'Mundra', extra: 'India', extra2: '-', extra3: '-' },
        { name: 'White Cliffs Business Park', extra: 'United Kingdom', extra2: '-', extra3: '-' },
        { name: 'Namibia', extra: 'Namibia', extra2: '-', extra3: '-' },
        { name: 'Georgia', extra: 'Georgia', extra2: '-', extra3: '-' },
        { name: 'Sri Lanka', extra: 'Sri Lanka', extra2: '-', extra3: '-' },
      ],
      'outgoing-mail-servers': [
        { code: '10', name: 'Test', extra: 'mailhog.mailhog.svc.cluster.local', extra2: '-', extra3: 'None' },
      ],
      'email-templates': [
        { name: 'Applicant: Acknowledgement', code: 'Applicant', extra: 'Your Job Application: {{ object...', extra2: '-', extra3: "{{ object.partner_id.id or '' }}" },
        { name: 'Applicant: Interest', code: 'Applicant', extra: 'Your Job Application: {{ object...', extra2: '-', extra3: "{{ object.partner_id.id or '' }}" },
        { name: 'Applicant: Not interested anymore', code: 'Applicant', extra: 'Your Job Application: {{ object...', extra2: '-', extra3: "{{ object.partner_id.id or '' }}" },
        { name: 'Applicant: Refuse', code: 'Applicant', extra: 'Your Job Application: {{ object...', extra2: '-', extra3: "{{ object.partner_id.id or '' }}" },
        { name: 'Auth Signup: Portal Account Created', code: 'Users', extra: 'Welcome to {{ object.com...', extra2: '{{ (object.company_id.ema...', extra3: '{{ object.email_formatted }}' },
        { name: 'Auth Signup: Reset Password', code: 'Users', extra: 'Password reset', extra2: '{{ (object.company_id.ema...', extra3: '{{ object.email_formatted }}' },
        { name: 'Calendar: Event Update', code: 'Calendar Event', extra: '{{object.name}}: Event upd...', extra2: '{{ object.user_id.email_for...', extra3: '{{ object._get_attendee_e...' },
        { name: 'Calendar: Meeting Invitation', code: 'Calendar Attendee Information', extra: 'Invitation to {{ object.even...', extra2: '{{ object.event_id.user_id....', extra3: '{{ object.partner_id.id if ob...' },
        { name: 'Calendar: Reminder', code: 'Calendar Attendee Information', extra: '{{ object.event_id.name }} -...', extra2: '{{ object.event_id.user_id....', extra3: '{{ object.partner_id.id if ob...' },
        { name: 'Cotización', code: 'Quote', extra: 'Cotización', extra2: '-', extra3: '-' },
      ],
      'charge-master': [
        { code: 'MXAF-EXPO', name: 'MXAF-EXPO', extra: '$ 1.00', extra2: '1.00 AED' },
        { code: '', name: 'Terminal Handling Charges', extra: '$ 400.00', extra2: '300.00 AED' },
        { code: '', name: 'ABC', extra: '₹ 1.00', extra2: '1.00 AED' },
        { code: 'SearatesERP(China)-AF', name: 'ADMIN FEE', extra: '¥ 1.00', extra2: '1.00 AED' },
        { code: 'AD_VALOREM', name: 'Ad-Valorem', extra: '1.00 AED', extra2: '1.00 AED' },
        { code: '', name: 'Air carriage', extra: 'RM 1.00', extra2: '1.00 AED' },
        { code: '', name: 'All inclusive', extra: '₹ 60,000.00', extra2: '50,000.00 AED' },
        { code: '', name: 'ASFEE', extra: '1.00 AED', extra2: '1.00 AED' },
        { code: '', name: 'Audit Fees', extra: 'RM 200.00', extra2: '100.00 AED' },
        { code: 'Freight Charge', name: 'Audit Fees', extra: '200.00 AED', extra2: '100.00 AED' },
        { code: '702', name: 'Bank Commisions', extra: '$ 1.00', extra2: '1.00 AED' },
      ],
    };

    // One-time fixup: re-seed categories whose column layout was corrected
    // after verifying against the live SeaRates demo (Container Category,
    // Countries, Vessel), replacing the earlier placeholder rows.
    const staleVessel = await MasterDataItem.count({ where: { category: 'vessel', code: 'IMO9321483' } });
    if (staleVessel > 0) {
      await MasterDataItem.destroy({ where: { category: ['vessel', 'countries', 'container-category'] } });
      console.log('Cleared stale master data for vessel/countries/container-category for re-seed.');
    }

    // One-time fixup: re-seed categories whose column layout was corrected
    // after a deeper pass against the live SeaRates demo (Container/Package
    // Type, MAWB Stocks, Status Change Reasons, Warehouses, Serial Number),
    // plus the newly-added Incoterm category.
    const staleContainerType = await MasterDataItem.count({ where: { category: 'container-package-type', code: '20RF' } });
    if (staleContainerType > 0) {
      await MasterDataItem.destroy({
        where: { category: ['container-package-type', 'mawb-stocks', 'status-change-reasons', 'wms-warehouses', 'serial-number'] },
      });
      console.log('Cleared stale master data for container-package-type/mawb-stocks/status-change-reasons/wms-warehouses/serial-number for re-seed.');
    }

    for (const [category, rows] of Object.entries(seeds)) {
      const count = await MasterDataItem.count({ where: { category } });
      if (count === 0) {
        await MasterDataItem.bulkCreate(rows.map((row, idx) => ({ ...row, category, sortOrder: idx + 1 })));
        console.log(`Seeded master data for category "${category}".`);
      }
    }
  } catch (error) {
    console.error('Error seeding master data:', error.message);
  }
};

const seedDepartments = async () => {
  try {
    const { Department } = require('../models');
    const count = await Department.count();
    if (count === 0) {
      const SALES_RIGHTS = {
        website: 'Restricted Editor',
        shipment: 'User: Own Documents Only',
        salesCrm: 'Sales Manager',
        schedule: 'Schedule User',
      };
      const SALES_OTHER = { freightApproverTeam: true };

      const TRANSPORT_RIGHTS = {
        sales: 'Administrator',
        project: 'Administrator',
        invoicing: 'Billing Administrator',
        purchase: 'Administrator',
        liveChat: 'Administrator',
        website: 'Restricted Editor',
        events: 'Administrator',
        employees: 'Administrator',
        administration: 'Settings',
        shipment: 'Super Admin',
        operations: 'Administrator',
        salesCrm: 'Sales Administrator',
        schedule: 'Schedule Administrator',
        serviceJob: 'Super Admin',
      };
      const TRANSPORT_OTHER = {
        accessExportToImport: true,
        allowAccessShippingProvider: true,
        directQuoteAccept: true,
        manageDocuments: true,
        managePricing: true,
        oneMasterAllowEdit: true,
        completedCancelledShipmentStatusChange: true,
        freightApproverTeam: true,
        manageKyc: true,
        manageRateRequest: true,
        reExportCreatorTeam: true,
      };

      const ROLE_1DEMO_RIGHTS = {
        invoicing: 'Billing Administrator',
        liveChat: 'Administrator',
        website: 'Editor and Designer',
        administration: 'Settings',
        shipment: 'Administrator',
      };
      const ROLE_1DEMO_OTHER = { freightApproverTeam: true };

      const defaults = [
        { legacyId: 1, name: 'Sales', defaultUserCount: 60, accessRights: SALES_RIGHTS, otherPermissions: SALES_OTHER },
        { legacyId: 4, name: 'Transport', defaultUserCount: 3, accessRights: TRANSPORT_RIGHTS, otherPermissions: TRANSPORT_OTHER },
        { legacyId: 5, name: 'Accounts', defaultUserCount: 10 },
        { legacyId: 6, name: 'Operations', defaultUserCount: 32 },
        { legacyId: 7, name: 'Role from 1_demo', defaultUserCount: 178, accessRights: ROLE_1DEMO_RIGHTS, otherPermissions: ROLE_1DEMO_OTHER },
        { legacyId: 8, name: 'Role from Nitin Tiwari', defaultUserCount: 2 },
        { legacyId: 9, name: 'Pricing', defaultUserCount: 2 },
        { legacyId: 14, name: 'Business Development', defaultUserCount: 0 },
        { legacyId: 15, name: 'Customs', defaultUserCount: 199 },
        { legacyId: 16, name: 'SS', defaultUserCount: 2 },
        { legacyId: 17, name: 'Sales', defaultUserCount: 0 },
        { legacyId: 18, name: 'HR', defaultUserCount: 0 },
        { legacyId: 19, name: 'Human Resource', defaultUserCount: 0 },
        { legacyId: 20, name: 'Sales & CRM', defaultUserCount: 2 },
        { legacyId: 22, name: 'CY Sales', defaultUserCount: 1 },
        { legacyId: 25, name: 'Customer Service Team', defaultUserCount: 0 },
        { legacyId: 30, name: 'Human Resource', defaultUserCount: 0 },
        { legacyId: 36, name: 'Financee', defaultUserCount: 0 },
        { legacyId: 38, name: 'Sales Team PH', defaultUserCount: 0 },
        { legacyId: 39, name: 'Demo Access', defaultUserCount: 2 },
        { legacyId: 40, name: 'Americas Sales Team', defaultUserCount: 0 },
        { legacyId: 41, name: 'MM', defaultUserCount: 1 },
        { legacyId: 42, name: 'test-qa', defaultUserCount: 0 },
        { legacyId: 43, name: 'Finance', defaultUserCount: 1 },
        { legacyId: 44, name: 'Finance', defaultUserCount: 0 },
        { legacyId: 45, name: 'Accounts', defaultUserCount: 1 },
        { legacyId: 46, name: 'Sales PP', defaultUserCount: 1 },
        { legacyId: 47, name: 'Sales PP', defaultUserCount: 0 },
        { legacyId: 48, name: 'Transport', defaultUserCount: 0 },
        { legacyId: 49, name: 'Role from Ajay Kukadiya', defaultUserCount: 0 },
        { legacyId: 50, name: 'Role from Mithun Cheriya', defaultUserCount: 1 },
        { legacyId: 51, name: 'Account', defaultUserCount: 0 },
        { legacyId: 52, name: 'Marketing', defaultUserCount: 0 },
        { legacyId: 53, name: 'Operations Rubicon', defaultUserCount: 0 },
      ];
      await Department.bulkCreate(defaults.map((d) => ({ status: 'active', ...d })));
      console.log('Seeded default Departments.');
    }
  } catch (error) {
    console.error('Error seeding departments:', error.message);
  }
};

// Operations master data captured 1:1 from the live SeaRates demo
// (Operations > CFS > Receive Entry / Delivery Entry, and Operations >
// Export Console Generation). The reference numbers encode
// <mode>-<direction>-<cargo>-<doc>-<month>-<year>-<seq>, so transport mode,
// direction and cargo type are parsed back out of the number itself.
const CFS_RECEIPTS = [
  ['SEA-E-LCL-CFS-11-2024-00001', '2025-12-03', 'Gandhinagar', 'stuffed'],
  ['SEA-E-FCL-CFS-11-2024-00002', '2024-11-09', 'United Arab Emirates', 'stuffed'],
  ['SEA-E-LCL-CFS-11-2024-00003', '2024-11-09', 'United Arab Emirates', 'stuffed'],
  ['AIR-E-LSE-CFS-11-2024-00005', '2024-11-10', 'Special zone CFS - Dubai', 'stuffed'],
  ['SEA-E-LCL-CFS-11-2024-00006', '2024-11-10', 'Gandhinagar', 'received'],
  ['SEA-E-LCL-CFS-11-2024-00007', '2024-11-11', 'QINGDAO', 'created'],
  ['SEA-E-LCL-CFS-11-2024-00008', '2024-11-13', 'Gandhinagar', 'stuffed'],
  ['SEA-E-LCL-CFS-11-2024-00009', '2024-11-14', 'Ubungo', 'created'],
  ['SEA-E-LCL-CFS-11-2024-00010', '2024-11-15', 'Ubungo', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00015', '2024-11-21', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00016', '2024-12-03', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00017', '2024-12-03', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00018', '2024-12-06', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00019', '2024-12-06', 'Gandhinagar', 'stuffed'],
  ['SEA-E-LCL-CFS-12-2024-00020', '2024-12-06', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00021', '2024-12-06', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00022', '2024-12-06', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00023', '2024-12-06', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-12-2024-00024', '2024-12-17', 'Mumbai', 'stuffed'],
  ['SEA-E-LCL-CFS-12-2024-00025', '2024-12-17', 'Special zone CFS - Dubai', 'created'],
  ['SEA-E-LCL-CFS-01-2025-00026', '2025-01-16', 'Gandhinagar', 'received'],
  ['SEA-E-LCL-CFS-01-2025-00027', '2025-01-16', 'Ubungo', 'received'],
  ['SEA-E-LCL-CFS-01-2025-00028', '2025-01-16', 'Ubungo', 'received'],
  ['SEA-I-LCL-CFS-02-2025-00029', '2025-01-23', 'Gandhinagar', 'received'],
  ['SEA-E-LCL-CFS-02-2025-00030', '2025-01-23', 'Mumbai', 'created'],
  ['SEA-E-FCL-CFS-02-2025-00033', '2025-02-24', 'Special zone CFS - Dubai', 'received'],
  ['SEA-E-LCL-CFS-03-2025-00034', '2025-03-21', 'Special zone CFS - Dubai', 'created'],
  ['SEA-E-LCL-CFS-03-2025-00035', '2025-03-21', 'QINGDAO', 'created'],
  ['SEA-E-LCL-CFS-03-2025-00036', '2025-03-21', 'QINGDAO', 'created'],
  ['SEA-E-LCL-CFS-04-2025-00037', '2025-04-03', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-04-2025-00038', '2025-04-03', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-04-2025-00039', '2025-04-15', 'Gandhinagar', 'stuffed'],
  ['SEA-E-FCL-CFS-08-2025-00043', '2025-08-07', 'Ubungo', 'created'],
  ['SEA-E-LCL-CFS-08-2025-00044', '2025-08-08', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-08-2025-00045', '2025-08-08', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-09-2025-00046', '2025-09-03', 'Gandhinagar', 'created'],
  ['SEA-E-FCL-CFS-10-2025-00049', '2025-10-11', 'DUBAI (UAE)', 'created'],
  ['SEA-E-LCL-CFS-10-2025-00050', '2025-10-11', 'DUBAI (UAE)', 'created'],
  ['SEA-E-LCL-CFS-10-2025-00051', '2025-10-14', 'DUBAI (UAE)', 'created'],
  ['SEA-E-LCL-CFS-11-2025-00052', '2025-11-21', 'Gandhinagar', 'created'],
  ['SEA-E-LCL-CFS-01-2026-00053', '2026-01-30', 'DUBAI (UAE)', 'stuffed'],
  ['SEA-E-LCL-CFS-01-2026-00054', '2026-01-30', 'DUBAI (UAE)', 'created'],
];

const CFS_DELIVERIES = [
  ['SEA-I-LCL-DO-11-2024-00001', 'delivered'],
  ['SEA-I-LCL-DO-11-2024-00002', 'created'],
  ['SEA-I-LCL-DO-11-2024-00003', 'created'],
  ['SEA-I-LCL-DO-11-2024-00004', 'created'],
  ['SEA-I-LCL-DO-12-2024-00005', 'created'],
  ['SEA-I-LCL-DO-01-2025-00006', 'created'],
  ['SEA-I-LCL-DO-01-2025-00007', 'created'],
  ['SEA-I-LCL-DO-01-2025-00008', 'created'],
  ['SEA-I-LCL-DO-01-2025-00009', 'created'],
  ['SEA-I-LCL-DO-01-2025-00010', 'created'],
  ['SEA-I-LCL-DO-02-2025-00011', 'created'],
  ['SEA-I-LCL-DO-02-2025-00014', 'created'],
  ['SEA-I-LCL-DO-04-2025-00015', 'created'],
  ['SEA-I-LCL-DO-04-2025-00017', 'created'],
  ['SEA-I-LCL-DO-07-2025-00022', 'created'],
  ['SEA-I-LCL-DO-08-2025-00025', 'created'],
  ['SEA-I-LCL-DO-08-2025-00026', 'created'],
  ['SEA-I-LCL-DO-08-2025-00027', 'created'],
  ['SEA-I-LCL-DO-08-2025-00028', 'created'],
  ['SEA-I-LCL-DO-08-2025-00029', 'created'],
  ['SEA-I-LCL-DO-08-2025-00030', 'created'],
  ['SEA-I-LCL-DO-10-2025-00031', 'created'],
  ['SEA-I-LCL-DO-10-2025-00032', 'created'],
  ['SEA-I-LCL-DO-10-2025-00033', 'created'],
  ['SEA-I-LCL-DO-12-2025-00034', 'created'],
  ['SEA-I-LCL-DO-12-2025-00035', 'created'],
];

// [number, MBL, status, agent, houseCount]
const CONSOLIDATIONS = [
  ['SEA-E-FCL-CNSL-2026-00057', '', 'draft', 'A-10: AMGAD', 0],
  ['SEA-E-LCL-CNSL-2026-00056', '', 'draft', '1-1: 1_demo', 2],
  ['SEA-E-LCL-CNSL-2026-00055', '', 'draft', '1-1: 1_demo', 2],
  ['SEA-E-LCL-CNSL-2026-00054', '', 'draft', '3KAW#LBC9US(-1: Leviton Manufacturing Co., Inc.', 0],
  ['SEA-E-LCL-CNSL-2025-00053', 'MBLSS3', 'draft', 'A-10: AMGAD', 2],
  ['SEA-E-LCL-CNSL-2025-00052', '', 'draft', '1SDUCBOL6C-1: VetMed Solutions', 1],
  ['SEA-E-FCL-CNSL-2025-00051', 'MBLTest', 'completed', 'A-10: AMGAD', 2],
  ['SEA-E-BLK-CNSL-2025-00050', '', 'draft', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 0],
  ['SEA-E-LCL-CNSL-2025-00048', 'MBl-00048', 'completed', '1SDUCBOL6C-1: VetMed Solutions', 1],
  ['SEA-E-LCL-CNSL-2025-00047', '', 'draft', 'CPA-1: Customer Portal Access', 0],
  ['SEA-E-LCL-CNSL-2025-00046', '', 'draft', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 0],
  ['SEA-E-LCL-CNSL-2025-00045', 'CMASCGM12345678', 'draft', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 0],
  ['SEA-E-LCL-CNSL-2025-00044', '213456khj', 'draft', 'A-14: Aafaque', 0],
  ['SEA-E-LCL-CNSL-2025-00043', 'MBL-00043', 'draft', 'CPA-1: Customer Portal Access', 2],
  ['AIR-E-LCL-CNSL-2025-00042', '', 'draft', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 0],
  ['SEA-E-LCL-CNSL-2025-00041', '', 'draft', 'A-10: AMGAD', 0],
  ['SEA-E-LCL-CNSL-2025-00039', '', 'draft', 'BLA-H-1: BLA Holdings', 0],
  ['SEA-E-LCL-CNSL-2025-00038', 'MBL-00038', 'completed', 'A-10: AMGAD', 1],
  ['SEA-E-LCL-CNSL-2025-00037', 'KG7410', 'completed', 'A-10: AMGAD', 1],
  ['SEA-E-LCL-CNSL-2024-00036', '', 'draft', 'AG-1: Agent', 0],
  ['SEA-E-LCL-CNSL-2024-00035', '', 'draft', 'CT-3: Carrier Test', 0],
  ['SEA-E-LCL-CNSL-2024-00034', '', 'draft', 'CPA-1: Customer Portal Access', 0],
  ['SEA-E-LCL-CNSL-2024-00031', '', 'draft', 'CPA-1: Customer Portal Access', 0],
  ['SEA-E-LCL-CNSL-2024-00030', '', 'draft', 'A-10: AMGAD', 0],
  ['SEA-E-LCL-CNSL-2024-00029', '', 'completed', 'KS-1: KS Logistics', 1],
  ['SEA-E-LCL-CNSL-2024-00028', 'MBL123', 'completed', 'A-10: AMGAD', 1],
  ['SEA-E-LCL-CNSL-2024-00027', 'MBL34355', 'draft', 'CPA-1: Customer Portal Access', 0],
  ['SEA-E-LCL-CNSL-2024-00026', 'MBL343321', 'completed', 'CPA-1: Customer Portal Access', 2],
  ['SEA-E-LCL-CNSL-2024-00025', 'MBL667682', 'completed', 'CPA-1: Customer Portal Access', 3],
  ['SEA-E-LCL-CNSL-2024-00024', 'MBL878871', 'completed', 'CPA-1: Customer Portal Access', 3],
  ['SEA-E-LCL-CNSL-2024-00023', '', 'draft', 'CPA-1: Customer Portal Access', 0],
  ['SEA-E-LCL-CNSL-2024-00022', 'MBL332243', 'completed', 'CPA-1: Customer Portal Access', 3],
  ['SEA-E-LCL-CNSL-2024-00021', 'MBL334212', 'completed', 'CPA-1: Customer Portal Access', 2],
  ['SEA-E-LCL-CNSL-2024-00020', 'MBL112111', 'draft', 'CPA-1: Customer Portal Access', 1],
  ['SEA-E-LCL-CNSL-2024-00019', '', 'draft', 'CPA-1: Customer Portal Access', 0],
  ['SEA-E-LCL-CNSL-2024-00018', '', 'completed', 'A-10: AMGAD', 2],
  ['SEA-E-LCL-CNSL-2024-00017', '', 'draft', 'A-10: AMGAD', 0],
  ['SEA-E-LCL-CNSL-2024-00016', '', 'draft', 'A-10: AMGAD', 0],
  ['SEA-E-LCL-CNSL-2024-00015', '', 'draft', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 0],
  ['SEA-E-LCL-CNSL-2024-00014', '', 'draft', '5TON7MD-BB-1: BB Traders', 0],
  ['SEA-E-LCL-CNSL-2024-00013', '', 'draft', '5TON7MD-BB-1: BB Traders', 0],
  ['SEA-E-LCL-CNSL-2024-00010', '', 'draft', 'A-10: AMGAD', 0],
  ['SEA-E-LCL-CNSL-2024-00009', '', 'completed', 'A-10: AMGAD', 1],
  ['SEA-E-LCL-CNSL-2024-00008', 'MBL-00008', 'draft', '5TON7MD-BB-1: BB Traders', 1],
  ['SEA-E-LCL-CNSL-2024-00007', 'MBL-00007', 'completed', 'A-10: AMGAD', 1],
  ['SEA-E-LCL-CNSL-2024-00006', 'MBL-00006', 'completed', '5TON7MD-BB-1: BB Traders', 1],
  ['SEA-E-LCL-CNSL-2024-00003', '', 'draft', 'A-10: AMGAD', 2],
  ['SEA-E-LCL-CNSL-2024-00002', 'MBL02929', 'completed', '5TON7MD-BB-1: BB Traders', 1],
  ['SEA-E-LCL-CNSL-2024-00001', 'MSCU2411741', 'completed', 'FL-3: Fast Logistics', 2],
];

// Shipment Sharing rows, one per direction/converted combination so all four
// sub-views (Import->Export and Export->Import, Pending and Converted) render.
const SHIPMENT_SHARINGS = [
  ['SHR-2026-00001', 'import_to_export', 'SEA', 'IMP', 'FCL', 'BR-2026-0141', '2026-01-18',
    'A-13: Ashish', 'A-14: Aafaque', 'JEBEL ALI SEAPORT, U.A.E', 'MUNDRA', false],
  ['SHR-2026-00002', 'import_to_export', 'SEA', 'IMP', 'LCL', 'BR-2026-0155', '2026-02-04',
    'UPS-2: ULTRA POMPE SRL', 'RRML-1: ROOFING ROLLING MILLS LTD', 'DUBAI (UAE)', 'Nhava Sheva', true],
  ['SHR-2026-00003', 'export_to_import', 'SEA', 'EXP', 'FCL', 'BR-2026-0163', '2026-02-21',
    'A-16: admin-us@ila-global.net', 'A-13: Ashish', 'Gandhinagar', 'DUBAI (UAE)', false],
  ['SHR-2026-00004', 'export_to_import', 'AIR', 'EXP', 'LSE', 'BR-2026-0170', '2026-03-09',
    'A-17: Atharva', 'A-25: Amit', 'JEBEL ALI SEAPORT, U.A.E', 'Nhava Sheva', true],
];

// [opportunityNumber, date, location, prospect, mode, direction, demoStage]
const OPPORTUNITIES = [
  ['OP/2026/00419', '2025-11-25', '', 'admin', 'SEA', 'EXPORT', 'Closed'],
  ['OP/2026/00418', '2026-06-24', '', 'Maria Knights', 'SEA', 'EXPORT', 'Active'],
  ['OP/2026/00417', '2026-04-30', 'Dubai', 'Mr. Sam', 'SEA', 'EXPORT', 'Open'],
  ['OP/2026/00416', '2023-10-27', '', 'Fleetpost', 'SEA', 'EXPORT', 'Closed'],
  ['OP/2026/00415', '2023-08-01', '', 'logistics one', 'SEA', 'EXPORT', 'Closed'],
  ['OP/2025/00411', '2025-12-19', 'DUBAI (UAE)', 'Brandom', 'AIR', 'EXPORT', 'Created'],
  ['OP/2025/00410', '2025-12-18', '', 'ABC', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00409', '2023-10-04', '', 'John', 'SEA', 'EXPORT', 'Active'],
  ['OP/2025/00408', '2025-12-16', '', 'Tepm', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00407', '2025-12-10', '', 'ZAJEL EXPRESS', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00406', '2025-12-10', '', 'John Smith', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00405', '2025-12-09', '', 'John Smith', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00404', '2025-12-05', 'Gandhinagar', 'Lanesh Parikh', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00403', '2025-12-02', '', 'lleeaad', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00402', '2024-08-07', '', 'John Smith', 'AIR', 'IMPORT', 'Open'],
  ['OP/2025/00401', '2025-11-28', '', 'Tepm', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00400', '2023-09-06', '', 'Brandon', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00399', '2025-11-19', 'DUBAI (UAE)', 'Brandon', 'AIR', 'EXPORT', 'Open'],
  ['OP/2025/00398', '2025-11-19', '', 'Sanity test', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00397', '2025-11-12', 'DUBAI (UAE)', 'abc pros', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00396', '2023-09-06', '', 'Brandon', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00395', '2023-09-06', '', 'ZAJEL EXPRESS', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00394', '2025-10-23', '', 'Ocean Blue', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00393', '2025-10-23', '', 'Ocean Blue', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00392', '2025-10-21', '', 'PrimEX', 'SEA', 'EXPORT', 'Open'],
  ['OP/2025/00391', '2023-08-01', '', 'logistics one', 'SEA', 'EXPORT', 'Open'],
];

// The demo's opportunity stages (Created/Open/Active/Closed) map onto this
// model's CRM pipeline stages.
const OPPORTUNITY_STAGE_MAP = { Created: 'new', Open: 'qualified', Active: 'negotiation', Closed: 'won' };

// [bookingRef, serviceJobNumber, date, estRevenue, estCost, state]
const SERVICE_JOBS = [
  ['SJ-00120', 'SJN-0000119', '2026-04-30', 0, 0, 'pending'],
  ['SJ-00119', 'CSJ_0001', '2026-04-23', 0, 0, 'pending'],
  ['SJ-00118', '', '2026-03-16', 0, 0, 'pending'],
  ['SJ-00117', '', '2025-12-16', 101, 750, 'pending'],
  ['SJ-00116', 'SJ-012', '2025-12-11', 1501, 751, 'pending'],
  ['SJ-00115', 'SJ0001', '2025-12-11', 1, 0, 'pending'],
  ['SJ-00114', 'Service Job 01', '2025-12-08', 1000, 1200, 'completed'],
  ['SJ-00113', 'SERVICE 01', '2025-12-06', 1, 1, 'pending'],
  ['SJ-00112', '', '2025-11-25', 1520, 760, 'pending'],
  ['SJ-00111', '', '2025-11-25', 466, 750, 'pending'],
  ['SJ-00110', '677', '2025-11-25', 0, 0, 'pending'],
  ['SJ-00108', '6352', '2025-11-11', 0, 0, 'pending'],
  ['SJ-00107', '', '2025-10-09', 1, 120, 'pending'],
  ['SJ-00105', '', '2025-09-17', 1, 0, 'pending'],
  ['SJ-00104', '', '2025-09-17', 0, 0, 'pending'],
  ['SJ-00103', '', '2025-09-11', 1, 0, 'pending'],
  ['SJ-00101', 'D1', '2025-09-03', 500, 400, 'completed'],
  ['SJ-00099', 'SJ-00097', '2025-09-03', 0, 0, 'completed'],
  ['SJ-00098', 'SJ-00097', '2025-09-03', 0, 0, 'pending'],
  ['SJ-00097', 'No083827', '2025-08-24', 0, 0, 'pending'],
  ['SJ-00096', '', '2025-08-29', 0, 0, 'pending'],
  ['SJ-00095', 'No 083827', '2025-08-24', 0, 0, 'pending'],
];

// [masterShipmentNumber, MBL, state]
const MASTER_SHIPMENTS = [
  ['SEA-E-BLK-MM-2026-00707', '123455', 'created'],
  ['SEA-E-FCL-MM-2026-00706', 'TestMBL19-01', 'created'],
  ['SEA-E-FCL-MM-2026-00705', 'MBLTest21', 'created'],
  ['SEA-E-BLK-MM-2026-00704', '', 'created'],
  ['AIR-E-LSE-MM-2026-00703', 'MAWB123456', 'created'],
  ['SEA-I-LCL-MM-2026-00032', 'MSCSINPKGMBL43234', 'created'],
  ['SEA-E-FCL-MM-2026-00702', 'MBL213', 'ext_booked'],
  ['SEA-E-FCL-MM-2026-00031', 'TESTMBL2112332', 'ext_booked'],
  ['SEA-E-LCL-MM-2026-00701', 'MBL321', 'created'],
  ['SEA-E-LCL-MM-2026-00700', 'MBL555', 'completed'],
  ['AIR-E-LSE-MM-2026-00699', 'MAWB111', 'created'],
  ['SEA-E-LCL-MM-2026-00698', 'MBKM235423', 'created'],
  ['SEA-E-FCL-MM-2026-00697', '', 'created'],
  ['SEA-E-BLK-MM-2026-00696', 'MBL4545', 'created'],
];

const CONTAINER_NUMBERS = [
  'HAKU0127046', 'CBXU0091610', 'BTNU4010179', 'LMDU4000389', 'FXLU9051730',
  'FXLU9053780', 'ITXU9102675', 'FXLU9051746', 'DSZU4902275', 'ITXU9102398',
  'TRDU7611536', 'CPIU5597118', 'DSXU4900085', 'PVCU4702022',
];

const OCR_DOCUMENTS = [
  'PACKING-21082025 (2).cleaned.pdf',
  'PACKING-18092025.pdf',
  'PACKING-21082025 (2).cleaned.pdf',
  'PACKING-21082025 (2).cleaned.pdf',
  'PACKING-18092025.cleaned (1) (1).pdf',
  'PACKING-18092025.cleaned (1).pdf',
  'Profit And Loss Statement.pdf',
  'ORIGINAL INVOICE.pdf',
];

// Companies the demo user can switch between, in the order the live
// company-switcher lists them. [name, code, currency, country, city]
const OPERATING_COMPANIES = [
  ['SearatesERP (Dubai)', 'SR-DXB', 'AED', 'United Arab Emirates', 'Dubai'],
  ['Searates USA', 'SR-USA', 'USD', 'United States', 'New York'],
  ['SearatesERP(China)', 'SR-CN', 'CNY', 'China', 'Shanghai'],
  ['SearatesERP(India)', 'SR-IN', 'INR', 'India', 'Ahmedabad'],
  ['SearatesERP(Saudi)', 'SR-SA', 'SAR', 'Saudi Arabia', 'Riyadh'],
  ['Searates (Malaysia)', 'SR-MY', 'MYR', 'Malaysia', 'Kuala Lumpur'],
  ['Searates(United Arab Emirates)', 'SR-UAE', 'AED', 'United Arab Emirates', 'Abu Dhabi'],
  ['S4 Logistics', 'S4-LOG', 'USD', 'United States', 'Houston'],
];

// Party Types available on the Organizations form (res.partner.category).
const PARTY_TYPES = [
  'consignee', 'Customer', 'Customs', 'iso tank cleaning station', 'Logistics',
  'Miami', 'shipper', 'Transporter', 'United State', 'United States',
];

// Party Types assigned per organization, so the list's "Group By › Party Types"
// buckets partners the way the demo does. Anything absent here groups under
// "Undefined".
const ORG_PARTY_TYPES = {
  '1-1': ['Customer', 'Shipper', 'Consignee'],
  'A-17': ['Customer', 'Shipper', 'Consignee', 'Vendor'],
  'A-74': ['Customer'],
  'MK-5': ['Customer', 'Shipper'],
  'MS-13': ['Customer'],
  'SG-11': ['Shipper', 'Consignee'],
  'TK-2': ['Customer', 'Vendor'],
  'MD-4': ['Customer'],
  'GM-8': ['Shipper'],
  'PSFW-1': ['Customer', 'Transporter'],
  'AV-2': ['Consignee'],
  'TL-3': ['Transporter', 'Logistics'],
  'ASSL-1': ['Shipper', 'Logistics'],
  'ALPL-1': ['Logistics'],
  'RR-7': ['Customer', 'Shipper', 'Consignee'],
  'B-26': ['Customer'],
  'S-173': ['Shipper', 'Consignee'],
  'DA-13': ['Customer', 'Vendor'],
  'I-10': ['Logistics', 'Vendor'],
  'AE-4': ['Customer', 'Consignee'],
};

// Organizations captured from the live demo.
// [code, name, companyType, phone, email, city, country, vat]
const ORGANIZATIONS = [
  // Listed first because they carry real transactional history, which makes the
  // workflow ribbon show non-zero counts.
  ['1-1', '1_demo', 'person', '', '1_demo@gmail.com', '', '', ''],
  ['A-17', 'Atharva', 'company', '', 'mohamedebrahim@ics-global.in', 'DUBAI (AE)', 'United Arab Emirates', ''],
  ['A-74', 'admin', 'person', '+91 73377 69988', 'ajay.bhaskar@searatess.com', '', 'India', ''],
  ['MK-5', 'Maria Knights', 'person', '', 'xyz@gmail.com', '', 'Afghanistan', ''],
  ['T-40', 'TechSupport-Admin', 'person', '', '', '', '', ''],
  ['MS-13', 'Mr. Sam', 'person', '+49 30 12345678', 'lancelot@kingsmen.com', '', 'Germany', ''],
  ['SG-11', 'SAM GLOBALS', 'company', '+91 98765 43210', 'exports@samglobals.com', '', '', ''],
  ['TK-2', 'THE KINGSMEN', 'company', '+49 30 12345678', 'lancelot@kingsmen.com', '', '', ''],
  ['A-73', 'Adam1', 'person', '', 'adam1@gmail.com', '', '', ''],
  ['MD-4', 'Malaysia Demo', 'company', '', '', 'test', 'Malaysia', ''],
  ['GM-8', 'Goodrich Maritme', 'company', '', 'test@gmail.com', '', '', ''],
  ['AS-16', 'Advonasia SDBN', 'person', '', '', '', '', ''],
  ['GM-7', 'Goodrich Martime', 'person', '', '', '', 'Malaysia', ''],
  ['J-29', 'Jessy', 'person', '', 'jessy@gmail.com', '', '', ''],
  ['A-72', 'ABC', 'person', '', '', '', 'India', ''],
  ['PSFW-1', 'Progressive Samson Freight WLL', 'person', '', 'bhnmng@samsonfreightbh.com', '', '', ''],
  ['AV-2', 'Ankit Vijay', 'person', '', 'ankit.vijay@dpworld.com', '', '', ''],
  ['TL-3', 'Trident Logistics', 'person', '', 'rf@gmail.com', '', '', ''],
  ['ASSL-1', 'Aitken Spence Shipping Ltd', 'person', '', 'dfa@aitkenspence.lk', '', '', ''],
  ['ALPL-1', 'Anix Logistics PVT LTD', 'person', '', 'andreana@anixlogistics.in', '', '', ''],
  ['RR-7', 'Rishirajsinh Rana', 'company', '', 'test@test.com', '', '', ''],
  ['S-177', 'Shahim', 'person', '', '', '', '', ''],
  ['B-26', 'Brandom', 'person', '+91 94793 28239', 'brandom@gmail.com', '', 'India', ''],
  ['A-71', 'ABC', 'person', '', 'ajay.bhaskar@searatess5.com', '', 'India', ''],
  ['S-176', 'Sandi', 'person', '', 'sandi@gmail.com', '', '', ''],
  ['T-39', 'Tepm', 'person', '', 'ajay.bhaskar@searatess3.com', '', 'India', ''],
  ['DA-13', 'Deco Addict', 'company', '', '', '', '', ''],
  ['I-10', 'ifreight', 'company', '', 'ifreight@gmail.com', '', '', ''],
  ['S-175', 'S-173', 'person', '', '', '', '', ''],
  ['S-173', 'SIDPEC', 'company', '+20 122 353 0902', 'export-eg@sipdec.com.eg', '', 'Egypt', ''],
  ['J-28', 'Jessy', 'person', '', 'jessy@gmail.com', '', 'Afghanistan', ''],
  ['D-42', 'Daisy', 'person', '', 'daisy@gmail.com', '', '', ''],
  ['S-172', 'Siva', 'person', '', 'siva@test.com', '', '', ''],
  ['AE-4', 'Adovan ETL', 'company', '', '', '', 'Malaysia', 'C29987745000'],
];

// Child address rows shown on the parent's Addresses tab.
// [parentCode, addressType, label]
const ORGANIZATION_ADDRESSES = [
  ['AE-4', 'delivery', 'Adovan ETL, Delivery Address'],
  ['AE-4', 'other', 'Adovan ETL, Other Address'],
];

const COUNTRY_CODE_BY_NAME = {
  'United Arab Emirates': 'AE', India: 'IN', 'United States': 'US', Malaysia: 'MY',
  China: 'CN', Egypt: 'EG', Germany: 'DE', Afghanistan: 'AF', 'Saudi Arabia': 'SA',
};

// Parses "SEA-E-LCL-CFS-11-2024-00001" into its mode/direction/cargo parts.
const parseOpsRef = (ref) => {
  const [mode, dir, cargo] = ref.split('-');
  return {
    transportMode: mode,
    direction: { E: 'EXPORT', I: 'IMPORT', L: 'LOCAL' }[dir] || 'EXPORT',
    cargoType: cargo,
  };
};

const seedOperationsData = async () => {
  try {
    const { CFSReceipt, CFSDelivery, Consolidation, ShipmentSharing } = require('../models');
    const { Op } = require('sequelize');

    // One-time fixup: drop the earlier placeholder rows (they use the generated
    // "CFS-DLV-"/"SHR-" numbering rather than the demo's real reference format)
    // so the real SeaRates records below can take their place.
    const staleDeliveries = await CFSDelivery.count({ where: { deliveryNumber: { [Op.like]: '%CFS-DLV-%' } } });
    if (staleDeliveries > 0) {
      await CFSDelivery.destroy({ where: { deliveryNumber: { [Op.like]: '%CFS-DLV-%' } } });
      console.log('Cleared placeholder CFS delivery entries for re-seed.');
    }
    const staleSharings = await ShipmentSharing.count();
    if (staleSharings > 0 && staleSharings < SHIPMENT_SHARINGS.length) {
      await ShipmentSharing.destroy({ where: {} });
      console.log('Cleared placeholder shipment sharing records for re-seed.');
    }

    if ((await CFSReceipt.count()) === 0) {
      await CFSReceipt.bulkCreate(CFS_RECEIPTS.map(([receiptNumber, gateInDate, cfsLocation, status]) => ({
        receiptNumber, gateInDate, cfsLocation, status, ...parseOpsRef(receiptNumber),
      })));
      console.log(`Seeded ${CFS_RECEIPTS.length} CFS receive entries.`);
    }

    if ((await CFSDelivery.count()) === 0) {
      await CFSDelivery.bulkCreate(CFS_DELIVERIES.map(([deliveryNumber, status]) => ({
        deliveryNumber, status, ...parseOpsRef(deliveryNumber),
      })));
      console.log(`Seeded ${CFS_DELIVERIES.length} CFS delivery entries.`);
    }

    if ((await Consolidation.count()) === 0) {
      await Consolidation.bulkCreate(CONSOLIDATIONS.map(([consolidationNumber, mblNumber, status, agent, houses]) => ({
        consolidationNumber,
        mblNumber: mblNumber || null,
        status,
        carrier: agent,
        houseShipmentIds: Array.from({ length: houses }, (_, i) => `${consolidationNumber}-H${i + 1}`),
        ...parseOpsRef(consolidationNumber),
      })));
      console.log(`Seeded ${CONSOLIDATIONS.length} export consolidations.`);
    }

    const { Opportunity, ServiceJob, MasterShipment, OCRDocument, ContainerNumber, Customer } = require('../models');
    // Service jobs / master shipments require a customer FK; the demo's own
    // customer records aren't reproduced here, so anchor them to the first
    // seeded customer.
    const defaultCustomer = await Customer.findOne();
    const { User, Company } = require('../models');

    // Multi-company switcher needs the full set of operating companies.
    for (const [name, code, currency, country, city] of OPERATING_COMPANIES) {
      await Company.findOrCreate({
        where: { code },
        defaults: { name, code, currency, country, city, type: 'freight_forwarder', status: 'active' },
      });
    }

    const defaultUser = await User.findOne({ where: { email: 'admin@cargoflo.com' } });

    if ((await Opportunity.count()) < OPPORTUNITIES.length) {
      await Opportunity.destroy({ where: {} });
      await Opportunity.bulkCreate(OPPORTUNITIES.map(([name, date, origin, contactName, transportMode, direction, stage]) => ({
        name, contactName, origin, transportMode, direction,
        stage: OPPORTUNITY_STAGE_MAP[stage] || 'new',
        expectedCloseDate: date,
      })));
      console.log(`Seeded ${OPPORTUNITIES.length} opportunities.`);
    }

    const { Organization, MasterDataItem } = require('../models');
    // Count top-level partners only — child addresses share the table.
    if ((await Organization.count({ where: { parentId: null } })) < ORGANIZATIONS.length) {
      await Organization.destroy({ where: {} });
      const created = await Organization.bulkCreate(ORGANIZATIONS.map(
        ([customerCode, name, companyType, phone, email, city, country, vat]) => ({
          customerCode, name, companyType, phone, email, city, country,
          partyTypes: ORG_PARTY_TYPES[customerCode] || [],
          vat: vat || null,
          identificationNumber: vat || null,
          companyName: companyType === 'company' ? name : null,
          localizationCountryCode: COUNTRY_CODE_BY_NAME[country] || 'AE',
          transactionType: 'b2b',
          language: 'English (US)',
          currency: 'AED',
          markAsDefault: true,
        })
      ));
      const byCode = Object.fromEntries(created.map((o) => [o.customerCode, o]));
      await Organization.bulkCreate(ORGANIZATION_ADDRESSES
        .filter(([parentCode]) => byCode[parentCode])
        .map(([parentCode, addressType, name]) => ({
          name,
          addressType,
          companyType: 'person',
          parentId: byCode[parentCode].id,
          country: byCode[parentCode].country,
          markAsDefault: false,
        })));
      console.log(`Seeded ${ORGANIZATIONS.length} organizations and ${ORGANIZATION_ADDRESSES.length} child addresses.`);
    }

    // Backfill Party Types onto partners seeded before the field existed, so
    // "Group By › Party Types" has something to bucket.
    let tagged = 0;
    for (const [code, types] of Object.entries(ORG_PARTY_TYPES)) {
      const org = await Organization.findOne({ where: { customerCode: code, parentId: null } });
      if (org && (org.partyTypes || []).length === 0) {
        await org.update({ partyTypes: types });
        tagged += 1;
      }
    }
    if (tagged) console.log(`Backfilled party types on ${tagged} organizations.`);

    // Link organizations to their Customer twin so the workflow ribbon can count
    // quotes, bookings, invoices and the rest against the partner.
    const unlinked = await Organization.findAll({ where: { customerId: null, parentId: null } });
    let linked = 0;
    for (const org of unlinked) {
      const match = await Customer.findOne({
        where: { [Op.or]: [{ companyName: org.name }, { contactName: org.name }] },
        attributes: ['id'],
      });
      if (match) { await org.update({ customerId: match.id }); linked += 1; }
    }
    if (linked) console.log(`Linked ${linked} organizations to their customer records.`);

    // Party Types feed the Organizations form's Party Types / Tags pickers.
    if ((await MasterDataItem.count({ where: { category: 'party-types' } })) === 0) {
      await MasterDataItem.bulkCreate(PARTY_TYPES.map((name, idx) => ({
        category: 'party-types', name, sortOrder: idx + 1,
      })));
      console.log(`Seeded ${PARTY_TYPES.length} party types.`);
    }

    if (defaultCustomer && (await ServiceJob.count()) < SERVICE_JOBS.length) {
      await ServiceJob.destroy({ where: {} });
      // `jobNumber` holds the demo's Booking Ref; its separate "Service Job No"
      // has no dedicated column here, so it rides along in remarks.
      await ServiceJob.bulkCreate(SERVICE_JOBS.map(([jobNumber, serviceJobNo, requestDate, revenue, cost, status]) => ({
        jobNumber,
        customerId: defaultCustomer.id,
        createdBy: defaultUser && defaultUser.id,
        requestDate,
        totalAmount: revenue,
        currency: 'AED',
        status,
        remarks: [serviceJobNo && `Service Job No: ${serviceJobNo}`, cost && `Estimated cost ${cost} AED`]
          .filter(Boolean).join(' | ') || null,
      })));
      console.log(`Seeded ${SERVICE_JOBS.length} service jobs.`);
    }

    if ((await MasterShipment.count()) < MASTER_SHIPMENTS.length) {
      await MasterShipment.destroy({ where: {} });
      await MasterShipment.bulkCreate(MASTER_SHIPMENTS.map(([masterShipmentNumber, mblNumber, status]) => ({
        masterShipmentNumber,
        mblNumber: mblNumber || null,
        status,
        currency: 'AED',
        customerId: defaultCustomer.id,
        createdBy: defaultUser && defaultUser.id,
        ...parseOpsRef(masterShipmentNumber),
      })));
      console.log(`Seeded ${MASTER_SHIPMENTS.length} master shipments.`);
    }

    if ((await ContainerNumber.count()) < CONTAINER_NUMBERS.length) {
      await ContainerNumber.destroy({ where: {} });
      await ContainerNumber.bulkCreate(CONTAINER_NUMBERS.map((containerNumber) => ({
        containerNumber, status: 'unused',
      })));
      console.log(`Seeded ${CONTAINER_NUMBERS.length} container numbers.`);
    }

    if ((await OCRDocument.count()) < OCR_DOCUMENTS.length) {
      await OCRDocument.destroy({ where: {} });
      await OCRDocument.bulkCreate(OCR_DOCUMENTS.map((fileName) => ({ fileName })));
      console.log(`Seeded ${OCR_DOCUMENTS.length} OCR documents.`);
    }

    if ((await ShipmentSharing.count()) === 0) {
      await ShipmentSharing.bulkCreate(SHIPMENT_SHARINGS.map(
        ([sharingNumber, direction, transportMode, shipmentType, cargoType, bookingId,
          shipmentDate, shipper, consignee, originPort, destinationPort, converted]) => ({
          sharingNumber, direction, transportMode, shipmentType, cargoType, bookingId,
          shipmentDate, shipper, consignee, originPort, destinationPort, converted,
          company: 'CargoFlo Logistics Ltd',
          status: converted ? 'completed' : 'created',
        })
      ));
      console.log(`Seeded ${SHIPMENT_SHARINGS.length} shipment sharing records.`);
    }
  } catch (error) {
    console.error('Error seeding operations data:', error.message);
  }
};

module.exports = { sequelize, connectDB };
