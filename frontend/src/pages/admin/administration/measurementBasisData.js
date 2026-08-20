// "Administration > Freight Masters > Measurement Basis" - dedicated list +
// detail records, mirroring CargoFlo ERP's "Measurement Basis" screen (Name
// / Transport Mode / Package Group / Is Job Measurement / Is Slab Based /
// Active columns, and a detail view with an Action > Archive option).
export const MEASUREMENT_BASES = [
  { name: 'Per Truck', transportModes: ['ROA'], packageGroup: 'Container', isJobMeasurement: false, isSlabBased: false, active: true },
  { name: 'KGS', transportModes: ['SEA', 'AIR'], packageGroup: 'All', isJobMeasurement: false, isSlabBased: false, active: true },
  { name: 'Container', transportModes: ['SEA'], packageGroup: 'Container', isJobMeasurement: true, isSlabBased: false, active: true },
  { name: 'CBM', transportModes: ['SEA', 'AIR', 'ROA'], packageGroup: 'All', isJobMeasurement: false, isSlabBased: false, active: true },
  { name: 'Shipment', transportModes: ['SEA', 'AIR', 'ROA'], packageGroup: 'All', isJobMeasurement: true, isSlabBased: false, active: true },
  { name: 'Container Count', transportModes: ['SEA', 'ROA'], packageGroup: 'Container', isJobMeasurement: true, isSlabBased: false, active: true },
  { name: 'Weight', transportModes: ['SEA', 'AIR', 'ROA'], packageGroup: 'Package', isJobMeasurement: true, isSlabBased: true, active: true },
  { name: 'Volume', transportModes: ['SEA', 'AIR', 'ROA'], packageGroup: 'Package', isJobMeasurement: true, isSlabBased: false, active: true },
  { name: 'Chargeable', transportModes: ['SEA', 'AIR', 'ROA'], packageGroup: 'Package', isJobMeasurement: true, isSlabBased: true, active: true },
  { name: 'TEU', transportModes: ['SEA', 'ROA'], packageGroup: 'Container', isJobMeasurement: true, isSlabBased: false, active: true },
  { name: 'Container type', transportModes: ['SEA', 'ROA'], packageGroup: 'Container', isJobMeasurement: true, isSlabBased: false, active: true },
  { name: 'Unit', transportModes: [], packageGroup: 'All', isJobMeasurement: true, isSlabBased: false, active: true },
];
