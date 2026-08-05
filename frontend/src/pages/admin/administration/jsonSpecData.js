// "Administration > Freight Masters > Product JSON Specifications" and
// "FIATA eBL Json Specifications" data, mirroring SeaRates ERP. Some records
// are restricted to specific departments/groups - clicking them shows the
// same "Warning" access-denied dialog as the live ERP (the access rights for
// each row are visible to admins on the User panel under Departments/Groups).

const FREIGHT_TECH_SUPPORT_GROUPS = ['Technical Support/Freight Technical Support Team'];

export const PRODUCT_JSON_SPECS = {
  title: 'Product Json Specification',
  filterChip: 'Main Spec',
  rows: [
    {
      displayName: 'House Shipment EAWB',
      model: 'House Shipment',
      restricted: true,
      restrictedResource: "'JSON Specification Dependency' (product.json.specification.dependency)",
      allowedGroups: FREIGHT_TECH_SUPPORT_GROUPS,
    },
    { displayName: 'Air Searates Tracking', model: 'Master Shipment' },
    { displayName: 'Sea Searates Tracking', model: 'Master Shipment' },
    { displayName: 'Parcel Tracking', model: 'Freight Service Job' },
    { displayName: 'transportation_spec', model: 'House Shipment Transportation Details' },
    { displayName: 'part_bl_specs', model: 'House Shipment Part BL' },
    { displayName: 'Global eInvoice JSON Data Specification', model: 'Journal Entry' },
  ],
};

export const FIATA_EBL_JSON_SPECS = {
  title: 'FIATA eBL Json Spec',
  filterChip: 'Main Spec',
  rows: [
    {
      displayName: 'FIATA eBL Hub JSON Data Main Schema',
      model: 'House Shipment',
      restricted: true,
      restrictedResource: "'JSON Specification Dependency' (product.json.specification.dependency)",
      allowedGroups: FREIGHT_TECH_SUPPORT_GROUPS,
    },
  ],
};

export const CARRIER_BOOKING_JSON_SPECS = {
  title: 'Carrier Booking Json Spec',
  filterChip: 'Main Spec',
  rows: [
    { displayName: 'Master Shipment EAWB', model: 'Master Shipment' },
    { displayName: 'Master and House Shipment EAWB', model: 'Master Shipment' },
    {
      displayName: 'Carrier Booking JSON Data Main Schema',
      model: 'Freight Booking Request',
      restricted: true,
      restrictedResource: "'JSON Specification Dependency' (product.json.specification.dependency)",
      allowedGroups: FREIGHT_TECH_SUPPORT_GROUPS,
    },
    { displayName: 'BuyCo: Partner Registration', model: 'Contact' },
  ],
};

export const TMS_JSON_SPECS = {
  title: 'TMS Json Spec',
  filterChip: 'Main Spec',
  rows: [
    {
      displayName: 'Global TMS JSON Data Main Schema',
      model: 'House Shipment',
      restricted: true,
      restrictedResource: "'JSON Specification Dependency' (product.json.specification.dependency)",
      allowedGroups: FREIGHT_TECH_SUPPORT_GROUPS,
    },
  ],
};
