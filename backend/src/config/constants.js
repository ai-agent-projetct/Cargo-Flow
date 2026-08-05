module.exports = {
  // User Roles
  ROLES: {
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
  },

  // Shipment Modes
  TRANSPORT_MODES: {
    SEA: 'sea',
    AIR: 'air',
    LAND: 'land',
    RAIL: 'rail',
    MULTIMODAL: 'multimodal',
  },

  // Shipment Types
  SHIPMENT_TYPES: {
    FCL: 'FCL',
    LCL: 'LCL',
    AIR_FREIGHT: 'Air Freight',
    LAND_FREIGHT: 'Land Freight',
    RAIL_FREIGHT: 'Rail Freight',
  },

  // Quotation Status
  QUOTATION_STATUS: {
    DRAFT: 'draft',
    SENT: 'sent',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    CONVERTED: 'converted',
  },

  // Shipment Status
  SHIPMENT_STATUS: {
    BOOKING_CONFIRMED: 'booking_confirmed',
    CARGO_RECEIVED: 'cargo_received',
    CUSTOMS_CLEARANCE: 'customs_clearance',
    LOADED: 'loaded',
    DEPARTED: 'departed',
    IN_TRANSIT: 'in_transit',
    ARRIVED: 'arrived',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  // Job Status
  JOB_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ON_HOLD: 'on_hold',
  },

  // Invoice Status
  INVOICE_STATUS: {
    DRAFT: 'draft',
    SENT: 'sent',
    PAID: 'paid',
    PARTIALLY_PAID: 'partially_paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
    CREDIT_NOTE: 'credit_note',
  },

  // Customer Types
  CUSTOMER_TYPES: {
    SHIPPER: 'shipper',
    CONSIGNEE: 'consignee',
    AGENT: 'agent',
    BROKER: 'broker',
    OTHER: 'other',
  },

  // Document Types
  DOCUMENT_TYPES: {
    BILL_OF_LADING: 'bill_of_lading',
    AIR_WAYBILL: 'air_waybill',
    COMMERCIAL_INVOICE: 'commercial_invoice',
    PACKING_LIST: 'packing_list',
    CERTIFICATE_OF_ORIGIN: 'certificate_of_origin',
    CUSTOMS_DECLARATION: 'customs_declaration',
    INSURANCE: 'insurance',
    OTHER: 'other',
  },

  // Carrier Types
  CARRIER_TYPES: {
    SHIPPING_LINE: 'shipping_line',
    AIRLINE: 'airline',
    TRUCKING: 'trucking',
    RAIL: 'rail',
  },

  // Port Types
  PORT_TYPES: {
    SEA: 'sea',
    AIR: 'air',
    INLAND: 'inland',
    RAIL: 'rail',
  },

  // Notification Types
  NOTIFICATION_TYPES: {
    SHIPMENT_UPDATE: 'shipment_update',
    QUOTATION_UPDATE: 'quotation_update',
    INVOICE_DUE: 'invoice_due',
    DOCUMENT_UPLOADED: 'document_uploaded',
    SYSTEM: 'system',
    JOB_ASSIGNED: 'job_assigned',
  },

  // New Transport Modes (uppercase, aligned with FF Job / Quotation)
  TRANSPORT_MODES_NEW: { SEA: 'SEA', AIR: 'AIR', ROAD: 'ROAD', RAIL: 'RAIL' },
  TRANSPORT_MODE_CODES: { SEA: 'SEA', AIR: 'AIR', ROAD: 'ROA', RAIL: 'RAIL' },

  // Cargo Types
  CARGO_TYPES: {
    FCL: 'FCL',
    LCL: 'LCL',
    FTL: 'FTL',
    LTL: 'LTL',
    LSE: 'LSE',
    BULK: 'BULK',
    RORO: 'RORO',
    BREAKBULK: 'BREAKBULK',
  },
  CARGO_TYPE_LABELS: {
    FCL: 'Full Container Load',
    LCL: 'Less Container Load',
    FTL: 'Full Truck Load',
    LTL: 'Less Truck Load',
    LSE: 'Loose',
    BULK: 'Bulk',
    RORO: 'RoRo',
    BREAKBULK: 'Break Bulk',
  },

  // Directions
  DIRECTIONS: { EXPORT: 'EXPORT', IMPORT: 'IMPORT', LOCAL: 'LOCAL' },
  DIRECTION_CODES: { EXPORT: 'EXP', IMPORT: 'IMP', LOCAL: 'LOC' },
  DIRECTION_SHORT: { EXPORT: 'E', IMPORT: 'I', LOCAL: 'L' },

  // FF Job Status flow
  FF_JOB_STATUS: ['created', 'booked', 'received', 'confirmed', 'in_transit', 'arrived', 'completed', 'accounting_closure', 'cancelled'],

  // Service Job Status flow
  SERVICE_JOB_STATUS: ['created', 'in_progress', 'completed', 'cancelled'],

  // Opportunity stages
  OPPORTUNITY_STAGES: ['new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'],

  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 1000,

  // JWT
  JWT_EXPIRES_IN: '7d',
  JWT_REFRESH_EXPIRES_IN: '30d',
};
