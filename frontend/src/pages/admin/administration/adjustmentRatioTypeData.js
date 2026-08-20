// "Administration > Freight Masters > Adjustment Ratio Type" - dedicated
// list + detail records, mirroring CargoFlo ERP's "Adjustment Ratio Type"
// screen (Name / Is Package Group columns, and a read-only detail view).
export const ADJUSTMENT_RATIO_TYPES = [
  { name: 'Weight', isPackageGroup: true },
  { name: 'Volume', isPackageGroup: false },
  { name: 'TEU', isPackageGroup: false },
];
