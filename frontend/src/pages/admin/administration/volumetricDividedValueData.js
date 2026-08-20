// "Administration > Freight Masters > Volumetric Divided Value" - dedicated
// list, mirroring CargoFlo ERP's "Volumetric Divided Value" screen: Transport
// Mode / UOM / Pound (toggle) / Divided Value columns, an inline "Create"
// row, a checkbox + "Action > Export" menu, and an "Export Data" dialog.
export const VOLUMETRIC_DIVIDED_VALUES = [
  { transportMode: 'SEA', uom: 'cm', pound: false, dividedValue: 1000000.00 },
  { transportMode: 'AIR', uom: 'cm', pound: false, dividedValue: 5000.00 },
  { transportMode: 'ROA', uom: 'cm', pound: false, dividedValue: 4000.00 },
  { transportMode: 'ROA', uom: 'mm', pound: false, dividedValue: 4000000.00 },
  { transportMode: 'AIR', uom: 'mm', pound: false, dividedValue: 6000000.00 },
  { transportMode: 'SEA', uom: 'mm', pound: false, dividedValue: 1000000000.00 },
  { transportMode: 'SEA', uom: 'g', pound: false, dividedValue: 1000.00 },
  { transportMode: 'AIR', uom: 'g', pound: false, dividedValue: 6000.00 },
  { transportMode: 'ROA', uom: 'g', pound: false, dividedValue: 3000.00 },
  { transportMode: 'ROA', uom: 'in', pound: false, dividedValue: 200.00 },
  { transportMode: 'SEA', uom: 'in', pound: false, dividedValue: 61023.00 },
  { transportMode: 'AIR', uom: 'in', pound: false, dividedValue: 366.00 },
  { transportMode: 'AIR', uom: 'm', pound: false, dividedValue: 6000.00 },
  { transportMode: 'SEA', uom: 'm', pound: false, dividedValue: 1000.00 },
  { transportMode: 'ROA', uom: 'm', pound: false, dividedValue: 1000.00 },
];

// UOM options available in the inline "Create" row dropdown.
export const UOM_OPTIONS = ['cm', 'mm', 'g', 'in', 'm', 'kg', 'lb', 'ft'];
