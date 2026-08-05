const provider = require('./aiProvider');

// Document AI for the OCR Document module: hand Claude a B/L, packing list, or
// commercial invoice and get back the structured shipment / package / commodity
// lines the operator would otherwise key in by hand.

// Structured-outputs schema. Every object sets additionalProperties:false and
// lists its keys in `required` — both are required by the API for strict output.
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'shipment', 'packages', 'commodities', 'confidence', 'notes'],
  properties: {
    documentType: {
      type: 'string',
      enum: ['bill_of_lading', 'air_waybill', 'packing_list', 'commercial_invoice', 'certificate_of_origin', 'other'],
    },
    shipment: {
      type: 'object',
      additionalProperties: false,
      required: ['hblNumber', 'mblNumber', 'bookingNumber', 'shipper', 'consignee', 'notifyParty',
        'origin', 'destination', 'portOfLoading', 'portOfDischarge', 'vesselName', 'voyageNumber',
        'transportMode', 'cargoType', 'incoterm', 'etd', 'eta'],
      properties: {
        hblNumber: { type: ['string', 'null'] },
        mblNumber: { type: ['string', 'null'] },
        bookingNumber: { type: ['string', 'null'] },
        shipper: { type: ['string', 'null'] },
        consignee: { type: ['string', 'null'] },
        notifyParty: { type: ['string', 'null'] },
        origin: { type: ['string', 'null'] },
        destination: { type: ['string', 'null'] },
        portOfLoading: { type: ['string', 'null'] },
        portOfDischarge: { type: ['string', 'null'] },
        vesselName: { type: ['string', 'null'] },
        voyageNumber: { type: ['string', 'null'] },
        transportMode: { type: ['string', 'null'], description: 'SEA, AIR, ROAD, or RAIL' },
        cargoType: { type: ['string', 'null'], description: 'FCL, LCL, LSE, BLK, etc.' },
        incoterm: { type: ['string', 'null'] },
        etd: { type: ['string', 'null'], description: 'ISO date if present' },
        eta: { type: ['string', 'null'], description: 'ISO date if present' },
      },
    },
    packages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['containerNumber', 'containerType', 'sealNumber', 'packageCount', 'packageType', 'grossWeight', 'weightUom', 'volume', 'volumeUom'],
        properties: {
          containerNumber: { type: ['string', 'null'] },
          containerType: { type: ['string', 'null'] },
          sealNumber: { type: ['string', 'null'] },
          packageCount: { type: ['number', 'null'] },
          packageType: { type: ['string', 'null'] },
          grossWeight: { type: ['number', 'null'] },
          weightUom: { type: ['string', 'null'] },
          volume: { type: ['number', 'null'] },
          volumeUom: { type: ['string', 'null'] },
        },
      },
    },
    commodities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'hsCode', 'quantity', 'unit', 'unitPrice', 'totalValue', 'currency', 'isHazardous'],
        properties: {
          description: { type: ['string', 'null'] },
          hsCode: { type: ['string', 'null'] },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          unitPrice: { type: ['number', 'null'] },
          totalValue: { type: ['number', 'null'] },
          currency: { type: ['string', 'null'] },
          isHazardous: { type: ['boolean', 'null'] },
        },
      },
    },
    confidence: { type: 'number', description: '0-1, how confident the extraction is overall' },
    notes: { type: ['string', 'null'], description: 'Anything ambiguous, illegible, or worth an operator double-checking' },
  },
};

const EXTRACT_SYSTEM = `You extract structured data from freight documents for a forwarding ERP.

Transcribe only what the document actually shows. Leave a field null rather than inferring it —
a null the operator fills in beats a plausible guess they don't notice is wrong.

Normalise as you go: dates to ISO (YYYY-MM-DD), weights and volumes to numbers with the unit in
its own field, container numbers to the standard 4-letter + 7-digit form with no spaces.
Map transport mode to SEA/AIR/ROAD/RAIL and cargo type to FCL/LCL/LSE/BLK where the document makes
it clear.

Set confidence to reflect legibility and completeness, and use notes to flag anything smudged,
contradictory, or cut off.`;

// `file` is { data: Buffer, mimeType: string }. The provider handles the
// per-model differences in how a PDF or image is attached.
const extractDocument = async ({ file, filename }) => provider.extractStructured({
  system: EXTRACT_SYSTEM,
  prompt: `Extract the shipment, package, and commodity data from this document${filename ? ` (${filename})` : ''}.`,
  file,
  schema: EXTRACTION_SCHEMA,
});

module.exports = { extractDocument, EXTRACTION_SCHEMA };
