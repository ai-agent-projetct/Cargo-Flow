require('dotenv').config();
const { connectDB } = require('./database');
const {
  User, Company, Customer, Carrier, Port,
  Shipment, Quotation, Invoice, InvoiceItem,
  Rate, Job, TrackingEvent, Schedule, Notification,
  FFJob, ServiceJob, CreditNote, VendorBill, Opportunity, FreightBooking, Event,
} = require('../models');

const seedData = async () => {
  await connectDB();

  console.log('Seeding database...');

  // 1. Company
  const [company] = await Company.findOrCreate({
    where: { code: 'CF001' },
    defaults: {
      name: 'CargoFlo Logistics Ltd',
      code: 'CF001',
      type: 'freight_forwarder',
      address: '123 Harbor Way, Suite 500',
      city: 'Dubai',
      country: 'UAE',
      phone: '+971-4-123-4567',
      email: 'info@cargoflo.com',
      website: 'https://cargoflo.com',
      currency: 'USD',
    },
  });

  // 2. Users
  const [admin] = await User.findOrCreate({
    where: { email: 'admin@cargoflo.com' },
    defaults: {
      name: 'Admin User',
      email: 'admin@cargoflo.com',
      password: 'Admin@123',
      role: 'admin',
      companyId: company.id,
      phone: '+971-50-111-1111',
      status: 'active',
    },
  });

  const [manager] = await User.findOrCreate({
    where: { email: 'manager@cargoflo.com' },
    defaults: {
      name: 'Sarah Manager',
      email: 'manager@cargoflo.com',
      password: 'Manager@123',
      role: 'manager',
      companyId: company.id,
      phone: '+971-50-222-2222',
      status: 'active',
    },
  });

  const [user1] = await User.findOrCreate({
    where: { email: 'john@cargoflo.com' },
    defaults: {
      name: 'John Operations',
      email: 'john@cargoflo.com',
      password: 'User@123',
      role: 'user',
      companyId: company.id,
      phone: '+971-50-333-3333',
      status: 'active',
    },
  });

  console.log('Users seeded');

  // 3. Ports
  const portsData = [
    { name: 'Port of Shanghai', code: 'CNSHA', type: 'sea', city: 'Shanghai', country: 'China', countryCode: 'CN', latitude: 31.2304, longitude: 121.4737 },
    { name: 'Port of Singapore', code: 'SGSIN', type: 'sea', city: 'Singapore', country: 'Singapore', countryCode: 'SG', latitude: 1.3521, longitude: 103.8198 },
    { name: 'Port of Dubai (Jebel Ali)', code: 'AEJEA', type: 'sea', city: 'Dubai', country: 'UAE', countryCode: 'AE', latitude: 25.0110, longitude: 55.0676 },
    { name: 'Port of Rotterdam', code: 'NLRTM', type: 'sea', city: 'Rotterdam', country: 'Netherlands', countryCode: 'NL', latitude: 51.9225, longitude: 4.4792 },
    { name: 'Port of Los Angeles', code: 'USLAX', type: 'sea', city: 'Los Angeles', country: 'USA', countryCode: 'US', latitude: 33.7320, longitude: -118.2710 },
    { name: 'Port of Hamburg', code: 'DEHAM', type: 'sea', city: 'Hamburg', country: 'Germany', countryCode: 'DE', latitude: 53.5753, longitude: 9.9540 },
    { name: 'Dubai International Airport', code: 'DXB', type: 'air', city: 'Dubai', country: 'UAE', countryCode: 'AE', latitude: 25.2532, longitude: 55.3657 },
    { name: 'Shanghai Pudong International Airport', code: 'PVG', type: 'air', city: 'Shanghai', country: 'China', countryCode: 'CN', latitude: 31.1443, longitude: 121.8083 },
    { name: 'London Heathrow Airport', code: 'LHR', type: 'air', city: 'London', country: 'UK', countryCode: 'GB', latitude: 51.4775, longitude: -0.4614 },
    { name: 'Port Klang', code: 'MYPKG', type: 'sea', city: 'Klang', country: 'Malaysia', countryCode: 'MY', latitude: 3.0319, longitude: 101.3888 },
    { name: 'Port of Colombo', code: 'LKCMB', type: 'sea', city: 'Colombo', country: 'Sri Lanka', countryCode: 'LK', latitude: 6.9271, longitude: 79.8612 },
    { name: 'Nhava Sheva (JNPT)', code: 'INNSA', type: 'sea', city: 'Mumbai', country: 'India', countryCode: 'IN', latitude: 18.9481, longitude: 72.9375 },
  ];

  const ports = {};
  for (const p of portsData) {
    const [port] = await Port.findOrCreate({ where: { code: p.code }, defaults: p });
    ports[p.code] = port;
  }
  console.log('Ports seeded');

  // 4. Carriers
  const carriersData = [
    { name: 'Maersk Line', code: 'MAEU', type: 'shipping_line', scac: 'MAEU', country: 'Denmark', website: 'https://maersk.com', trackingUrl: 'https://maersk.com/tracking', status: 'active' },
    { name: 'MSC (Mediterranean Shipping Company)', code: 'MSCU', type: 'shipping_line', scac: 'MSCU', country: 'Switzerland', website: 'https://msc.com', status: 'active' },
    { name: 'CMA CGM', code: 'CMDU', type: 'shipping_line', scac: 'CMDU', country: 'France', website: 'https://cmacgm.com', status: 'active' },
    { name: 'Emirates SkyCargo', code: 'EK', type: 'airline', iataCode: 'EK', country: 'UAE', website: 'https://skycargo.com', status: 'active' },
    { name: 'Qatar Airways Cargo', code: 'QR', type: 'airline', iataCode: 'QR', country: 'Qatar', website: 'https://qrcargo.com', status: 'active' },
    { name: 'DHL Freight', code: 'DHLF', type: 'trucking', country: 'Germany', website: 'https://dhlfreight.com', status: 'active' },
    { name: 'Evergreen Marine', code: 'EGLV', type: 'shipping_line', scac: 'EGLV', country: 'Taiwan', website: 'https://evergreen-marine.com', status: 'active' },
  ];

  const carriers = {};
  for (const c of carriersData) {
    const [carrier] = await Carrier.findOrCreate({ where: { code: c.code }, defaults: c });
    carriers[c.code] = carrier;
  }
  console.log('Carriers seeded');

  // 5. Customers
  const customersData = [
    { companyName: 'Global Trade Corp', contactName: 'Michael Chen', type: 'shipper', email: 'mchen@globaltrade.com', phone: '+86-21-5555-0001', country: 'China', city: 'Shanghai', status: 'active', assignedTo: user1.id },
    { companyName: 'Euro Imports BV', contactName: 'Hans Mueller', type: 'consignee', email: 'hans@euroimports.nl', phone: '+31-10-5555-0002', country: 'Netherlands', city: 'Rotterdam', status: 'active', assignedTo: user1.id },
    { companyName: 'Dubai Distributors LLC', contactName: 'Ahmed Al-Rashid', type: 'agent', email: 'ahmed@dubaidist.ae', phone: '+971-4-555-0003', country: 'UAE', city: 'Dubai', status: 'active', assignedTo: manager.id },
    { companyName: 'Pacific Rim Exports', contactName: 'Kenji Tanaka', type: 'shipper', email: 'ktanaka@pacrimex.jp', phone: '+81-3-5555-0004', country: 'Japan', city: 'Tokyo', status: 'active', assignedTo: user1.id },
    { companyName: 'Mumbai Cargo Solutions', contactName: 'Priya Sharma', type: 'broker', email: 'psharma@mumbaicarko.in', phone: '+91-22-5555-0005', country: 'India', city: 'Mumbai', status: 'active', assignedTo: manager.id },
    { companyName: 'Tech Components Inc', contactName: 'Emily Johnson', type: 'shipper', email: 'ejohnson@techcomp.com', phone: '+1-213-555-0006', country: 'USA', city: 'Los Angeles', status: 'active' },
    { companyName: 'Horizon Retail Group', contactName: 'Carlos Rivera', type: 'consignee', email: 'crivera@horizonretail.com', phone: '+52-55-5555-0007', country: 'Mexico', city: 'Mexico City', status: 'lead' },
  ];

  const customers = [];
  for (const c of customersData) {
    const [customer] = await Customer.findOrCreate({ where: { email: c.email }, defaults: c });
    customers.push(customer);
  }
  console.log('Customers seeded');

  // 6. Rates
  const ratesData = [
    {
      name: 'Shanghai to Dubai FCL 20GP',
      carrierId: carriers['MAEU'].id,
      originPortId: ports['CNSHA'].id,
      destinationPortId: ports['AEJEA'].id,
      mode: 'sea',
      shipmentType: 'FCL',
      containerType: '20GP',
      freightRate: 850.00,
      currency: 'USD',
      rateUnit: 'per_container',
      transitDays: 14,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2025-12-31'),
      status: 'active',
      createdBy: admin.id,
    },
    {
      name: 'Shanghai to Rotterdam FCL 40HC',
      carrierId: carriers['MSCU'].id,
      originPortId: ports['CNSHA'].id,
      destinationPortId: ports['NLRTM'].id,
      mode: 'sea',
      shipmentType: 'FCL',
      containerType: '40HC',
      freightRate: 1950.00,
      currency: 'USD',
      rateUnit: 'per_container',
      transitDays: 28,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2025-12-31'),
      status: 'active',
      createdBy: admin.id,
    },
    {
      name: 'Dubai to London Air Freight',
      carrierId: carriers['EK'].id,
      originPortId: ports['DXB'].id,
      destinationPortId: ports['LHR'].id,
      mode: 'air',
      shipmentType: 'Air Freight',
      freightRate: 2.50,
      currency: 'USD',
      rateUnit: 'per_kg',
      transitDays: 2,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2025-12-31'),
      status: 'active',
      createdBy: admin.id,
    },
    {
      name: 'Singapore to LA LCL',
      carrierId: carriers['EGLV'].id,
      originPortId: ports['SGSIN'].id,
      destinationPortId: ports['USLAX'].id,
      mode: 'sea',
      shipmentType: 'LCL',
      freightRate: 45.00,
      currency: 'USD',
      rateUnit: 'per_cbm',
      transitDays: 18,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2025-12-31'),
      status: 'active',
      createdBy: admin.id,
    },
  ];

  for (const r of ratesData) {
    await Rate.findOrCreate({ where: { name: r.name, carrierId: r.carrierId }, defaults: r });
  }
  console.log('Rates seeded');

  // 7. Schedules
  const schedulesData = [
    {
      carrierId: carriers['MAEU'].id,
      originPortId: ports['CNSHA'].id,
      destinationPortId: ports['AEJEA'].id,
      mode: 'sea',
      vesselName: 'Maersk Edinburgh',
      voyageNumber: 'ME2401W',
      departureDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      arrivalDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
      cutoffDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      transitDays: 14,
      status: 'scheduled',
      availableCapacity: 500,
      capacityUnit: 'TEU',
    },
    {
      carrierId: carriers['MSCU'].id,
      originPortId: ports['SGSIN'].id,
      destinationPortId: ports['NLRTM'].id,
      mode: 'sea',
      vesselName: 'MSC Maxima',
      voyageNumber: 'MM2401E',
      departureDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      arrivalDate: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000),
      transitDays: 28,
      status: 'scheduled',
      availableCapacity: 800,
      capacityUnit: 'TEU',
    },
    {
      carrierId: carriers['EK'].id,
      originPortId: ports['DXB'].id,
      destinationPortId: ports['LHR'].id,
      mode: 'air',
      flightNumber: 'EK9201',
      departureDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      arrivalDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000),
      transitDays: 1,
      status: 'scheduled',
      availableCapacity: 15000,
      capacityUnit: 'kg',
    },
  ];

  for (const s of schedulesData) {
    await Schedule.create(s).catch(() => {}); // Skip if already exists
  }
  console.log('Schedules seeded');

  // 8. Quotations
  const quotationsData = [
    {
      customerId: customers[0].id,
      createdBy: user1.id,
      status: 'sent',
      mode: 'sea',
      shipmentType: 'FCL',
      originPortId: ports['CNSHA'].id,
      destinationPortId: ports['AEJEA'].id,
      originCity: 'Shanghai',
      destinationCity: 'Dubai',
      originCountry: 'China',
      destinationCountry: 'UAE',
      carrierId: carriers['MAEU'].id,
      incoterms: 'FOB',
      commodity: 'Electronic Components',
      hsCode: '8542.31',
      cargoWeight: 5000,
      cargoVolume: 33.2,
      containerCount: 1,
      containerType: '20GP',
      freightCharges: 850,
      originCharges: 150,
      destinationCharges: 200,
      customsCharges: 300,
      insuranceCharges: 100,
      totalAmount: 1600,
      currency: 'USD',
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      estimatedTransitDays: 14,
    },
    {
      customerId: customers[3].id,
      createdBy: manager.id,
      status: 'approved',
      approvedBy: admin.id,
      approvedAt: new Date(),
      mode: 'air',
      shipmentType: 'Air Freight',
      originPortId: ports['PVG'].id,
      destinationPortId: ports['DXB'].id,
      originCity: 'Shanghai',
      destinationCity: 'Dubai',
      originCountry: 'China',
      destinationCountry: 'UAE',
      carrierId: carriers['EK'].id,
      incoterms: 'CIF',
      commodity: 'Luxury Watches',
      cargoWeight: 500,
      cargoVolume: 2.5,
      freightCharges: 1250,
      originCharges: 200,
      destinationCharges: 150,
      customsCharges: 500,
      insuranceCharges: 400,
      totalAmount: 2500,
      currency: 'USD',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedTransitDays: 2,
    },
    {
      customerId: customers[1].id,
      createdBy: user1.id,
      status: 'draft',
      mode: 'sea',
      shipmentType: 'LCL',
      originPortId: ports['SGSIN'].id,
      destinationPortId: ports['NLRTM'].id,
      originCity: 'Singapore',
      destinationCity: 'Rotterdam',
      originCountry: 'Singapore',
      destinationCountry: 'Netherlands',
      incoterms: 'EXW',
      commodity: 'Industrial Equipment',
      cargoWeight: 2000,
      cargoVolume: 15,
      freightCharges: 675,
      originCharges: 100,
      destinationCharges: 180,
      totalAmount: 955,
      currency: 'USD',
      validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      estimatedTransitDays: 28,
    },
  ];

  const quotations = [];
  for (const q of quotationsData) {
    const quot = await Quotation.create(q);
    quotations.push(quot);
  }
  console.log('Quotations seeded');

  // 9. Shipments
  const shipmentsData = [
    {
      customerId: customers[0].id,
      shipperId: customers[0].id,
      consigneeId: customers[2].id,
      createdBy: user1.id,
      assignedTo: user1.id,
      status: 'in_transit',
      mode: 'sea',
      shipmentType: 'FCL',
      carrierId: carriers['MAEU'].id,
      vesselName: 'Maersk Edinburgh',
      voyageNumber: 'ME2401W',
      masterBL: 'MAEU240100001',
      houseBL: 'CF240100001',
      originPortId: ports['CNSHA'].id,
      destinationPortId: ports['AEJEA'].id,
      incoterms: 'FOB',
      commodity: 'Electronic Components',
      cargoWeight: 18000,
      cargoVolume: 33.2,
      containerCount: 1,
      containerType: '20GP',
      estimatedDeparture: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      actualDeparture: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      estimatedArrival: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      currentLocation: 'Arabian Sea',
      currency: 'USD',
    },
    {
      customerId: customers[4].id,
      shipperId: customers[4].id,
      consigneeId: customers[1].id,
      createdBy: manager.id,
      assignedTo: user1.id,
      status: 'customs_clearance',
      mode: 'air',
      shipmentType: 'Air Freight',
      carrierId: carriers['EK'].id,
      flightNumber: 'EK9201',
      masterBL: 'EK24020001',
      originPortId: ports['DXB'].id,
      destinationPortId: ports['LHR'].id,
      incoterms: 'DDP',
      commodity: 'Pharmaceuticals',
      cargoWeight: 850,
      cargoVolume: 4.2,
      numberOfPackages: 45,
      estimatedDeparture: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      actualDeparture: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      estimatedArrival: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      actualArrival: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      customsStatus: 'in_progress',
      currentLocation: 'London Heathrow Customs',
      currency: 'USD',
    },
    {
      customerId: customers[2].id,
      shipperId: customers[5].id,
      consigneeId: customers[2].id,
      createdBy: admin.id,
      status: 'delivered',
      mode: 'sea',
      shipmentType: 'LCL',
      carrierId: carriers['EGLV'].id,
      masterBL: 'EGLV240300001',
      originPortId: ports['USLAX'].id,
      destinationPortId: ports['AEJEA'].id,
      incoterms: 'CIF',
      commodity: 'Auto Parts',
      cargoWeight: 3500,
      cargoVolume: 22,
      estimatedDeparture: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      actualDeparture: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      estimatedArrival: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      actualArrival: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      customsStatus: 'cleared',
      currency: 'USD',
    },
  ];

  const shipments = [];
  for (const s of shipmentsData) {
    const shipment = await Shipment.create(s);
    shipments.push(shipment);
  }
  console.log('Shipments seeded');

  // 10. Tracking Events
  if (shipments[0]) {
    await TrackingEvent.create({
      shipmentId: shipments[0].id,
      eventType: 'booking_confirmed',
      status: 'Booking Confirmed',
      location: 'Shanghai',
      eventDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      description: 'Booking confirmed with Maersk Line',
      isPublic: true,
      createdBy: user1.id,
    });
    await TrackingEvent.create({
      shipmentId: shipments[0].id,
      eventType: 'cargo_received',
      status: 'Cargo Received at Port',
      location: 'Shanghai, China',
      portId: ports['CNSHA'].id,
      eventDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      description: 'Cargo received at Shanghai port terminal',
      isPublic: true,
      createdBy: user1.id,
    });
    await TrackingEvent.create({
      shipmentId: shipments[0].id,
      eventType: 'loaded_on_vessel',
      status: 'Loaded on Vessel',
      location: 'Shanghai, China',
      portId: ports['CNSHA'].id,
      vesselName: 'Maersk Edinburgh',
      voyageNumber: 'ME2401W',
      eventDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      description: 'Cargo loaded on vessel Maersk Edinburgh, Voyage ME2401W',
      isPublic: true,
      createdBy: user1.id,
    });
    await TrackingEvent.create({
      shipmentId: shipments[0].id,
      eventType: 'departed',
      status: 'Vessel Departed',
      location: 'Shanghai, China',
      eventDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      description: 'Vessel departed from Port of Shanghai',
      isPublic: true,
      createdBy: user1.id,
    });
  }
  console.log('Tracking events seeded');

  // 11. Invoices
  if (shipments[2]) {
    const invoice = await Invoice.create({
      customerId: customers[2].id,
      shipmentId: shipments[2].id,
      createdBy: manager.id,
      status: 'paid',
      type: 'invoice',
      issueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 4500,
      taxRate: 5,
      taxAmount: 225,
      discountAmount: 0,
      totalAmount: 4725,
      paidAmount: 4725,
      balanceAmount: 0,
      paymentDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      paymentMethod: 'Wire Transfer',
      paymentReference: 'WT-2024-0001',
    });

    await InvoiceItem.bulkCreate([
      { invoiceId: invoice.id, description: 'Ocean Freight (LCL) - LAX to AE', category: 'freight', quantity: 22, unit: 'cbm', unitPrice: 45, amount: 990, sortOrder: 0 },
      { invoiceId: invoice.id, description: 'Origin Handling (Los Angeles)', category: 'origin_charges', quantity: 1, unit: 'lot', unitPrice: 350, amount: 350, sortOrder: 1 },
      { invoiceId: invoice.id, description: 'Destination Handling (Dubai)', category: 'destination_charges', quantity: 1, unit: 'lot', unitPrice: 420, amount: 420, sortOrder: 2 },
      { invoiceId: invoice.id, description: 'Customs Clearance', category: 'customs', quantity: 1, unit: 'lot', unitPrice: 800, amount: 800, sortOrder: 3 },
      { invoiceId: invoice.id, description: 'Marine Insurance', category: 'insurance', quantity: 1, unit: 'lot', unitPrice: 450, amount: 450, sortOrder: 4 },
      { invoiceId: invoice.id, description: 'Documentation Fee', category: 'other', quantity: 1, unit: 'lot', unitPrice: 250, amount: 250, sortOrder: 5 },
      { invoiceId: invoice.id, description: 'Fuel Surcharge (BAF)', category: 'surcharge', quantity: 1, unit: 'lot', unitPrice: 1240, amount: 1240, sortOrder: 6 },
    ]);
  }

  // Pending invoice for first shipment
  if (shipments[0]) {
    const invoice2 = await Invoice.create({
      customerId: customers[0].id,
      shipmentId: shipments[0].id,
      createdBy: user1.id,
      status: 'sent',
      type: 'invoice',
      issueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 2800,
      taxRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 2800,
      paidAmount: 0,
      balanceAmount: 2800,
    });

    await InvoiceItem.bulkCreate([
      { invoiceId: invoice2.id, description: 'Ocean Freight FCL 20GP - SHA to AE', category: 'freight', quantity: 1, unit: 'container', unitPrice: 850, amount: 850, sortOrder: 0 },
      { invoiceId: invoice2.id, description: 'Origin THC (Shanghai)', category: 'origin_charges', quantity: 1, unit: 'lot', unitPrice: 280, amount: 280, sortOrder: 1 },
      { invoiceId: invoice2.id, description: 'Destination THC (Dubai)', category: 'destination_charges', quantity: 1, unit: 'lot', unitPrice: 320, amount: 320, sortOrder: 2 },
      { invoiceId: invoice2.id, description: 'Bill of Lading Fee', category: 'other', quantity: 1, unit: 'lot', unitPrice: 120, amount: 120, sortOrder: 3 },
      { invoiceId: invoice2.id, description: 'Peak Season Surcharge (PSS)', category: 'surcharge', quantity: 1, unit: 'lot', unitPrice: 500, amount: 500, sortOrder: 4 },
      { invoiceId: invoice2.id, description: 'Bunker Adjustment Factor (BAF)', category: 'surcharge', quantity: 1, unit: 'lot', unitPrice: 730, amount: 730, sortOrder: 5 },
    ]);
  }
  console.log('Invoices seeded');

  // 12. Jobs
  await Job.create({
    shipmentId: shipments[0] ? shipments[0].id : null,
    customerId: customers[0].id,
    title: 'Prepare Export Documentation',
    description: 'Prepare all required export documents including Commercial Invoice, Packing List, and Bill of Lading',
    type: 'documentation',
    status: 'completed',
    priority: 'high',
    assignedTo: user1.id,
    createdBy: manager.id,
    dueDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
  });

  await Job.create({
    shipmentId: shipments[1] ? shipments[1].id : null,
    customerId: customers[4].id,
    title: 'UK Customs Clearance',
    description: 'Manage customs clearance process at London Heathrow for pharmaceutical shipment',
    type: 'customs_clearance',
    status: 'in_progress',
    priority: 'urgent',
    assignedTo: user1.id,
    createdBy: manager.id,
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  });

  await Job.create({
    customerId: customers[3].id,
    title: 'Quotation Follow-up - Pacific Rim Exports',
    description: 'Follow up with Pacific Rim Exports on pending air freight quotation approval',
    type: 'other',
    status: 'pending',
    priority: 'medium',
    assignedTo: manager.id,
    createdBy: admin.id,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });
  console.log('Jobs seeded');

  // 13. Notifications
  await Notification.create({
    userId: user1.id,
    type: 'shipment_update',
    title: 'Shipment In Transit',
    message: `Shipment ${shipments[0]?.shipmentNumber || 'CF-2024-001'} is currently in transit - ETA: ${new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toDateString()}`,
    isRead: false,
    referenceType: 'shipment',
    priority: 'medium',
  });

  await Notification.create({
    userId: manager.id,
    type: 'invoice_due',
    title: 'Invoice Payment Due',
    message: 'Invoice for Dubai Distributors LLC is due in 25 days',
    isRead: false,
    referenceType: 'invoice',
    priority: 'high',
  });

  await Notification.create({
    userId: admin.id,
    type: 'quotation_update',
    title: 'Quotation Approved',
    message: 'Quotation for Pacific Rim Exports has been approved and ready for conversion',
    isRead: true,
    readAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    referenceType: 'quotation',
    priority: 'medium',
  });
  console.log('Notifications seeded');

  console.log('\n=== Seed Complete ===');
  console.log('Login credentials:');
  console.log('  Admin:   admin@cargoflo.com / Admin@123');
  // 14. FF Jobs
  const [ffJob1] = await FFJob.findOrCreate({
    where: { jobNumber: 'SEA-E-FCL-H-2025-00001' },
    defaults: {
      jobNumber: 'SEA-E-FCL-H-2025-00001',
      customerId: customers[0].id,
      companyId: company.id,
      transportMode: 'SEA',
      direction: 'EXPORT',
      cargoType: 'FCL',
      serviceType: 'H',
      jobType: 'SEA_FREIGHT',
      origin: 'Dubai, UAE',
      originCode: 'AEJEA',
      destination: 'Shanghai, China',
      destinationCode: 'CNSHA',
      etd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      eta: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      vesselName: 'MSC Beatrice',
      voyageNumber: 'MSC-2025-001',
      mblNumber: 'MSCU1234567',
      hblNumber: 'CF-HBL-001',
      containerNumbers: ['MSCU1234567', 'MSCU7654321'],
      packages: 40,
      grossWeight: 22000,
      commodity: 'General Merchandise',
      incoterm: 'FOB',
      status: 'confirmed',
      assignedTo: user1.id,
      createdBy: admin.id,
    },
  });

  const [ffJob2] = await FFJob.findOrCreate({
    where: { jobNumber: 'AIR-I-LSE-H-2025-00001' },
    defaults: {
      jobNumber: 'AIR-I-LSE-H-2025-00001',
      customerId: customers[1].id,
      companyId: company.id,
      transportMode: 'AIR',
      direction: 'IMPORT',
      cargoType: 'LSE',
      serviceType: 'H',
      jobType: 'AIR_FREIGHT',
      origin: 'Frankfurt, Germany',
      originCode: 'FRA',
      destination: 'Dubai, UAE',
      destinationCode: 'DXB',
      etd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      eta: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      flightNumber: 'LH-7890',
      awbNumber: '020-12345678',
      hawbNumber: 'CF-HAWB-001',
      packages: 10,
      grossWeight: 500,
      chargeableWeight: 650,
      commodity: 'Pharmaceuticals',
      incoterm: 'CIP',
      status: 'draft',
      assignedTo: user1.id,
      createdBy: manager.id,
    },
  });
  console.log('FF Jobs seeded');

  // 15. Service Jobs
  const [svcJob1] = await ServiceJob.findOrCreate({
    where: { jobNumber: 'SVC-2025-00001' },
    defaults: {
      jobNumber: 'SVC-2025-00001',
      customerId: customers[0].id,
      companyId: company.id,
      serviceType: 'CUSTOMS_CLEARANCE',
      direction: 'EXPORT',
      origin: 'Dubai, UAE',
      destination: 'Shanghai, China',
      requestDate: new Date(),
      status: 'in_progress',
      charges: [
        { service: 'Customs Filing Fee', description: 'Export customs filing', amount: 150, currency: 'USD' },
        { service: 'Documentation Fee', description: 'Document preparation', amount: 75, currency: 'USD' },
      ],
      totalAmount: 225,
      currency: 'USD',
      assignedTo: user1.id,
      createdBy: admin.id,
    },
  });
  console.log('Service Jobs seeded');

  // 16. Credit Notes
  if (customers[0]) {
    const existingCN = await CreditNote.findOne({ where: { creditNoteNumber: 'CN-2025-00001' } });
    if (!existingCN) {
      const existingInvoice = await Invoice.findOne({ where: { customerId: customers[0].id } });
      if (existingInvoice) {
        await CreditNote.create({
          creditNoteNumber: 'CN-2025-00001',
          invoiceId: existingInvoice.id,
          customerId: customers[0].id,
          companyId: company.id,
          reason: 'Overcharge on freight rate - rate correction applied',
          items: [{ description: 'Freight Rate Correction', quantity: 1, unitPrice: 500, amount: 500, category: 'freight' }],
          subtotal: 500,
          taxAmount: 0,
          totalAmount: 500,
          currency: 'USD',
          status: 'issued',
          issuedDate: new Date(),
          createdBy: admin.id,
        });
      }
    }
  }
  console.log('Credit Notes seeded');

  // 17. Vendor Bills
  const [vb1] = await VendorBill.findOrCreate({
    where: { billNumber: 'BILL/2025/00001' },
    defaults: {
      billNumber: 'BILL/2025/00001',
      vendorId: customers[2].id,
      ffJobId: ffJob1.id,
      companyId: company.id,
      billDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 1800,
      taxAmount: 0,
      totalAmount: 1800,
      amountPaid: 0,
      balance: 1800,
      status: 'posted',
      items: [
        { description: 'Ocean Freight - FCL 20ft', quantity: 2, unitPrice: 800, amount: 1600 },
        { description: 'Documentation Fee', quantity: 1, unitPrice: 200, amount: 200 },
      ],
      notes: 'Vendor invoice for SEA export shipment',
      createdBy: admin.id,
    },
  });
  console.log('Vendor Bills seeded');

  // 18. Opportunities
  const [opp1] = await Opportunity.findOrCreate({
    where: { name: 'Pacific Rim Exports - Sea Freight Contract' },
    defaults: {
      name: 'Pacific Rim Exports - Sea Freight Contract',
      customerId: customers[0].id,
      contactName: 'Michael Chen',
      contactEmail: 'michael@pacificrim.com',
      contactPhone: '+1-310-555-0100',
      companyId: company.id,
      stage: 'proposition',
      transportMode: 'SEA',
      direction: 'EXPORT',
      origin: 'Dubai, UAE',
      destination: 'Los Angeles, USA',
      estimatedRevenue: 50000,
      probability: 60,
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priority: 'high',
      notes: 'Large FCL contract - 10 containers monthly',
      assignedTo: manager.id,
      createdBy: admin.id,
    },
  });

  await Opportunity.findOrCreate({
    where: { name: 'Gulf Traders - Air Freight Service' },
    defaults: {
      name: 'Gulf Traders - Air Freight Service',
      customerId: customers[1].id,
      contactName: 'Ahmed Al-Rashid',
      contactEmail: 'ahmed@gulftraders.com',
      companyId: company.id,
      stage: 'qualified',
      transportMode: 'AIR',
      direction: 'IMPORT',
      origin: 'Frankfurt, Germany',
      destination: 'Dubai, UAE',
      estimatedRevenue: 25000,
      probability: 40,
      expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      priority: 'normal',
      assignedTo: user1.id,
      createdBy: manager.id,
    },
  });
  console.log('Opportunities seeded');

  // 19. Freight Bookings
  await FreightBooking.findOrCreate({
    where: { bookingNumber: 'BKG/2025/00001' },
    defaults: {
      bookingNumber: 'BKG/2025/00001',
      ffJobId: ffJob1.id,
      customerId: customers[0].id,
      companyId: company.id,
      carrierId: carriers['MSCU'] ? carriers['MSCU'].id : null,
      transportMode: 'SEA',
      cargoType: 'FCL',
      origin: 'Dubai, UAE',
      destination: 'Shanghai, China',
      etd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      eta: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      containerCount: 2,
      containerType: '20GP',
      grossWeight: 22000,
      volume: 50,
      commodity: 'General Merchandise',
      bookingReference: 'MSC-BKG-2025-001',
      status: 'confirmed',
      remarks: 'Priority booking - confirmed by carrier',
      createdBy: admin.id,
    },
  });
  console.log('Freight Bookings seeded');

  console.log('  Manager: manager@cargoflo.com / Manager@123');
  console.log('  User:    john@cargoflo.com / User@123');
  console.log('====================\n');

  process.exit(0);
};

seedData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
