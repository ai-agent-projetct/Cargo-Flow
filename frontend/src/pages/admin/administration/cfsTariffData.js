// Static option lists for the "CFS Tariff > Charges Tariff" create/edit form,
// mirroring CargoFlo ERP's "CFS Tariff Charges / New" screen.

export const CFS_OPERATIONS = [
  { value: 'import', label: '[IMP] Import' },
  { value: 'export', label: '[EXP] Export' },
];

export const CFS_TRANSPORT_MODES = [
  { value: 'SEA', label: '[SEA] Sea Freight' },
  { value: 'AIR', label: '[AIR] Air Freight' },
  { value: 'ROAD', label: '[ROAD] Road Freight' },
  { value: 'RAIL', label: '[RAIL] Rail Freight' },
];

export const CFS_CARGO_TYPES = [
  { value: 'FCL', label: '[FCL] Full Container Load' },
  { value: 'LCL', label: '[LCL] Less Container Load' },
  { value: 'FTL', label: '[FTL] Full Truck Load' },
  { value: 'LTL', label: '[LTL] Less Truck Load' },
  { value: 'BULK', label: '[BULK] Bulk' },
  { value: 'RORO', label: '[RORO] RoRo' },
  { value: 'BREAKBULK', label: '[BREAKBULK] Break Bulk' },
];

export const CFS_TARIFF_BASES = [
  'Per Container', 'Per BL', 'Per Shipment', 'Per KG', 'Per CBM', 'Per Ton',
  'Per Document', '% of Freight', 'Flat',
];

export const CFS_MEASUREMENT_TYPES = ['Fixed', 'Percentage', 'Per Unit', 'Slab'];

export const CFS_CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'CNY', 'SGD'];

export const COUNTRIES = [
  'United Arab Emirates', 'United States', 'United Kingdom', 'India', 'China', 'Singapore',
  'Germany', 'France', 'Netherlands', 'Saudi Arabia', 'Qatar', 'Oman', 'Bahrain', 'Kuwait',
  'Australia', 'Canada', 'Japan', 'South Korea', 'Malaysia', 'Indonesia', 'Vietnam',
  'Thailand', 'Turkey', 'Egypt', 'South Africa', 'Brazil', 'Italy', 'Spain', 'Sri Lanka',
  'Bangladesh', 'Pakistan', 'Nigeria', 'Kenya', 'Hong Kong', 'Taiwan',
];

export const emptyCFSCharge = () => ({
  chargeName: '',
  tariffBase: '',
  measurementType: '',
  unitPrice: '',
  currency: 'AED',
  validFrom: '',
  validTo: '',
});

export const operationLabel = (value) => CFS_OPERATIONS.find((o) => o.value === value)?.label || '-';
export const transportModeLabel = (value) => CFS_TRANSPORT_MODES.find((o) => o.value === value)?.label || value || '-';
export const cargoTypeLabel = (value) => CFS_CARGO_TYPES.find((o) => o.value === value)?.label || value || '-';
