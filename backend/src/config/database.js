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
// 6-status enum to the full 12-status CargoFlo workflow. Sequelize sync is
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
      // CargoFlo layout (Consolidation Type / Sailing Schedule / Party /
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

    // Freight Booking was a 21-column stub before it was rebuilt against
    // freight.booking.request; the old shape shares almost no columns, so it is
    // dropped and recreated rather than migrated column by column.
    const fbNeedsRebuild = tables.includes('freight_bookings')
      && !(await qi.describeTable('freight_bookings')).transportCode;
    if (fbNeedsRebuild) {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await sequelize.query('DROP TABLE freight_bookings');
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('Dropped legacy freight_bookings table.');
    }
    if (fbNeedsRebuild || !tables.includes('freight_bookings')) {
      await qi.createTable('freight_bookings', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        bookingReference: { type: DataTypes.STRING(60), allowNull: false },
        bookingNumber: { type: DataTypes.STRING(80), allowNull: true },
        transportCode: { type: DataTypes.ENUM('SEA', 'AIR'), allowNull: false, defaultValue: 'AIR' },
        modeType: { type: DataTypes.ENUM('sea', 'land', 'air'), defaultValue: 'air' },
        status: { type: DataTypes.ENUM('init', 'pending', 'success', 'fail', 'cancel'), defaultValue: 'init' },
        airStatus: {
          type: DataTypes.ENUM('created', 'booking_created', 'booking_confirmed', 'booking_rejected',
            'booking_failed', 'booking_cancel_req', 'booking_cancelled'),
          defaultValue: 'created',
        },
        providerStatus: { type: DataTypes.STRING(250), allowNull: true },
        buycoTransportStatus: { type: DataTypes.STRING(120), allowNull: true },
        carrierIdentifier: { type: DataTypes.STRING(20), allowNull: true },
        subscriptionStatus: { type: DataTypes.STRING(20), defaultValue: 'active' },
        paymentTerms: { type: DataTypes.ENUM('ppx', 'ccx'), allowNull: true },
        incoterm: { type: DataTypes.STRING(80), allowNull: true },
        company: { type: DataTypes.STRING(120), allowNull: true },
        transportMode: { type: DataTypes.STRING(60), allowNull: true },
        carrier: { type: DataTypes.STRING(120), allowNull: true },
        cargoType: { type: DataTypes.STRING(60), allowNull: true },
        assignedTo: { type: DataTypes.STRING(150), allowNull: true },
        assignedToVerified: { type: DataTypes.BOOLEAN, defaultValue: true },
        trackingNumber: { type: DataTypes.STRING(60), allowNull: true },
        airline: { type: DataTypes.STRING(120), allowNull: true },
        flightNo: { type: DataTypes.STRING(40), allowNull: true },
        serviceMode: { type: DataTypes.STRING(60), allowNull: true },
        shipmentType: { type: DataTypes.STRING(60), allowNull: true },
        commodityType: { type: DataTypes.STRING(60), allowNull: true },
        origin: { type: DataTypes.STRING(150), allowNull: true },
        originPort: { type: DataTypes.STRING(150), allowNull: true },
        originCountry: { type: DataTypes.STRING(80), allowNull: true },
        originFacilityType: { type: DataTypes.ENUM('CLOC', 'POTE', 'INTE'), allowNull: true },
        destination: { type: DataTypes.STRING(150), allowNull: true },
        destinationPort: { type: DataTypes.STRING(150), allowNull: true },
        destinationCountry: { type: DataTypes.STRING(80), allowNull: true },
        destinationFacilityType: { type: DataTypes.ENUM('CLOC', 'POTE', 'INTE'), allowNull: true },
        departureDate: { type: DataTypes.DATEONLY, allowNull: true },
        etdTime: { type: DataTypes.DATE, allowNull: true },
        etaTime: { type: DataTypes.DATE, allowNull: true },
        atdTime: { type: DataTypes.DATE, allowNull: true },
        ataTime: { type: DataTypes.DATE, allowNull: true },
        vessel: { type: DataTypes.STRING(120), allowNull: true },
        imoNumber: { type: DataTypes.STRING(40), allowNull: true },
        voyageNumber: { type: DataTypes.STRING(40), allowNull: true },
        client: { type: DataTypes.STRING(250), allowNull: true },
        clientAddress: { type: DataTypes.TEXT, allowNull: true },
        shipper: { type: DataTypes.STRING(250), allowNull: true },
        shipperAddress: { type: DataTypes.TEXT, allowNull: true },
        shipperAccountNumbers: { type: DataTypes.STRING(120), allowNull: true },
        consignee: { type: DataTypes.STRING(250), allowNull: true },
        consigneeAddress: { type: DataTypes.TEXT, allowNull: true },
        consigneeAccountNumbers: { type: DataTypes.STRING(120), allowNull: true },
        cargoLines: { type: DataTypes.JSON, allowNull: true },
        flightLines: { type: DataTypes.JSON, allowNull: true },
        isDirectBooking: { type: DataTypes.BOOLEAN, defaultValue: false },
        freightShipmentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        freightDirectShipmentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        cancelReason: { type: DataTypes.STRING(200), allowNull: true },
        failBookingReason: { type: DataTypes.STRING(200), allowNull: true },
        failBookingError: { type: DataTypes.TEXT, allowNull: true },
        remarks: { type: DataTypes.TEXT, allowNull: true },
        ffJobId: { type: DataTypes.UUID, allowNull: true },
        masterShipmentId: { type: DataTypes.UUID, allowNull: true },
        customerId: { type: DataTypes.UUID, allowNull: true },
        carrierId: { type: DataTypes.UUID, allowNull: true },
        companyId: { type: DataTypes.UUID, allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created freight_bookings table.');
    }

    if (!tables.includes('account_assets')) {
      await qi.createTable('account_assets', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(200), allowNull: false },
        assetType: { type: DataTypes.ENUM('purchase', 'sale', 'expense'), defaultValue: 'purchase' },
        partner: { type: DataTypes.STRING(250), allowNull: true },
        partnerId: { type: DataTypes.UUID, allowNull: true },
        original: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        depreciated: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        bookValue: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        acquisitionDate: { type: DataTypes.DATEONLY, allowNull: true },
        firstDepreciationDate: { type: DataTypes.DATEONLY, allowNull: true },
        duration: { type: DataTypes.INTEGER, defaultValue: 12 },
        periodicity: { type: DataTypes.ENUM('months', 'years'), defaultValue: 'months' },
        method: { type: DataTypes.ENUM('linear', 'degressive'), defaultValue: 'linear' },
        account: { type: DataTypes.STRING(120), allowNull: true },
        depreciationAccount: { type: DataTypes.STRING(120), allowNull: true },
        expenseAccount: { type: DataTypes.STRING(120), allowNull: true },
        journal: { type: DataTypes.STRING(120), allowNull: true },
        state: { type: DataTypes.ENUM('draft', 'running', 'paused', 'close', 'cancel'), defaultValue: 'draft' },
        depreciationLines: { type: DataTypes.JSON, allowNull: true },
        company: { type: DataTypes.STRING(120), allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created account_assets table.');
    }

    if (!tables.includes('config_items')) {
      await qi.createTable('config_items', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        category: { type: DataTypes.STRING(60), allowNull: false },
        name: { type: DataTypes.STRING(200), allowNull: true },
        code: { type: DataTypes.STRING(60), allowNull: true },
        value: { type: DataTypes.STRING(200), allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        country: { type: DataTypes.STRING(120), allowNull: true },
        days: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
        dateFrom: { type: DataTypes.DATEONLY, allowNull: true },
        dateTo: { type: DataTypes.DATEONLY, allowNull: true },
        sequence: { type: DataTypes.INTEGER, defaultValue: 10 },
        active: { type: DataTypes.BOOLEAN, defaultValue: true },
        company: { type: DataTypes.STRING(120), allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('config_items', ['category'], { name: 'config_items_category' });
      console.log('Created config_items table.');
    }

    if (!tables.includes('account_payments')) {
      await qi.createTable('account_payments', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(60), allowNull: false, defaultValue: '/' },
        paymentType: { type: DataTypes.ENUM('inbound', 'outbound'), defaultValue: 'inbound' },
        paymentDate: { type: DataTypes.DATEONLY, allowNull: true },
        journal: { type: DataTypes.STRING(120), allowNull: true },
        journalId: { type: DataTypes.UUID, allowNull: true },
        paymentMethod: { type: DataTypes.STRING(40), defaultValue: 'Manual' },
        partner: { type: DataTypes.STRING(250), allowNull: true },
        partnerId: { type: DataTypes.UUID, allowNull: true },
        invoiceNumbers: { type: DataTypes.JSON, allowNull: true },
        amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        state: { type: DataTypes.ENUM('draft', 'posted', 'sent', 'reconciled', 'cancel'), defaultValue: 'draft' },
        memo: { type: DataTypes.STRING(250), allowNull: true },
        company: { type: DataTypes.STRING(120), allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created account_payments table.');
    }

    if (!tables.includes('pro_forma_invoices')) {
      await qi.createTable('pro_forma_invoices', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(40), allowNull: false },
        customer: { type: DataTypes.STRING(250), allowNull: true },
        customerId: { type: DataTypes.UUID, allowNull: true },
        serviceJobRefs: { type: DataTypes.JSON, allowNull: true },
        houseShipmentRefs: { type: DataTypes.JSON, allowNull: true },
        companyCurrency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        taxes: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        total: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        state: { type: DataTypes.ENUM('to_approve', 'approved', 'invoiced', 'cancel'), defaultValue: 'to_approve' },
        invoiceId: { type: DataTypes.UUID, allowNull: true },
        invoiceName: { type: DataTypes.STRING(60), allowNull: true },
        lines: { type: DataTypes.JSON, allowNull: true },
        company: { type: DataTypes.STRING(120), allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created pro_forma_invoices table.');
    }

    if (!tables.includes('products')) {
      await qi.createTable('products', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        internalReference: { type: DataTypes.STRING(60), allowNull: true },
        name: { type: DataTypes.STRING(200), allowNull: false },
        salesPrice: { type: DataTypes.DECIMAL(14, 2), defaultValue: 1 },
        cost: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
        customerTaxes: { type: DataTypes.JSON, allowNull: true },
        vendorTaxes: { type: DataTypes.JSON, allowNull: true },
        canBeSold: { type: DataTypes.BOOLEAN, defaultValue: true },
        canBePurchased: { type: DataTypes.BOOLEAN, defaultValue: true },
        category: { type: DataTypes.STRING(120), allowNull: true },
        uom: { type: DataTypes.STRING(40), defaultValue: 'Units' },
        incomeAccount: { type: DataTypes.STRING(120), allowNull: true },
        expenseAccount: { type: DataTypes.STRING(120), allowNull: true },
        active: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created products table.');
    }

    if (!tables.includes('account_moves')) {
      // One table behind Invoices, Credit/Debit Notes, Bills, Refunds and
      // Journal Entries — `moveType` decides which menu a row belongs to.
      await qi.createTable('account_moves', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(60), allowNull: false, defaultValue: '/' },
        moveType: {
          type: DataTypes.ENUM('entry', 'out_invoice', 'out_refund', 'out_debit',
            'in_invoice', 'in_refund', 'in_debit'),
          allowNull: false, defaultValue: 'out_invoice',
        },
        state: { type: DataTypes.ENUM('draft', 'posted', 'cancel'), defaultValue: 'draft' },
        paymentState: {
          type: DataTypes.ENUM('not_paid', 'in_payment', 'partial', 'paid', 'reversed'),
          defaultValue: 'not_paid',
        },
        partner: { type: DataTypes.STRING(250), allowNull: true },
        partnerId: { type: DataTypes.UUID, allowNull: true },
        partnerAddress: { type: DataTypes.TEXT, allowNull: true },
        paymentReference: { type: DataTypes.STRING(120), allowNull: true },
        invoiceDate: { type: DataTypes.DATEONLY, allowNull: true },
        invoiceDateDue: { type: DataTypes.DATEONLY, allowNull: true },
        paymentTermLabel: { type: DataTypes.STRING(40), allowNull: true },
        journal: { type: DataTypes.STRING(120), allowNull: true },
        journalId: { type: DataTypes.UUID, allowNull: true },
        label: { type: DataTypes.STRING(120), allowNull: true },
        ref: { type: DataTypes.STRING(250), allowNull: true },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        companyCurrency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        amountUntaxed: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        amountTax: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        amountTotal: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        amountTotalCurrency: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        amountResidual: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        addChargesFrom: { type: DataTypes.ENUM('house', 'master', 'service_job'), allowNull: true },
        chargeHouseShipments: { type: DataTypes.JSON, allowNull: true },
        chargeMasterShipments: { type: DataTypes.JSON, allowNull: true },
        chargeServiceJobs: { type: DataTypes.JSON, allowNull: true },
        houseShipmentRefs: { type: DataTypes.JSON, allowNull: true },
        masterShipmentRefs: { type: DataTypes.JSON, allowNull: true },
        serviceJobRefs: { type: DataTypes.JSON, allowNull: true },
        lines: { type: DataTypes.JSON, allowNull: true },
        journalItems: { type: DataTypes.JSON, allowNull: true },
        sourceBillId: { type: DataTypes.UUID, allowNull: true },
        reversedEntryId: { type: DataTypes.UUID, allowNull: true },
        reversedEntryName: { type: DataTypes.STRING(60), allowNull: true },
        narration: { type: DataTypes.TEXT, allowNull: true },
        toCheck: { type: DataTypes.BOOLEAN, defaultValue: false },
        company: { type: DataTypes.STRING(120), allowNull: true },
        companyId: { type: DataTypes.UUID, allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('account_moves', ['moveType'], { name: 'account_moves_type' });
      await qi.addIndex('account_moves', ['state'], { name: 'account_moves_state' });
      console.log('Created account_moves table.');
    } else {
      // sourceBillId arrived with the Vendors wave; existing installs need the
      // column added rather than the table recreated.
      const moveCols = await qi.describeTable('account_moves');
      if (!moveCols.sourceBillId) {
        await sequelize.query('ALTER TABLE account_moves ADD COLUMN sourceBillId CHAR(36) BINARY NULL');
        console.log('Added account_moves.sourceBillId.');
      }
    }

    if (!tables.includes('account_journals')) {
      // Accounting > Dashboard: one card per journal.
      await qi.createTable('account_journals', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(120), allowNull: false },
        code: { type: DataTypes.STRING(20), allowNull: true },
        type: { type: DataTypes.ENUM('sale', 'purchase', 'bank', 'cash', 'general'), allowNull: false },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        bankAccNumber: { type: DataTypes.STRING(60), allowNull: true },
        colour: { type: DataTypes.STRING(20), allowNull: true },
        sequence: { type: DataTypes.INTEGER, defaultValue: 10 },
        balanceGl: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        outstandingAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
        latestStatement: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
        toReconcile: { type: DataTypes.INTEGER, defaultValue: 0 },
        isConnected: { type: DataTypes.BOOLEAN, defaultValue: false },
        toValidateCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        toValidateAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        unpaidCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        unpaidAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        lateCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        lateAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        toCheckCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        toCheckAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
        ageingBuckets: { type: DataTypes.JSON, allowNull: true },
        sparkline: { type: DataTypes.JSON, allowNull: true },
        companyId: { type: DataTypes.UUID, allowNull: true },
        company: { type: DataTypes.STRING(120), allowNull: true },
        active: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('account_journals', ['type'], { name: 'account_journals_type' });
      console.log('Created account_journals table.');
    }

    if (!tables.includes('tms_requests')) {
      // TMS > TMS Requests. Written by the system, read-only in the UI.
      await qi.createTable('tms_requests', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(80), allowNull: false },
        requestUuid: { type: DataTypes.STRING(80), allowNull: true },
        providerMessageType: { type: DataTypes.STRING(60), allowNull: true },
        requestDate: { type: DataTypes.DATE, allowNull: true },
        requestCompleteDate: { type: DataTypes.DATE, allowNull: true },
        resubmitUrl: { type: DataTypes.STRING(400), allowNull: true },
        requestedBy: { type: DataTypes.STRING(150), allowNull: true },
        requestedById: { type: DataTypes.UUID, allowNull: true },
        providerStatus: { type: DataTypes.STRING(250), allowNull: true },
        status: { type: DataTypes.ENUM('init', 'success', 'fail', 'invalid'), defaultValue: 'init' },
        resModel: { type: DataTypes.STRING(80), allowNull: true },
        resId: { type: DataTypes.STRING(80), allowNull: true },
        reference: { type: DataTypes.STRING(150), allowNull: true },
        jsonPayload: { type: DataTypes.TEXT, allowNull: true },
        requestResponse: { type: DataTypes.TEXT, allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created tms_requests table.');
    }

    if (!tables.includes('permission_groups')) {
      await qi.createTable('permission_groups', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        category: { type: DataTypes.STRING(60), allowNull: false },
        name: { type: DataTypes.STRING(80), allowNull: false },
        fullName: { type: DataTypes.STRING(160), allowNull: false },
        description: { type: DataTypes.STRING(250), allowNull: true },
        ownDocumentsOnly: { type: DataTypes.BOOLEAN, defaultValue: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('permission_groups', ['category', 'name'], { unique: true, name: 'permission_groups_cat_name' });
      console.log('Created permission_groups table.');
    }

    if (!tables.includes('model_access')) {
      await qi.createTable('model_access', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        model: { type: DataTypes.STRING(80), allowNull: false },
        label: { type: DataTypes.STRING(120), allowNull: false },
        groupId: { type: DataTypes.UUID, allowNull: true },
        permRead: { type: DataTypes.BOOLEAN, defaultValue: false },
        permWrite: { type: DataTypes.BOOLEAN, defaultValue: false },
        permCreate: { type: DataTypes.BOOLEAN, defaultValue: false },
        permDelete: { type: DataTypes.BOOLEAN, defaultValue: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('model_access', ['model'], { name: 'model_access_model' });
      await qi.addIndex('model_access', ['groupId'], { name: 'model_access_group' });
      console.log('Created model_access table.');
    }

    if (!tables.includes('user_groups')) {
      await qi.createTable('user_groups', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        userId: { type: DataTypes.UUID, allowNull: false },
        groupId: { type: DataTypes.UUID, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('user_groups', ['userId', 'groupId'], { unique: true, name: 'user_groups_user_group' });
      console.log('Created user_groups table.');
    }

    if (!tables.includes('app_settings')) {
      // Configuration > Settings key/value store.
      await qi.createTable('app_settings', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        category: { type: DataTypes.STRING(40), allowNull: false },
        key: { type: DataTypes.STRING(80), allowNull: false },
        value: { type: DataTypes.TEXT, allowNull: true },
        kind: { type: DataTypes.ENUM('bool', 'text', 'number', 'select'), defaultValue: 'text' },
        isSecret: { type: DataTypes.BOOLEAN, defaultValue: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await qi.addIndex('app_settings', ['category', 'key'], { unique: true, name: 'app_settings_category_key' });
      console.log('Created app_settings table.');
    }

    if (!tables.includes('calendar_events')) {
      // Calendar > Meetings.
      await qi.createTable('calendar_events', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(250), allowNull: false },
        start: { type: DataTypes.DATE, allowNull: false },
        stop: { type: DataTypes.DATE, allowNull: false },
        duration: { type: DataTypes.FLOAT, defaultValue: 1 },
        allday: { type: DataTypes.BOOLEAN, defaultValue: false },
        eventTz: { type: DataTypes.STRING(60), allowNull: true },
        organizer: { type: DataTypes.STRING(150), allowNull: true },
        organizerId: { type: DataTypes.UUID, allowNull: true },
        attendees: { type: DataTypes.JSON, allowNull: true },
        location: { type: DataTypes.STRING(250), allowNull: true },
        videocallLocation: { type: DataTypes.STRING(250), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        alarms: { type: DataTypes.JSON, allowNull: true },
        tags: { type: DataTypes.JSON, allowNull: true },
        privacy: { type: DataTypes.ENUM('public', 'private', 'confidential'), defaultValue: 'public' },
        showAs: { type: DataTypes.ENUM('free', 'busy'), defaultValue: 'busy' },
        recurrency: { type: DataTypes.BOOLEAN, defaultValue: false },
        interval: { type: DataTypes.INTEGER, defaultValue: 1 },
        rruleType: { type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'), defaultValue: 'weekly' },
        endType: { type: DataTypes.ENUM('count', 'end_date', 'forever'), defaultValue: 'count' },
        count: { type: DataTypes.INTEGER, defaultValue: 1 },
        until: { type: DataTypes.DATEONLY, allowNull: true },
        monthBy: { type: DataTypes.ENUM('date', 'day'), defaultValue: 'date' },
        day: { type: DataTypes.INTEGER, allowNull: true },
        byday: { type: DataTypes.STRING(4), allowNull: true },
        weekday: { type: DataTypes.STRING(4), allowNull: true },
        weekdays: { type: DataTypes.JSON, allowNull: true },
        resModel: { type: DataTypes.STRING(80), allowNull: true },
        resId: { type: DataTypes.STRING(80), allowNull: true },
        resName: { type: DataTypes.STRING(250), allowNull: true },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        active: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created calendar_events table.');
    }

    if (!tables.includes('purchase_orders')) {
      // Procurement > Purchase: POs raised against a shipment.
      await qi.createTable('purchase_orders', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        poNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        poDate: { type: DataTypes.DATE, allowNull: true },
        state: { type: DataTypes.ENUM('draft', 'to_approve', 'approved', 'cancel', 'reject'), defaultValue: 'draft' },
        priority: { type: DataTypes.INTEGER, defaultValue: 0 },
        vendor: { type: DataTypes.STRING(200), allowNull: true },
        vendorInvoiceNo: { type: DataTypes.STRING(80), allowNull: true },
        vendorInvoiceDate: { type: DataTypes.DATEONLY, allowNull: true },
        contact: { type: DataTypes.STRING(150), allowNull: true },
        shipmentNo: { type: DataTypes.STRING(80), allowNull: true },
        createdByName: { type: DataTypes.STRING(150), allowNull: true },
        approvedByName: { type: DataTypes.STRING(150), allowNull: true },
        purchaseApprover: { type: DataTypes.STRING(150), allowNull: true },
        approvedDate: { type: DataTypes.DATEONLY, allowNull: true },
        chargeLines: { type: DataTypes.JSON, allowNull: true },
        currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
        amountTotal: { type: DataTypes.DECIMAL(16, 2), defaultValue: 0 },
        cancelReason: { type: DataTypes.STRING(150), allowNull: true },
        cancelRemark: { type: DataTypes.TEXT, allowNull: true },
        billCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        documentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created purchase_orders table.');
    }

    if (!tables.includes('rms_tariffs')) {
      // RMS > Tariff: per-lane rate cards with three JSON charge grids.
      await qi.createTable('rms_tariffs', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        tariffNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        tariffDate: { type: DataTypes.DATEONLY, allowNull: true },
        expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
        service: { type: DataTypes.STRING(10), defaultValue: 'SEA' },
        trade: { type: DataTypes.STRING(10), defaultValue: 'EXP' },
        cargoType: { type: DataTypes.STRING(20), defaultValue: 'FCL' },
        originCountry: { type: DataTypes.STRING(100), allowNull: true },
        originPort: { type: DataTypes.STRING(200), allowNull: true },
        destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
        destinationPort: { type: DataTypes.STRING(200), allowNull: true },
        isHazardous: { type: DataTypes.BOOLEAN, defaultValue: false },
        originCharges: { type: DataTypes.JSON, allowNull: true },
        freightCharges: { type: DataTypes.JSON, allowNull: true },
        destinationCharges: { type: DataTypes.JSON, allowNull: true },
        grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        chargeableWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        company: { type: DataTypes.STRING(150), allowNull: true },
        documentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        activityLog: { type: DataTypes.JSON, allowNull: true },
        followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdBy: { type: DataTypes.UUID, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      console.log('Created rms_tariffs table.');
    }

    if (!tables.includes('organizations')) {
      // Partner master behind the Organizations module. Columns follow the
      // CargoFlo Organizations form (header + its six tabs).
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

    // Procurement's "Create Vendor Bill" raises a real bill off the PO, so the
    // bill needs to point back at it and carry the PO's free-text vendor name
    // (procurement vendors aren't necessarily rows in `customers`).
    if (tables.includes('vendor_bills')) {
      const billCols = await qi.describeTable('vendor_bills');
      const billAdditions = {
        purchaseOrderId: 'CHAR(36) NULL',
        vendorName: 'VARCHAR(200) NULL',
      };
      for (const [col, def] of Object.entries(billAdditions)) {
        if (!billCols[col]) {
          await sequelize.query(`ALTER TABLE vendor_bills ADD COLUMN \`${col}\` ${def}`);
          console.log(`Added vendor_bills.${col} column.`);
        }
      }
      if (billCols.vendorId && billCols.vendorId.allowNull === false) {
        // CHAR(36) BINARY must be preserved or the FK to customers.id breaks.
        await sequelize.query('ALTER TABLE vendor_bills MODIFY COLUMN vendorId CHAR(36) BINARY NULL');
        console.log('Relaxed vendor_bills.vendorId to nullable.');
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
        { code: 'CargoFlo (China)-AF', name: 'ADMIN FEE', extra: '¥ 1.00', extra2: '1.00 AED' },
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
    // after verifying against the live CargoFlo demo (Container Category,
    // Countries, Vessel), replacing the earlier placeholder rows.
    const staleVessel = await MasterDataItem.count({ where: { category: 'vessel', code: 'IMO9321483' } });
    if (staleVessel > 0) {
      await MasterDataItem.destroy({ where: { category: ['vessel', 'countries', 'container-category'] } });
      console.log('Cleared stale master data for vessel/countries/container-category for re-seed.');
    }

    // One-time fixup: re-seed categories whose column layout was corrected
    // after a deeper pass against the live CargoFlo demo (Container/Package
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

// Operations master data captured 1:1 from the live CargoFlo demo
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
  ['CargoFlo (Dubai)', 'CF-DXB', 'AED', 'United Arab Emirates', 'Dubai'],
  ['CargoFlo (USA)', 'CF-USA', 'USD', 'United States', 'New York'],
  ['CargoFlo (China)', 'CF-CN', 'CNY', 'China', 'Shanghai'],
  ['CargoFlo (India)', 'CF-IN', 'INR', 'India', 'Ahmedabad'],
  ['CargoFlo (Saudi)', 'CF-SA', 'SAR', 'Saudi Arabia', 'Riyadh'],
  ['CargoFlo (Malaysia)', 'CF-MY', 'MYR', 'Malaysia', 'Kuala Lumpur'],
  ['CargoFlo (United Arab Emirates)', 'CF-UAE', 'AED', 'United Arab Emirates', 'Abu Dhabi'],
  ['S4 Logistics', 'S4-LOG', 'USD', 'United States', 'Houston'],
];

// Party Types available on the Organizations form (res.partner.category).
const PARTY_TYPES = [
  'consignee', 'Customer', 'Customs', 'iso tank cleaning station', 'Logistics',
  'Miami', 'shipper', 'Transporter', 'United State', 'United States',
];

// Reminders offered by the Meeting form (calendar.alarm).
const CALENDAR_ALARMS = [
  'Notification - 15 Minutes', 'Notification - 30 Minutes', 'Notification - 1 Hours',
  'Notification - 2 Hours', 'Notification - 1 Days', 'Email - 3 Hours', 'Email - 6 Hours',
];

const CALENDAR_TAGS = ['Interview'];

// Meetings from the live demo. Times are the local values the list view shows.
// [name, start, durationHours, organizer, attendees[], description, resModel]
const CALENDAR_EVENTS = [
  ['Business call', '2025-11-20 05:30', 1, 'Sivaranjani (Tech Support)', ['S-2: Sivaranjani (Tech Support)'], 'Business call at 10:00 PST', 'house.shipment'],
  ['LE/2025/00253', '2025-10-24 05:30', 0.5, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'prospect.lead'],
  ['Customer need a meeting with salesperson', '2025-10-16 13:30', 0.5, 'Neela Manikandan Karunanithi', ['NMK-1: Neela Manikandan Karunanithi'], '', 'house.shipment'],
  ['Meeting with a client', '2025-10-15 05:30', 1, 'Sivaranjani (Tech Support)', ['A-13: Ashish', 'S-2: Sivaranjani (Tech Support)'], '', ''],
  ['Meeting with a client', '2025-10-13 05:30', 1, 'Sivaranjani (Tech Support)', ['S-2: Sivaranjani (Tech Support)'], '', 'house.shipment'],
  ['HBLSR01518', '2025-09-16 07:30', 0.5, 'Syed Zafar (Tech Support)', ['S-1: Syed Zafar (Tech Support)'], '', 'house.shipment'],
  ['LE/2023/00007', '2025-08-13 10:30', 0.5, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'prospect.lead'],
  ['A-10: AMGAD', '2025-08-10 11:00', 0.5, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'organization'],
  ['A-10: AMGAD', '2025-08-05 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'organization'],
  ['LE/2025/00239', '2025-07-27 18:00', 0.5, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'prospect.lead'],
  ['LE/2025/00239', '2025-07-25 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'prospect.lead'],
  ['QT-SEA-EXP-FCL/2024/00123', '2025-07-18 05:30', 1, 'Deepak Dobal', ['DD-1: Deepak Dobal'], 'shdrjhjrsjt', 'quotation'],
  ['OP/2023/00005', '2025-07-12 08:00', 0.5, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'opportunity'],
  ['OP/2023/00005', '2025-07-08 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'opportunity'],
  ['discussion on teus', '2025-06-12 05:30', 1, 'Hameed Fayaz', ['HF-1: Hameed Fayaz'], '', 'prospect.lead'],
  ['LE/2023/00004', '2025-02-25 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'prospect.lead'],
  ['virtual meeting dosc ussion', '2024-11-27 10:30', 0.5, 'Mansi (Tech Support)', [], 'dsdssdsd Feedback: meeting is done', 'opportunity'],
  ['meetinglead followup', '2024-11-26 11:00', 0.5, 'Mansi (Tech Support)', [], '', 'prospect.lead'],
  ['July 24', '2024-07-30 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'sale.target'],
  ['QT-SEA-EXP-LCL/2024/00216', '2024-07-18 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'quotation'],
  ['Business Meeting', '2024-07-10 05:30', 1, 'DilliBabu (Tech Support)', ['SDCD-1: Sample Demo Customer Dubai'], '', 'organization'],
  ['QT-SEA-EXP-FCL/2024/00194', '2024-06-18 05:30', 1, 'Gyanesh Singh', ['GS-1: Gyanesh Singh'], '', 'quotation'],
  ['Cost part', '2024-04-14 15:00', 0.5, 'Administrator', ['A-55: Administrator'], '', 'organization'],
];

// Purchase orders from the live demo.
// [poNumber, poDate, vendor, shipmentNo, state, priority, amountTotal, billCount]
const PURCHASE_ORDERS = [
  ['P00164', '2026-02-04 15:16:33', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 'SEA-E-FCL-H-N-2026-01845', 'approved', 0, 1, 1],
  ['P00163', '2025-12-11 06:12:14', 'A-13: Ashish', 'HBL-0001', 'approved', 0, 250, 1],
  ['P00162', '2025-12-11 03:48:13', 'A-13: Ashish', 'HBL-123', 'approved', 0, 1, 0],
  ['P00161', '2025-10-14 09:02:02', '5TON7MD-BB-1: SUSA SHIPPING SERVICES LLC', 'HBL123', 'approved', 0, 550, 0],
  ['P00160', '2025-09-18 09:08:56', 'A-13: Ashish', 'ROA-E-FTL-H-N-2025-01521', 'approved', 0, 30, 0],
  ['P00157', '2025-09-09 06:51:31', 'A-13: Ashish', 'TEST ZAFAR', 'approved', 0, 50000, 0],
  ['P00156', '2025-09-09 06:18:45', 'CPA-1: Customer Portal Access', 'TEST ZAFAR', 'to_approve', 0, 25000, 0],
  ['P00155', '2025-09-09 05:40:40', 'A-10: AMGAD', 'HBLSR01481', 'approved', 0, 50000, 0],
  ['P00154', '2025-09-02 06:58:03', '3KAW#LBC9US-1: Leviton Manufacturing Co., Inc.', 'SEA-E-FCL-H-N-2025-01468', 'to_approve', 0, 50, 0],
  ['P00153', '2025-08-24 20:56:38', 'CPA-1: Customer Portal Access', 'HBL01445', 'approved', 0, 5100000, 1],
  ['P00152', '2025-08-18 13:41:14', 'A-14: Aafaque', 'HBL01352', 'approved', 0, 500, 0],
  ['P00151', '2025-08-16 12:37:28', 'CPA-1: Customer Portal Access', 'ZAFARTEST342234', 'reject', 1, 8880, 0],
  ['P00150', '2025-08-13 10:52:37', 'A-13: Ashish', 'HBLS01410', 'approved', 1, 50, 1],
  ['P00149', '2025-08-13 10:48:48', 'A-14: Aafaque', 'HBLS01410', 'approved', 1, 180, 0],
  ['P00148', '2025-08-13 10:16:51', 'CPA-1: Customer Portal Access', 'HBLtest', 'approved', 1, 1000000, 1],
  ['P00146', '2025-08-13 06:06:48', 'CPA-1: Customer Portal Access', 'HBLS01410', 'approved', 1, 160, 1],
  ['P00145', '2025-08-13 05:54:15', 'A-10: AMGAD', 'SEA-E-FCL-H-N-2025-01409', 'to_approve', 1, 150, 0],
  ['P00144', '2025-08-13 05:29:06', 'A-14: Aafaque', 'HBLS01410', 'approved', 0, 1046.8, 0],
  ['P00143', '2025-08-12 09:40:02', '3KAW#LBC9US(-1: Leviton Manufacturing Co., Inc.', 'SEA-E-FCL-H-N-2025-01403', 'approved', 0, 550, 1],
  ['P00142', '2025-08-05 15:08:56', 'CPA-1: Customer Portal Access', 'direct', 'cancel', 1, 1500, 0],
  ['P00138', '2025-06-18 13:40:47', '5TON7MD-BB-1: SUSA SHIPPING SERVICES LLC', 'SEA-E-FCL-H-N-2025-01231', 'approved', 0, 500, 0],
  ['P00137', '2025-06-07 05:59:38', 'CCS-1: CMA CGM S.A.', 'HBL- 2025-099', 'approved', 1, 3466, 1],
  ['P00136', '2025-05-27 11:29:06', 'CPA-1: Customer Portal Access', 'SEA-E-LCL-H-N-2025-01136', 'approved', 0, 2211, 1],
  ['P00135', '2025-05-02 17:34:32', 'A-10: AMGAD', 'HBLS01064', 'approved', 0, 1251750, 0],
  ['P00134', '2025-04-30 11:06:46', 'CPA-1: Customer Portal Access', 'HBL321', 'approved', 0, 0, 0],
  ['P00132', '2025-04-15 10:31:58', 'A-13: Ashish', 'ROA-I-FTL-H-N-2025-01003', 'approved', 0, 50, 0],
  // The live demo happens to hold no RFQs right now; these two exist so the
  // Send for Approval / Approve / Reject path is walkable without creating one.
  ['P00165', '2026-03-02 09:15:00', 'CCS-1: CMA CGM S.A.', 'SEA-I-FCL-H-N-2026-01862', 'draft', 0, 2750, 0],
  ['P00166', '2026-03-11 11:40:00', 'A-14: Aafaque', 'ROA-E-FTL-H-N-2026-01871', 'draft', 1, 420, 0],
];

// Per-PO extras that only some records carry.
const PO_DETAILS = {
  P00151: {
    vendorInvoiceNo: 'INV 00012', vendorInvoiceDate: '2025-08-09', contact: 'Abdull Abdull',
    createdByName: 'Abdallah', purchaseApprover: 'Abdallah',
    chargeLines: [{
      sNo: 1, product: '[201T0] Ocean Freight', uom: 'Shipment', noOfUnit: 4,
      chargeCurrency: 'USD', exchangeRate: 1, amountPerUnit: 600, amount: 2400,
      currencyTotalAmount: 2400, orderCurrencyTotalAmount: 8880,
    }],
  },
  P00150: {
    createdByName: 'Sivaranjani (Tech Support)', approvedByName: 'Administrator',
    purchaseApprover: 'Administrator', approvedDate: '2026-01-04',
    chargeLines: [{
      sNo: 1, product: '[OCAG] On Carriage', uom: 'Shipment', noOfUnit: 1,
      chargeCurrency: 'AED', exchangeRate: 1, amountPerUnit: 50, amount: 50,
      currencyTotalAmount: 50, orderCurrencyTotalAmount: 50,
    }],
  },
  P00165: {
    contact: 'Ravi Menon',
    chargeLines: [
      {
        sNo: 1, product: '[201T0] Ocean Freight', uom: 'Container', noOfUnit: 2,
        chargeCurrency: 'USD', exchangeRate: 3.67, amountPerUnit: 350, amount: 700,
        currencyTotalAmount: 700, orderCurrencyTotalAmount: 2569,
      },
      {
        sNo: 2, product: '[THCD] Terminal Handling - Destination', uom: 'Container', noOfUnit: 2,
        chargeCurrency: 'AED', exchangeRate: 1, amountPerUnit: 90.5, amount: 181,
        currencyTotalAmount: 181, orderCurrencyTotalAmount: 181,
      },
    ],
  },
  P00166: {
    contact: 'Aafaque Ahmed',
    chargeLines: [{
      sNo: 1, product: '[PCAG] Pre Carriage', uom: 'Shipment', noOfUnit: 3,
      chargeCurrency: 'AED', exchangeRate: 1, amountPerUnit: 140, amount: 420,
      currencyTotalAmount: 420, orderCurrencyTotalAmount: 420,
    }],
  },
};

// RMS tariffs from the live demo.
// [number, date, service, trade, cargo, originCountry, originPort, destCountry, destPort, expiry]
const RMS_TARIFFS = [
  ['TF/00001', '2025-09-01', 'SEA', 'EXP', 'FCL', 'Malaysia', 'BINTULU, SARAWAK - [Malaysia - MYBTU]', 'Singapore', 'SINGAPORE - [Singapore - SGSIN]', '2025-12-31'],
  ['TF/00003', '2025-09-01', 'AIR', 'EXP', 'LSE', 'Malaysia', 'Alor Setar - [Malaysia - AOR]', 'Singapore', 'singapore - [Singapore - SIN]', '2025-12-31'],
  ['TF/00004', '2025-09-01', 'ROA', 'EXP', 'FTL', 'Malaysia', 'Air Itam/Penang - [Malaysia - MYAIR]', 'Singapore', 'Bukit Merah Estate - [Singapore - SGBKM]', '2026-01-31'],
  ['TF/00229', '2025-09-29', 'SEA', 'EXP', 'FCL', 'Philippines', 'DAVAO, MINDANAO - [Philippines - PHDVO]', 'United Arab Emirates', 'ABU DHABI - [United Arab Emirates - AEAUH]', '2025-12-31'],
  ['TF/00230', '2025-10-10', 'SEA', 'EXP', 'FCL', 'Malaysia', 'Port Klang - [Malaysia - MYKUL]', 'United Arab Emirates', 'JEBEL ALI SEAPORT, U.A.E - [United Arab Emirates - AEJEA]', '2025-11-30'],
  ['TF/00231', '2025-10-13', 'SEA', 'EXP', 'FCL', 'Malaysia', 'BINTULU, SARAWAK - [Malaysia - MYBTU]', 'India', 'Gandhinagar - [India - INGDH]', '2025-12-31'],
  ['TF/00232', '2025-11-22', 'AIR', 'IMP', 'PLT', 'China', 'Shanghai Pudong Intl - [China - PVG]', 'Qatar', 'Doha - [Qatar - DOH]', '2025-11-30'],
  ['TF/00233', '2025-11-22', 'SEA', 'IMP', 'FCL', 'United Kingdom', 'FELIXSTOWE - [United Kingdom - GBFXT]', 'Qatar', 'HAMAD - [Qatar - QAHMD]', '2025-11-30'],
  ['TF/00234', '2025-11-23', 'ROA', 'EXP', 'FTL', 'Qatar', "Umm Sa'id (Mesaieed) - [Qatar - QAUMS]", 'Saudi Arabia', 'Riyadh Dry Port - [Saudi Arabia - SARYP]', '2025-12-15'],
  ['TF/00235', '2025-11-23', 'AIR', 'IMP', 'PLT', 'France', 'Charles-de-Gaulle Apt/Paris - [France - CDG]', 'Qatar', 'Doha - [Qatar - DOH]', '2025-11-30'],
  ['TF/00245', '2025-12-11', 'SEA', 'EXP', 'FCL', 'India', 'HALDIA - [India - INHAL]', 'Malaysia', 'KOTA KINABALU, SABAH - [Malaysia - MYBKI]', '2026-01-31'],
  ['TF/00246', '2026-01-06', 'AIR', 'EXP', 'PLT', 'Algeria', 'Ain Eddis Apt/Bou Saada - [Algeria - BUJ]', 'Angola', 'Cafunfo - [Angola - CFF]', '2026-01-14'],
  ['TF/00247', '2026-01-16', 'AIR', 'EXP', 'CR', 'Malaysia', 'Kuala Lumpur - [Malaysia - KUL]', 'India', 'Mumbai - [India - BOM]', '2026-04-30'],
];

// TF/00004 carries real charge lines on all three grids; the rest start empty.
const RMS_CHARGE_LINES = {
  'TF/00004': {
    originCharges: [{ charge: 'Handling fee', unit: 'Shipment', currency: 'MYR', ssp: 6000, msp: 7000, cost: 8000, minimum: 4500, tos: 'FREE CARRIER', carrier: 'ABC Transporter', agent: 'A-10: AMGAD' }],
    freightCharges: [{ charge: 'Freight charge', unit: 'Shipment', currency: 'MYR', ssp: 8000, msp: 6000, cost: 7000, minimum: 5500, tos: 'FREE CARRIER', carrier: 'ABC Transporter', agent: 'A-10: AMGAD' }],
    destinationCharges: [{ charge: 'BL Fee', unit: 'Shipment', currency: 'MYR', ssp: 7900, msp: 6000, cost: 5000, minimum: 3500, tos: 'FREE CARRIER', carrier: 'ABC Transporter', agent: 'A-10: AMGAD' }],
  },
};

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
  ['A-74', 'admin', 'person', '+91 73377 69988', 'ajay.bhaskar@cargoflo.com', '', 'India', ''],
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
  ['A-71', 'ABC', 'person', '', 'ajay.bhaskar@cargoflo5.com', '', 'India', ''],
  ['S-176', 'Sandi', 'person', '', 'sandi@gmail.com', '', '', ''],
  ['T-39', 'Tepm', 'person', '', 'ajay.bhaskar@cargoflo3.com', '', 'India', ''],
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

    // Rows seeded before the rename still carry the old brand, including the
    // company codes the seeds below look up. Run this first so those lookups
    // resolve against renamed rows rather than silently falling back.
    const { rebrandData } = require('./rebrandData');
    const renamed = await rebrandData(sequelize);
    if (renamed) console.log(`Rebranded ${renamed} stored values to CargoFlo.`);

    // Transactional rows stored the operating company as a name only, so
    // nothing could filter by it. Give them the key and resolve it.
    const { backfillCompanyIds } = require('./companyBackfill');
    const qiScope = sequelize.getQueryInterface();
    const companyFix = await backfillCompanyIds(sequelize, qiScope);

    // Portal logins need a customer to be scoped to. Add the link, then point
    // the portal accounts at customers that actually carry history so the
    // portal shows real interlinked records rather than an empty shell.
    const userCols = await qiScope.describeTable('users');
    if (!userCols.customerId) {
      await sequelize.query('ALTER TABLE users ADD COLUMN customerId CHAR(36) BINARY NULL');
      console.log('Added users.customerId.');
    }
    const PORTAL_LINKS = [
      ['john@cargoflo.com', 'Global Trade Corp'],
      ['maxismy@gmail.com', 'Customer Portal Access'],
    ];
    for (const [email, customerName] of PORTAL_LINKS) {
      const [done] = await sequelize.query(
        `UPDATE users u
           JOIN customers c ON (c.companyName = :name OR c.contactName = :name)
            SET u.customerId = c.id
          WHERE u.email = :email AND u.customerId IS NULL`,
        { replacements: { name: customerName, email } }
      );
      if (done?.affectedRows) console.log(`Linked ${email} to customer ${customerName}.`);
    }
    if (companyFix.added) console.log(`Added companyId to ${companyFix.added} table(s).`);
    if (companyFix.linked) console.log(`Linked ${companyFix.linked} rows to their operating company.`);

    // One-time fixup: drop the earlier placeholder rows (they use the generated
    // "CFS-DLV-"/"SHR-" numbering rather than the demo's real reference format)
    // so the real CargoFlo records below can take their place.
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

    const { RMSTariff } = require('../models');
    if ((await RMSTariff.count()) === 0) {
      await RMSTariff.bulkCreate(RMS_TARIFFS.map(
        ([tariffNumber, tariffDate, service, trade, cargoType, originCountry, originPort, destinationCountry, destinationPort, expiryDate]) => ({
          tariffNumber, tariffDate, service, trade, cargoType,
          originCountry, originPort, destinationCountry, destinationPort, expiryDate,
          company: 'CargoFlo Logistics Ltd',
          activityLog: [{
            at: new Date(tariffDate).toISOString(),
            author: 'Mohamed (Tech Support)',
            kind: 'log', body: 'Tariff created', changes: [],
          }],
          ...(RMS_CHARGE_LINES[tariffNumber] || {}),
        })
      ));
      console.log(`Seeded ${RMS_TARIFFS.length} RMS tariffs.`);
    }

    // Configuration > Settings defaults. Integration keys ship BLANK on
    // purpose — paste real credentials into the UI at runtime so they live in
    // the database and never in the repo.
    const { AppSetting } = require('../models');
    const SETTING_DEFAULTS = [
      ['freight_booking', 'json_payload', 'Carrier Booking JSON Data Main Schema', 'select', false],
      ['freight_booking', 'cargoai_enabled', 'true', 'bool', false],
      ['freight_booking', 'cargoai_product_key', '', 'text', true],
      ['freight_booking', 'buyco_enabled', 'true', 'bool', false],
      ['freight_booking', 'buyco_product_key', '', 'text', true],
      ['tms', 'json_payload', 'Global TMS JSON Data Main Schema', 'select', false],
      ['freight_schedule', 'oag_enabled', 'true', 'bool', false],
      ['freight_schedule', 'oag_environment', 'sandbox', 'select', false],
      ['freight_schedule', 'oag_api_key', '', 'text', true],
      ['freight_schedule', 'inttra_enabled', 'true', 'bool', false],
      ['freight_schedule', 'inttra_environment', 'sandbox', 'select', false],
      ['freight_schedule', 'inttra_client_id', '', 'text', true],
      ['freight_schedule', 'inttra_client_secret', '', 'text', true],
      ['freight_schedule', 'cargoflo_schedule_enabled', 'false', 'bool', false],
      ['crm', 'multi_teams', 'true', 'bool', false],
      ['crm', 'enable_party_types', 'true', 'bool', false],
      ['crm', 'enable_prospect_mandatory', 'false', 'bool', false],
      ['crm', 'enable_target_non_mandatory', 'true', 'bool', false],
      ['freight', 'pickup_type', '[PUD] Pickup', 'select', false],
      ['freight', 'on_carriage_type', '[OCAG] On Carriage', 'select', false],
      ['freight', 'pre_carriage_type', '[PCAG] Pre Carriage', 'select', false],
      ['freight', 'delivery_type', '[DLV] Delivery', 'select', false],
      ['freight', 'file_size_limit_mb', '5', 'number', false],
      ['freight', 'max_document_history', '3', 'number', false],
      ['freight', 'customer_kyc', 'true', 'bool', false],
      ['freight', 'margin_percent', '0', 'number', false],
      ['freight', 'margin_revenue', '0', 'number', false],
      ['freight', 'indirect_cost_as_expense', 'true', 'bool', false],
      ['freight', 'show_contact_prefix', 'true', 'bool', false],
      ['freight', 're_export_shipment', 'true', 'bool', false],
      ['freight', 'container_length_validation', 'true', 'bool', false],
      ['freight', 'container_iso6346_validation', 'true', 'bool', false],
      ['freight', 'enable_part_bl', 'true', 'bool', false],
      ['freight', 'export_to_import', 'true', 'bool', false],
      ['freight', 'scac_prefix_master', 'false', 'bool', false],
      ['freight', 'party_types_master', 'true', 'bool', false],
      ['freight', 'load_calculator_enabled', 'true', 'bool', false],
      ['freight', 'load_calculator_api_key', '', 'text', true],
      ['freight', 'shipment_tracking_enabled', 'true', 'bool', false],
      ['freight', 'tracking_provider', 'cargoflo', 'select', false],
      ['freight', 'cargoflo_product_key', '', 'text', true],
      ['freight', 'tracking_update_frequency_hours', '2', 'number', false],
      ['freight', 'create_house_from_master', 'true', 'bool', false],
      ['freight', 'charge_master_migration', 'true', 'bool', false],
      ['freight', 'cut_off_dates', 'true', 'bool', false],
      ['freight', 'footer_details', 'false', 'bool', false],
      ['freight', 'shipper_consignee_non_mandatory', 'false', 'bool', false],
      ['freight', 'status_change_without_hbl', 'false', 'bool', false],
      ['freight', 'external_carrier_bookings', 'false', 'bool', false],
      ['freight', 'proforma_service_job', 'true', 'bool', false],
      ['freight', 'fiata_username', '', 'text', true],
      ['freight', 'fiata_password', '', 'text', true],
      ['freight', 'fiata_forwarder_id', '', 'text', true],
      ['freight', 'transportation_container_details', 'true', 'bool', false],
      ['freight', 'stop_mawb_validation', 'true', 'bool', false],
      ['freight', 'enable_quote_routing', 'false', 'bool', false],
      ['freight', 'enable_temporary_party', 'false', 'bool', false],
      ['general', 'packs_uom', 'BAG (Bag)', 'select', false],
      ['general', 'weight_uom', 'kg', 'select', false],
      ['general', 'volume_uom', 'm³', 'select', false],
      ['general', 'dimension_uom', 'cm', 'select', false],
      ['general', 'volumetric_divided_value', '5000', 'number', false],
      ['general', 'customer_account_mode', 'invitation', 'select', false],
      ['general', 'password_reset', 'true', 'bool', false],
      ['general', 'default_access_rights', 'true', 'bool', false],
      ['general', 'audit_log', 'true', 'bool', false],
      ['general', 'audit_log_days', '180', 'number', false],
      ['general', 'google_drive', 'true', 'bool', false],
      ['general', 'unsplash', 'true', 'bool', false],
      ['general', 'recaptcha', 'true', 'bool', false],
      ['general', 'recaptcha_min_score', '0.50', 'number', false],
      ['website', 'name', 'CargoFlo', 'text', false],
      ['website', 'domain', '', 'text', false],
      ['website', 'cookies_bar', 'false', 'bool', false],
      ['website', 'social_media', 'false', 'bool', false],
      ['website', 'google_maps', 'false', 'bool', false],
      ['website', 'google_analytics', 'false', 'bool', false],
      ['customs', 'subscriber_uuid', '', 'text', true],
      ['customs', 'subscription_date', '', 'text', false],
      ['customs', 'retain_completed_queue_days', '60', 'number', false],
      ['customs', 'retry_count', '5', 'number', false],
      ['invoicing', 'custom_reference_number', 'false', 'bool', false],
      ['invoicing', 'fiscal_year_last_month', 'December', 'select', false],
      ['invoicing', 'fiscal_year_last_day', '31', 'number', false],
      ['invoicing', 'deferred_revenue', 'true', 'bool', false],
      ['invoicing', 'fixed_assets', 'true', 'bool', false],
      ['invoicing', 'lumpsum_discount', 'true', 'bool', false],
      ['invoicing', 'sales_tax', 'VAT 5% (Dubai)', 'select', false],
      ['invoicing', 'purchase_tax', 'VAT 5%', 'select', false],
      ['invoicing', 'rounding_method', 'globally', 'select', false],
      ['invoicing', 'fiscal_country', 'United Arab Emirates', 'select', false],
      ['invoicing', 'main_currency', 'AED', 'select', false],
      ['invoicing', 'multi_currency_adjust', 'true', 'bool', false],
      ['invoicing', 'invoice_print', 'true', 'bool', false],
      ['invoicing', 'invoice_send_email', 'true', 'bool', false],
      ['invoicing', 'line_subtotals', 'tax_excluded', 'select', false],
      ['invoicing', 'invoice_warnings', 'true', 'bool', false],
      ['invoicing', 'default_terms', 'true', 'bool', false],
      ['invoicing', 'credit_limit_type', 'Organization Level Credit Limit', 'select', false],
      ['invoicing', 'restrict_document_print', 'true', 'bool', false],
      ['invoicing', 'invoice_online_payment', 'true', 'bool', false],
      ['invoicing', 'qr_codes', 'false', 'bool', false],
      ['invoicing', 'pdc_payments', 'true', 'bool', false],
      ['invoicing', 'wip_automation', 'true', 'bool', false],
      ['invoicing', 'analytic_accounting', 'true', 'bool', false],
      ['invoicing', 'analytic_tags', 'true', 'bool', false],
      ['invoicing', 'margin_analysis', 'true', 'bool', false],
    ];
    for (const [category, key, value, kind, isSecret] of SETTING_DEFAULTS) {
      await AppSetting.findOrCreate({
        where: { category, key },
        defaults: { category, key, value, kind, isSecret },
      });
    }

    // ── Accounting journals (Dashboard cards) ──
    const { AccountJournal } = require('../models');
    if ((await AccountJournal.count()) === 0) {
      const { JOURNALS, ageingLabels, shape } = require('./seedData/accountJournals');
      const labels = ageingLabels();
      const dubai = await Company.findOne({ where: { code: 'CF-DXB' } });
      await AccountJournal.bulkCreate(JOURNALS.map(
        ([name, type, code, bankAccNumber, balanceGl, outstanding, latest,
          toReconcile, isConnected, counters, colour], i) => {
          const c = counters || [0, 0, 0, 0, 0, 0, 0, 0];
          const seed = i + 7;
          return {
            name, type, code, bankAccNumber,
            currency: name === 'Bank of America' ? 'USD' : 'AED',
            colour: colour || null,
            sequence: (i + 1) * 10,
            balanceGl: balanceGl || 0,
            outstandingAmount: outstanding,
            latestStatement: latest,
            toReconcile: toReconcile || 0,
            isConnected: !!isConnected,
            toValidateCount: c[0], toValidateAmount: c[1],
            unpaidCount: c[2], unpaidAmount: c[3],
            lateCount: c[4], lateAmount: c[5],
            toCheckCount: c[6], toCheckAmount: c[7],
            // Sale/purchase cards carry the six ageing columns; bank/cash carry
            // a sparkline instead.
            ageingBuckets: ['sale', 'purchase'].includes(type)
              ? labels.map((label, b) => ({ label, amount: shape(seed + b, 1, Number(c[3]) || 0)[0] }))
              : [],
            sparkline: ['bank', 'cash'].includes(type) ? shape(seed, 12, 100) : [],
            companyId: dubai?.id || null,
            company: dubai?.name || 'CargoFlo (Dubai)',
            active: true,
          };
        }
      ));
      console.log(`Seeded ${JOURNALS.length} account journals.`);
    }

    // ── Accounting moves (invoices, credit notes, debit notes) ──
    const { AccountMove } = require('../models');
    if ((await AccountMove.count()) === 0) {
      const { INVOICES, CREDIT_NOTES, DEBIT_NOTES, PRODUCTS } = require('./seedData/accountMoves');
      const journals = await AccountJournal.findAll({ raw: true });
      const jByName = Object.fromEntries(journals.map((j) => [j.name, j]));

      // Build the invoice lines that produce a row's stored total.
      const linesFor = (untaxed, total, house, seedIdx) => {
        if (!untaxed && !total) return [];
        const p = PRODUCTS[seedIdx % PRODUCTS.length];
        const vat = Math.round((Number(total) - Number(untaxed)) * 100) / 100;
        const rate = Number(untaxed) ? Math.round((vat / Number(untaxed)) * 100) : 0;
        return [{
          kind: 'line',
          houseShipment: house || '',
          product: p[0],
          label: p[0].replace(/^\[\w+\]\s*/, ''),
          account: p[1],
          exRate: 1,
          amountQty: Number(untaxed),
          chargeCurrency: 'AED',
          analyticAccount: '',
          analyticTags: [],
          quantity: 1,
          price: Number(untaxed),
          discount: 0,
          taxes: rate ? `VAT ${rate}%` : 'VAT 0%',
          taxRate: rate,
          vatAmount: vat,
          subtotal: Number(untaxed),
        }];
      };

      // Posted records carry the double-entry rows the Journal Items tab shows.
      const itemsFor = (m, lines) => {
        if (m.state !== 'posted') return [];
        const rows = lines.map((l) => ({
          account: l.account, label: l.label, partner: m.partner,
          debit: 0, credit: Number(l.subtotal || 0), currency: m.currency,
        }));
        if (Number(m.amountTax || 0)) {
          rows.push({ account: '201005 VAT Payable', label: l0(lines), partner: m.partner,
            debit: 0, credit: Number(m.amountTax), currency: m.currency });
        }
        rows.push({ account: '101001 Accounts Receivable', label: m.name, partner: m.partner,
          debit: Number(m.amountTotal || 0), credit: 0, currency: m.currency });
        return rows;
      };
      const l0 = (lines) => (lines[0]?.taxes || 'VAT');

      const mk = (rows, moveType, journalName, prefix) => rows.map((r, i) => {
        const [partner, house, master, invDate, dueDate, cur, untaxed, total,
          invCur, totalInCur, paymentState, state, reversed] = r;
        const lines = linesFor(untaxed, total, house, i);
        const year = (invDate || '2026-01-01').slice(0, 4);
        const move = {
          name: state === 'draft' ? '/' : `${prefix}/${year}/${String(i + 1).padStart(5, '0')}`,
          moveType, state, paymentState,
          partner, partnerAddress: partner,
          invoiceDate: invDate || null,
          invoiceDateDue: dueDate || null,
          journal: journalName,
          journalId: jByName[journalName]?.id || null,
          currency: invCur || cur,
          companyCurrency: cur,
          amountUntaxed: untaxed, amountTax: Math.round((total - untaxed) * 100) / 100,
          amountTotal: total, amountTotalCurrency: totalInCur,
          amountResidual: paymentState === 'paid' ? 0 : total,
          addChargesFrom: house ? 'house' : null,
          chargeHouseShipments: house ? [house] : [],
          houseShipmentRefs: house ? [house] : [],
          masterShipmentRefs: master ? [master] : [],
          serviceJobRefs: /^(SJ|Service Job)/i.test(house || '') ? [house] : [],
          lines,
          reversedEntryName: reversed || null,
          ref: reversed ? `Reversal of: ${reversed}, None` : null,
          company: 'CargoFlo (Dubai)',
          followerCount: 1,
          activityLog: [{
            at: new Date(invDate || Date.now()).toISOString(),
            author: 'Anix Logistics PVT LTD', kind: 'log',
            body: moveType === 'out_refund' ? 'Credit Note Created' : 'Invoice Created',
            changes: [],
          }],
        };
        move.journalItems = itemsFor(move, lines);
        return move;
      });

      await AccountMove.bulkCreate([
        ...mk(INVOICES, 'out_invoice', 'Customer Invoices', 'INV'),
        ...mk(CREDIT_NOTES, 'out_refund', 'Customer Invoices', 'RINV'),
        ...mk(DEBIT_NOTES, 'out_debit', 'Customer Debit Note', 'BDN'),
      ], { individualHooks: false });
      console.log(`Seeded ${INVOICES.length + CREDIT_NOTES.length + DEBIT_NOTES.length} account moves.`);
    }

    // ── Accounting wave 4: payments, pro formas, products ──
    const { AccountPayment, ProFormaInvoice, Product } = require('../models');
    const wave4 = require('./seedData/accountingWave4');

    if ((await AccountPayment.count()) === 0) {
      const journals = await AccountJournal.findAll({ raw: true });
      // Bank journals are listed by their account number on the payments list.
      const jByRef = {};
      for (const j of journals) {
        if (j.bankAccNumber) jByRef[j.bankAccNumber] = j;
        jByRef[j.name] = jByRef[j.name] || j;
      }
      await AccountPayment.bulkCreate(wave4.PAYMENTS.map(
        ([date, name, journal, method, partner, invoices, amount, state]) => ({
          name,
          // Vendor payments carry a PBNK/BILL prefix in the demo; everything
          // else on this list is money coming in.
          paymentType: /^(PBNK|BILL|PAY-OUT)/.test(name) ? 'outbound' : 'inbound',
          paymentDate: date,
          journal,
          journalId: jByRef[journal]?.id || null,
          paymentMethod: method,
          partner,
          invoiceNumbers: invoices,
          amount,
          currency: 'AED',
          state,
          company: 'CargoFlo (Dubai)',
          followerCount: 1,
          activityLog: [{
            at: new Date(date).toISOString(), author: 'Anix Logistics PVT LTD',
            kind: 'log', body: 'Payment Created', changes: [],
          }],
        })
      ), { individualHooks: false });
      console.log(`Seeded ${wave4.PAYMENTS.length} account payments.`);
    }

    if ((await ProFormaInvoice.count()) === 0) {
      await ProFormaInvoice.bulkCreate(wave4.PRO_FORMAS.map(
        ([customer, name, serviceJob, house, taxes, total, currency, state]) => {
          const untaxed = Math.round((Number(total) - Number(taxes)) * 100) / 100;
          const rate = untaxed ? Math.round((Number(taxes) / untaxed) * 100) : 0;
          return {
            name, customer,
            serviceJobRefs: serviceJob ? [serviceJob] : [],
            houseShipmentRefs: house ? [house] : [],
            companyCurrency: 'AED',
            currency: currency || 'AED',
            taxes, total, state,
            lines: [{
              product: '[MCAG] Main Carriage',
              label: 'Main Carriage',
              houseShipment: house || '',
              quantity: 1,
              price: untaxed,
              taxes: rate ? `VAT ${rate}%` : 'VAT 0%',
              taxRate: rate,
              vatAmount: taxes,
              subtotal: untaxed,
            }],
            company: 'CargoFlo (Dubai)',
            followerCount: 1,
            activityLog: [{
              at: new Date('2026-01-01').toISOString(), author: 'Anix Logistics PVT LTD',
              kind: 'log', body: 'Pro Forma Invoice Created', changes: [],
            }],
          };
        }
      ), { individualHooks: false });
      console.log(`Seeded ${wave4.PRO_FORMAS.length} pro forma invoices.`);
    }

    if ((await Product.count()) === 0) {
      await Product.bulkCreate(wave4.PRODUCTS.map(
        ([ref, name, price, custTaxes, vendTaxes]) => ({
          internalReference: ref || null,
          name,
          salesPrice: price,
          cost: 0,
          customerTaxes: custTaxes,
          vendorTaxes: vendTaxes,
          canBeSold: true,
          canBePurchased: true,
          category: 'Services',
          uom: 'Units',
        })
      ), { individualHooks: false });
      console.log(`Seeded ${wave4.PRODUCTS.length} products.`);
    }

    // ── Accounting wave 6/8: assets and configuration lookup lists ──
    {
      const { AccountAsset, ConfigItem } = require('../models');

      if ((await AccountAsset.count()) === 0) {
        // [name, type, partner, original, acquired, duration, account]
        const ASSETS = [
          ['Office Fit-out Jebel Ali', 'purchase', 'GM-8: Goodrich Maritme', 120000, '2025-01-15', 60],
          ['Forklift FL-220', 'purchase', 'TL-3: Trident Logistics', 85000, '2025-04-01', 48],
          ['Warehouse Racking', 'purchase', 'ASSL-1: Aitken Spence Shipping Ltd', 240000, '2024-09-10', 120],
          ['Delivery Van DXB-4471', 'purchase', 'AV-2: Ankit Vijay', 96000, '2025-07-20', 60],
          ['Annual Insurance Premium', 'expense', 'ALPL-1: Anix Logistics PVT LTD', 36000, '2026-01-01', 12],
          ['Port Licence Fee 2026', 'expense', 'UPS-2: ULTRA POMPE SRL', 18000, '2026-01-01', 12],
          ['Prepaid Rent Q1-Q4', 'expense', 'B-26: Brandom', 48000, '2026-01-01', 12],
          ['Annual Freight Contract - Acme', 'sale', 'A-13: Ashish', 144000, '2026-01-01', 12],
          ['Retainer - Customer Portal Access', 'sale', 'CPA-1: Customer Portal Access', 60000, '2025-10-01', 24],
        ];
        const rows = [];
        for (const [name, assetType, partner, original, acquired, duration] of ASSETS) {
          const asset = AccountAsset.build({
            name, assetType, partner, original, bookValue: original,
            acquisitionDate: acquired, firstDepreciationDate: acquired,
            duration, periodicity: 'months', method: 'linear',
            account: assetType === 'purchase' ? '101010 Fixed Assets' : '501001 Cost of Services',
            journal: 'Miscellaneous Operations',
            state: 'running',
            company: 'CargoFlo (Dubai)',
          });
          const lines = asset.buildSchedule();
          // Recognise everything scheduled on or before today.
          const today = new Date().toISOString().slice(0, 10);
          const done = lines.filter((l) => l.date <= today);
          const depreciated = done.reduce((a, l) => a + Number(l.depreciation), 0);
          rows.push({
            ...asset.get({ plain: true }),
            depreciationLines: lines.map((l) => ({ ...l, posted: l.date <= today })),
            depreciated: Math.round(depreciated * 100) / 100,
            bookValue: Math.round((original - depreciated) * 100) / 100,
          });
        }
        await AccountAsset.bulkCreate(rows, { individualHooks: false });
        console.log(`Seeded ${rows.length} account assets.`);
      }

      // Each configuration leaf ships its own starting rows; top up by category
      // so adding a new leaf later does not require wiping the table.
      const { CONFIGS } = require('../services/configRegistry');
      for (const cfg of CONFIGS) {
        if (cfg.backing !== 'config_items' || !cfg.seed?.length) continue;
        const existing = await ConfigItem.count({ where: { category: cfg.category } });
        if (existing) continue;
        await ConfigItem.bulkCreate(
          cfg.seed.map((row, i) => ({ ...row, category: cfg.category, sequence: (i + 1) * 10 })),
          { individualHooks: false }
        );
      }
    }

    // ── Accounting wave 5: vendor bills, refunds, debit notes, payments ──
    {
      const { AccountMove, AccountPayment, VendorBill } = require('../models');
      const { BILLS, REFUNDS, VENDOR_DEBIT_NOTES, VENDOR_PAYMENTS } = require('./seedData/vendorMoves');
      const { moveAttributesFor } = require('../services/vendorBillBridge');
      const { Op } = require('sequelize');

      // Count only rows this block owns. Mirrored procurement bills are also
      // in_invoice, so counting the move type alone would skip the seed once a
      // single purchase order had been billed.
      const seededVendorMoves = await AccountMove.count({
        where: { moveType: { [Op.in]: ['in_invoice', 'in_refund', 'in_debit'] }, sourceBillId: null },
      });
      if (seededVendorMoves === 0) {
        const mkVendor = (rows, moveType, journal) => rows.map(
          ([vendor, ref, date, due, untaxed, total, paymentState, state, reversedOf]) => {
            const tax = Math.round((Number(total) - Number(untaxed)) * 100) / 100;
            const rate = untaxed ? Math.round((tax / Number(untaxed)) * 100) : 0;
            return {
              name: state === 'draft' ? '/' : ref,
              moveType, state, paymentState,
              partner: vendor, partnerAddress: vendor,
              invoiceDate: date, invoiceDateDue: due,
              journal,
              currency: 'AED', companyCurrency: 'AED',
              amountUntaxed: untaxed, amountTax: tax,
              amountTotal: total, amountTotalCurrency: total,
              amountResidual: paymentState === 'paid' ? 0 : total,
              lines: [{
                kind: 'line',
                product: '[MCAG] Main Carriage',
                label: 'Main Carriage',
                account: '501001 Cost of Services',
                quantity: 1, price: untaxed, discount: 0, exRate: 1,
                chargeCurrency: 'AED',
                taxes: rate ? `VAT ${rate}%` : 'VAT 0%',
                taxRate: rate, vatAmount: tax, subtotal: untaxed,
              }],
              // A refund reverses the original bill; a debit note just adds
              // charges against it, so only the refund reads as a reversal.
              reversedEntryName: moveType === 'in_refund' ? reversedOf || null : null,
              ref: reversedOf
                ? `${moveType === 'in_refund' ? 'Reversal of' : 'Against'}: ${reversedOf}`
                : null,
              company: 'CargoFlo (Dubai)',
              followerCount: 1,
              activityLog: [{
                at: new Date(date).toISOString(), author: 'Anix Logistics PVT LTD',
                kind: 'log', body: 'Vendor document created', changes: [],
              }],
            };
          }
        );

        await AccountMove.bulkCreate([
          ...mkVendor(BILLS, 'in_invoice', 'Vendor Bills'),
          ...mkVendor(REFUNDS, 'in_refund', 'Vendor Bills'),
          ...mkVendor(VENDOR_DEBIT_NOTES, 'in_debit', 'Vendor Bills'),
        ], { individualHooks: false });
        console.log(`Seeded ${BILLS.length + REFUNDS.length + VENDOR_DEBIT_NOTES.length} vendor moves.`);
      }

      if ((await AccountPayment.count({ where: { paymentType: 'outbound' } })) === 0) {
        await AccountPayment.bulkCreate(VENDOR_PAYMENTS.map(
          ([date, name, journal, method, partner, bills, amount, state]) => ({
            name, paymentType: 'outbound', paymentDate: date,
            journal, paymentMethod: method, partner,
            invoiceNumbers: bills, amount, currency: 'AED', state,
            company: 'CargoFlo (Dubai)', followerCount: 1,
            activityLog: [{
              at: new Date(date).toISOString(), author: 'Anix Logistics PVT LTD',
              kind: 'log', body: 'Payment Created', changes: [],
            }],
          })
        ), { individualHooks: false });
        console.log(`Seeded ${VENDOR_PAYMENTS.length} vendor payments.`);
      }

      // Bills raised from a purchase order live in vendor_bills. Mirror any that
      // have no accounting document yet, so Procurement's "Create Vendor Bill"
      // shows up under Accounting > Vendors > Bills instead of vanishing.
      const bills = await VendorBill.findAll();
      if (bills.length) {
        const mirrored = new Set(
          (await AccountMove.findAll({
            attributes: ['sourceBillId'],
            where: { sourceBillId: { [Op.ne]: null } },
            raw: true,
          })).map((r) => r.sourceBillId)
        );
        const missing = bills.filter((b) => !mirrored.has(b.id));
        if (missing.length) {
          await AccountMove.bulkCreate(
            missing.map((b) => moveAttributesFor(b, {
              activityLog: [{
                at: new Date(b.createdAt || Date.now()).toISOString(),
                author: 'Anix Logistics PVT LTD', kind: 'log',
                body: 'Vendor bill created from purchase order', changes: [],
              }],
            })),
            { individualHooks: false }
          );
          console.log(`Mirrored ${missing.length} procurement vendor bills into accounting.`);
        }
      }
    }

    // ── Point credit and debit notes at invoices that exist ──
    // The seeded notes carry the demo's own reference numbers, which were never
    // created here, so the smart buttons on an invoice counted nothing. Re-point
    // each note at a real invoice for the same partner where one exists.
    {
      const { AccountMove } = require('../models');
      const { Op } = require('sequelize');

      const notes = await AccountMove.findAll({
        where: { moveType: { [Op.in]: ['out_refund', 'out_debit', 'in_refund', 'in_debit'] } },
      });
      if (notes.length) {
        const invoices = await AccountMove.findAll({
          where: { moveType: { [Op.in]: ['out_invoice', 'in_invoice'] }, name: { [Op.ne]: '/' } },
          attributes: ['name', 'partner', 'moveType'],
          raw: true,
        });
        const existing = new Set(invoices.map((i) => i.name));
        // Group the candidates by partner so a note lands on that partner's own
        // invoice rather than an unrelated one.
        const byPartner = new Map();
        for (const inv of invoices) {
          const key = `${inv.partner}|${inv.moveType}`;
          if (!byPartner.has(key)) byPartner.set(key, []);
          byPartner.get(key).push(inv.name);
        }

        let repaired = 0;
        for (const note of notes) {
          if (note.reversedEntryName && existing.has(note.reversedEntryName)) continue;
          const wantType = note.moveType.startsWith('out_') ? 'out_invoice' : 'in_invoice';
          const candidates = byPartner.get(`${note.partner}|${wantType}`);
          if (!candidates?.length) continue;
          // Spread the notes across that partner's invoices rather than piling
          // them all onto the first one.
          const pick = candidates[repaired % candidates.length];
          await note.update({
            reversedEntryName: pick,
            ref: `${note.moveType.endsWith('_refund') ? 'Reversal of' : 'Against'}: ${pick}`,
          });
          repaired += 1;
        }
        if (repaired) console.log(`Re-pointed ${repaired} credit/debit notes at real invoices.`);
      }
    }

    // ── Link accounting partners to Organizations ──
    // Invoices, payments and pro formas store a partner as the display string
    // "A-13: Ashish" — customerCode, colon, name. Accounting's Customers and
    // Vendors menus are the Organization list filtered by party type, so every
    // partner that has been billed needs a real Organization behind it;
    // otherwise the menus under-report and a customer card cannot drill through
    // to its own invoices. Backfill the missing ones, then stamp the foreign
    // key on the accounting rows so the link works in both directions.
    {
      const { AccountMove, AccountPayment, ProFormaInvoice, Organization } = require('../models');
      const { Op } = require('sequelize');

      const partnerStrings = new Set();
      const collect = (rows, field) => rows.forEach((r) => {
        const v = (r[field] || '').trim();
        // "#Created by: …" is a system annotation, not a partner.
        if (v && !v.startsWith('#')) partnerStrings.add(v);
      });
      collect(await AccountMove.findAll({ attributes: ['partner'], raw: true }), 'partner');
      collect(await AccountPayment.findAll({ attributes: ['partner'], raw: true }), 'partner');
      collect(await ProFormaInvoice.findAll({ attributes: ['customer'], raw: true }), 'customer');

      // Split "CODE: Name" into its two halves. Names may themselves contain a
      // colon (an email, say), so only the first one separates.
      const parse = (s) => {
        const i = s.indexOf(':');
        if (i === -1) return { customerCode: null, name: s.trim() };
        return { customerCode: s.slice(0, i).trim(), name: s.slice(i + 1).trim() || s.slice(0, i).trim() };
      };

      const existing = await Organization.findAll({
        attributes: ['id', 'name', 'customerCode', 'partyTypes'], raw: true,
      });
      const byCode = new Map();
      const byName = new Map();
      for (const o of existing) {
        if (o.customerCode) byCode.set(o.customerCode.toLowerCase(), o);
        byName.set((o.name || '').toLowerCase(), o);
      }

      const created = [];
      for (const s of partnerStrings) {
        const { customerCode, name } = parse(s);
        const hit = (customerCode && byCode.get(customerCode.toLowerCase()))
          || byName.get(name.toLowerCase());
        if (hit) continue;
        created.push({ customerCode, name, partyTypes: ['Customer'] });
      }

      if (created.length) {
        const dubai = await Company.findOne({ where: { code: 'CF-DXB' } });
        const made = await Organization.bulkCreate(created.map((c) => ({
          ...c,
          // An emailish name is a person; anything else reads as a company,
          // which is what drives the avatar and icon on the kanban card.
          companyType: /@/.test(c.name) ? 'person' : 'company',
          // A partner already carrying invoices has cleared onboarding.
          kycStatus: 'kyc_done',
          company: dubai?.name || 'CargoFlo (Dubai)',
          currency: 'AED',
          isActive: true,
        })), { individualHooks: false, returning: true });
        for (const o of made) {
          if (o.customerCode) byCode.set(o.customerCode.toLowerCase(), o);
          byName.set((o.name || '').toLowerCase(), o);
        }
        console.log(`Backfilled ${made.length} organizations from accounting partners.`);
      }

      // Resolve a partner display string to an Organization id.
      const idFor = (s) => {
        if (!s || s.startsWith('#')) return null;
        const { customerCode, name } = parse(s.trim());
        const hit = (customerCode && byCode.get(customerCode.toLowerCase()))
          || byName.get(name.toLowerCase());
        return hit ? hit.id : null;
      };

      // Stamp the key on rows that are still missing it. Grouping by partner
      // keeps this to one UPDATE per distinct partner rather than per row.
      const stamp = async (Model, partnerField, fkField) => {
        const rows = await Model.findAll({
          attributes: [partnerField], where: { [fkField]: null }, group: [partnerField], raw: true,
        });
        let n = 0;
        for (const r of rows) {
          const id = idFor(r[partnerField]);
          if (!id) continue;
          const [count] = await Model.update(
            { [fkField]: id },
            { where: { [partnerField]: r[partnerField], [fkField]: null } },
          );
          n += count;
        }
        return n;
      };

      const linked = (await stamp(AccountMove, 'partner', 'partnerId'))
        + (await stamp(AccountPayment, 'partner', 'partnerId'))
        + (await stamp(ProFormaInvoice, 'customer', 'customerId'));
      if (linked) console.log(`Linked ${linked} accounting records to organizations.`);

      // A partner that has been invoiced is a customer, and one that has been
      // billed is a vendor — mirror that so the two menus filter correctly.
      const rank = async (Model, fkField, partyType, where = {}) => {
        const ids = (await Model.findAll({
          attributes: [fkField], where: { [fkField]: { [Op.ne]: null }, ...where },
          group: [fkField], raw: true,
        })).map((r) => r[fkField]);
        if (!ids.length) return;
        const orgs = await Organization.findAll({ where: { id: ids } });
        for (const o of orgs) {
          const types = Array.isArray(o.partyTypes) ? o.partyTypes : [];
          if (types.includes(partyType)) continue;
          await o.update({ partyTypes: [...types, partyType] });
        }
      };
      await rank(AccountMove, 'partnerId', 'Customer', {
        moveType: { [Op.in]: ['out_invoice', 'out_refund', 'out_debit'] },
      });
      await rank(AccountMove, 'partnerId', 'Vendor', {
        moveType: { [Op.in]: ['in_invoice', 'in_refund', 'in_debit'] },
      });
      await rank(AccountPayment, 'partnerId', 'Customer', { paymentType: 'inbound' });
      await rank(AccountPayment, 'partnerId', 'Vendor', { paymentType: 'outbound' });
      await rank(ProFormaInvoice, 'customerId', 'Customer');
    }

    // ── TMS requests ──
    const { TMSRequest } = require('../models');
    if ((await TMSRequest.count()) === 0) {
      const { ROWS, payloadFor, responseFor } = require('./seedData/tmsRequests');
      const { randomUUID } = require('crypto');
      await TMSRequest.bulkCreate(ROWS.map(([name, at, by]) => {
        const uuid = randomUUID();
        const started = new Date(at.replace(' ', 'T'));
        return {
          name,
          requestUuid: uuid,
          providerMessageType: null,
          requestDate: started,
          // The provider answered a few seconds later.
          requestCompleteDate: new Date(started.getTime() + 4000),
          resubmitUrl: null,
          requestedBy: by,
          providerStatus: 'Resource created successfully',
          status: 'success',
          resModel: 'house.shipment',
          reference: name,
          jsonPayload: payloadFor(name, started.toISOString()),
          requestResponse: responseFor(uuid),
          followerCount: 1,
          activityLog: [{
            at: started.toISOString(), author: by, kind: 'log',
            body: 'TMS Request created', changes: [],
          }],
        };
      }), { individualHooks: false });
      console.log(`Seeded ${ROWS.length} TMS requests.`);
    }

    // ── Access control: groups, ACL rows, and the admin's memberships ──
    const { PermissionGroup, ModelAccess, UserGroup } = require('../models');
    const { GROUPS, MODELS, ACL } = require('./seedData/accessControl');

    for (const [category, name, ownOnly] of GROUPS) {
      await PermissionGroup.findOrCreate({
        where: { category, name },
        defaults: { category, name, fullName: `${category} / ${name}`, ownDocumentsOnly: !!ownOnly },
      });
    }

    {
      // Topped up per model+group rather than seeded once, so a later wave that
      // adds a model gets its rules on an existing database too.
      const groups = await PermissionGroup.findAll({ raw: true });
      const byFullName = Object.fromEntries(groups.map((g) => [g.fullName, g.id]));
      const labelByModel = Object.fromEntries(MODELS);
      let added = 0;
      for (const [model, entries] of Object.entries(ACL)) {
        for (const [fullName, perms] of entries) {
          const groupId = byFullName[fullName];
          if (!groupId) continue;
          const [, created] = await ModelAccess.findOrCreate({
            where: { model, groupId },
            defaults: {
              model,
              label: labelByModel[model] || model,
              groupId,
              permRead: perms[0] === '1',
              permWrite: perms[1] === '1',
              permCreate: perms[2] === '1',
              permDelete: perms[3] === '1',
            },
          });
          if (created) added += 1;
        }
      }
      if (added) console.log(`Seeded ${added} model access rules.`);
    }

    // Holding "Administration / Settings" is what makes someone a superuser, so
    // every existing admin must be granted it or the new ACL would lock them
    // out of their own system.
    const settingsGroup = await PermissionGroup.findOne({ where: { category: 'Administration', name: 'Settings' } });
    if (settingsGroup) {
      const admins = await User.findAll({ where: { role: 'admin' }, attributes: ['id'], raw: true });
      for (const a of admins) {
        await UserGroup.findOrCreate({
          where: { userId: a.id, groupId: settingsGroup.id },
          defaults: { userId: a.id, groupId: settingsGroup.id },
        });
      }
      if (admins.length) console.log(`Granted Administration / Settings to ${admins.length} admin user(s).`);
    }

    const { FreightBooking } = require('../models');
    if ((await FreightBooking.count()) === 0) {
      const { decode, cargoFor, flightFor } = require('./seedData/freightBookings');
      const rows = decode();
      // Cancelled/failed AIR bookings keep the carrier's reason text.
      const FAIL_REASON = 'Rate no longer available at the requested price.';
      await FreightBooking.bulkCreate(rows.map((b) => {
        const air = b.tc === 'AIR';
        const confirmed = b.as === 'booking_confirmed';
        const cargo = cargoFor(b.n);
        const log = [{
          at: new Date(b.dd || b.etd || Date.now()).toISOString(),
          author: b.u || 'Administrator',
          kind: 'log', body: 'Freight Booking Request created', changes: [],
        }];
        if (air && b.as !== 'created') {
          log.unshift({
            at: new Date(b.dd || Date.now()).toISOString(),
            author: b.u || 'Administrator', kind: 'log', body: '',
            changes: [{ field: 'Air Status', from: 'Created', to: b.as.replace(/_/g, ' ') }],
          });
        }
        return {
          bookingReference: b.n,
          bookingNumber: b.bn || null,
          transportCode: b.tc,
          modeType: b.tc === 'SEA' ? 'sea' : 'air',
          status: b.st,
          airStatus: b.as,
          providerStatus: b.ps || null,
          carrierIdentifier: b.ca === 'Buyco' ? 'BYCO' : null,
          subscriptionStatus: 'active',
          paymentTerms: b.pt || null,
          incoterm: b.ic || null,
          company: b.co || null,
          transportMode: b.tc === 'SEA' ? '[SEA] Sea Freight' : '[AIR] Air Freight',
          carrier: b.ca || null,
          cargoType: b.ct || null,
          assignedTo: b.u || null,
          assignedToVerified: true,
          trackingNumber: b.awb || null,
          airline: b.al || null,
          flightNo: b.fn || null,
          serviceMode: b.sm || null,
          shipmentType: b.sty || null,
          commodityType: cargo[0]?.commodity?.replace(/^\[\w+\]\s*/, '') || null,
          originPort: b.op || null,
          destinationPort: b.dp || null,
          departureDate: b.dd || null,
          etdTime: b.etd || null,
          etaTime: b.eta || null,
          client: b.cl || null,
          clientAddress: b.cl || null,
          shipper: b.sh || null,
          shipperAddress: b.sh || null,
          consignee: b.cn || null,
          consigneeAddress: b.cn || null,
          cargoLines: cargo,
          flightLines: confirmed ? flightFor(b.n, b.al, b.fn, b.op || '', b.dp || '') : [],
          failBookingReason: b.as === 'booking_failed' ? FAIL_REASON : null,
          failBookingError: b.as === 'booking_failed' ? 'CARRIER_RATE_EXPIRED' : null,
          followerCount: 1,
          activityLog: log,
        };
      }), { individualHooks: false });
      console.log(`Seeded ${rows.length} freight bookings.`);
    }

    // MasterDataItem is destructured again further down, so alias it here.
    const { CalendarEvent, MasterDataItem: CalendarPicklist } = require('../models');
    if ((await CalendarEvent.count()) === 0) {
      await CalendarEvent.bulkCreate(CALENDAR_EVENTS.map(
        ([name, start, duration, organizer, attendees, description, resModel]) => {
          const startAt = new Date(start.replace(' ', 'T') + ':00');
          return {
            name,
            start: startAt,
            stop: new Date(startAt.getTime() + duration * 3600000),
            duration,
            allday: false,
            organizer,
            attendees: attendees.map((label) => ({
              name: label, email: '', status: 'needsAction',
            })),
            description: description || null,
            privacy: 'public',
            showAs: 'busy',
            recurrency: false,
            resModel: resModel || null,
            resName: resModel ? name : null,
            followerCount: 1,
            activityLog: [{
              at: startAt.toISOString(),
              author: organizer,
              kind: 'log', body: 'Calendar Event created', changes: [],
            }],
          };
        }
      ), { individualHooks: false });
      console.log(`Seeded ${CALENDAR_EVENTS.length} calendar events.`);
    }

    // Reminders and Tags are picklists on the Meeting form.
    for (const label of CALENDAR_ALARMS) {
      await CalendarPicklist.findOrCreate({
        where: { category: 'calendar-alarms', name: label },
        defaults: { category: 'calendar-alarms', name: label, isActive: true },
      });
    }
    for (const label of CALENDAR_TAGS) {
      await CalendarPicklist.findOrCreate({
        where: { category: 'calendar-tags', name: label },
        defaults: { category: 'calendar-tags', name: label, isActive: true },
      });
    }

    const { PurchaseOrder } = require('../models');
    // Insert by number so re-seeding tops up new demo rows without wiping POs
    // the user has since raised.
    const existingPOs = new Set(
      (await PurchaseOrder.findAll({ attributes: ['poNumber'], raw: true })).map((p) => p.poNumber)
    );
    const missingPOs = PURCHASE_ORDERS.filter(([poNumber]) => !existingPOs.has(poNumber));
    if (missingPOs.length) {
      await PurchaseOrder.bulkCreate(missingPOs.map(
        ([poNumber, poDate, vendor, shipmentNo, state, priority, amountTotal, billCount]) => {
          const extra = PO_DETAILS[poNumber] || {};
          const log = [{
            at: new Date(poDate).toISOString(),
            author: extra.createdByName || 'Administrator',
            kind: 'log', body: 'Purchase Order created', changes: [],
          }];
          if (state === 'approved') {
            log.unshift({
              at: new Date(poDate).toISOString(),
              author: extra.approvedByName || 'Administrator',
              kind: 'log', body: 'Purchase Order approved', changes: [],
            });
          }
          return {
            poNumber, poDate, vendor, shipmentNo, state, priority, amountTotal, billCount,
            currency: 'AED',
            createdByName: 'Administrator',
            approvedByName: state === 'approved' ? 'Administrator' : null,
            purchaseApprover: 'Administrator',
            approvedDate: state === 'approved' ? String(poDate).slice(0, 10) : null,
            documentCount: 0,
            cancelReason: state === 'cancel' ? 'Duplicate Entry' : null,
            cancelRemark: state === 'cancel' ? 'Raised twice against the same shipment.' : null,
            activityLog: log,
            ...extra,
          };
        }
      ), { individualHooks: false });
      console.log(`Seeded ${missingPOs.length} purchase orders.`);
    }

    // The Bills stat button has to drill into something, so give every PO the
    // demo shows a bill against an actual posted vendor bill.
    const { VendorBill } = require('../models');
    const { Op: SqOp } = require('sequelize');
    const billedPOs = await PurchaseOrder.findAll({ where: { billCount: { [SqOp.gt]: 0 } } });
    for (const po of billedPOs) {
      const already = await VendorBill.count({ where: { purchaseOrderId: po.id } });
      if (already) continue;
      const lines = Array.isArray(po.chargeLines) ? po.chargeLines : [];
      await VendorBill.create({
        purchaseOrderId: po.id,
        vendorName: po.vendor,
        billDate: new Date(po.poDate).toISOString().slice(0, 10),
        currency: po.currency || 'AED',
        subtotal: po.amountTotal,
        totalAmount: po.amountTotal,
        status: 'posted',
        notes: `Generated from purchase order ${po.poNumber}`,
        items: lines.map((l) => ({
          description: l.product,
          quantity: Number(l.noOfUnit || 0),
          unitPrice: Number(l.amountPerUnit || 0),
          amount: Number(l.orderCurrencyTotalAmount || l.amount || 0),
          category: 'purchase',
        })),
      });
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
    // This one catch covers every seed and migration step, so a single throw
    // silently skips all the later ones. Logging only the message has hidden
    // real failures more than once — a ReferenceError here looks identical to
    // "nothing to do" in a log full of SQL. Make it impossible to miss.
    console.error('\n=============================================');
    console.error('SEED/MIGRATION ABORTED — later steps did NOT run');
    console.error(error.stack || error.message);
    console.error('=============================================\n');
  }
};

module.exports = { sequelize, connectDB };
