// Static option lists for the Sell Tariff / Buy Tariff create-edit form,
// mirroring the dropdowns shown in SeaRates ERP's "Buy Tariff / New" screen.

export const TARIFF_JOB_TYPES = [
  { value: 'shipment', label: 'Shipment' },
  { value: 'service_job', label: 'Service Job' },
];

export const SHIPMENT_TYPES = ['FCL', 'LCL', 'Air Freight', 'Land Freight', 'Rail Freight'];

export const SERVICE_JOB_TYPES = [
  'Customs Clearance',
  'Warehousing',
  'Trucking',
  'Documentation',
  'Insurance',
  'Other',
];

export const TRANSPORT_MODES = ['Sea', 'Air', 'Land', 'Rail', 'Multimodal'];

export const CARGO_TYPES = ['FCL', 'LCL', 'FTL', 'LTL', 'LSE', 'BULK', 'RORO', 'BREAKBULK'];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'CNY', 'SGD', 'AUD'];

export const MEASUREMENT_BASIS = [
  'Per Shipment',
  'Per Container',
  'Per BL',
  'Per KG',
  'Per CBM',
  'Per Ton',
  'Per Document',
  'Per Hour',
  'Per Day',
  '% of Freight',
];

export const COUNTRIES = [
  'United Arab Emirates', 'United States', 'United Kingdom', 'India', 'China', 'Singapore',
  'Germany', 'France', 'Netherlands', 'Saudi Arabia', 'Qatar', 'Oman', 'Bahrain', 'Kuwait',
  'Australia', 'Canada', 'Japan', 'South Korea', 'Malaysia', 'Indonesia', 'Vietnam',
  'Thailand', 'Turkey', 'Egypt', 'South Africa', 'Brazil', 'Italy', 'Spain', 'Sri Lanka',
  'Bangladesh', 'Pakistan', 'Nigeria', 'Kenya', 'Hong Kong', 'Taiwan',
];

export const emptyCharge = () => ({
  chargeName: '',
  unitPrice: '',
  currency: 'USD',
  measurementBasis: '',
  validFrom: '',
  validTo: '',
});
