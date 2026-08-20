import { jsPDF } from 'jspdf';

const fmtDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const label = (v) => (v === undefined || v === null || v === '' ? '' : String(v));

const partyLabel = (party) => {
  if (!party) return '';
  return party.email || party.name || '';
};

// Builds a jsPDF document for a given Shipment Document entry.
export const buildDocumentPdf = (doc, form, ctx = {}) => {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const colWidth = (pageWidth - margin * 2) / 2;
  let y = margin;

  const shipper = partyLabel(ctx.selectedShipper);
  const consignee = partyLabel(ctx.selectedConsignee);
  const title = (doc.name || doc.type || 'Document').toUpperCase();

  // Brand header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175);
  pdf.text('CARGOFLO', margin, y + 14);
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.setFont('helvetica', 'normal');
  pdf.text('by DP WORLD', margin, y + 26);

  pdf.setDrawColor(200, 200, 200);
  y += 40;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 18;

  const row = (leftLabel, leftVal, rightLabel, rightVal, opts = {}) => {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);
    pdf.text(`${leftLabel}:`, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label(leftVal), margin, y + 13);

    if (rightLabel) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${rightLabel}:`, margin + colWidth, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(label(rightVal), margin + colWidth, y + 13);
    }
    y += opts.h || 30;
  };

  // Shipper / Booking No
  row('Shipper', shipper, 'Booking/Nomination No', form.jobNumber);

  // Consignee / Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Consignee:', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(label(consignee), margin, y + 13);

  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(20, 20, 20);
  pdf.text(title, margin + colWidth, y + 8, { maxWidth: colWidth });
  pdf.setFontSize(9);
  y += 32;

  // To / From
  row('To', consignee, 'From', shipper);

  // Receipt Date / Incoterm
  row('Receipt Date', fmtDate(form.cargoReceivedDate), 'Incoterm', form.incoterm);

  // Origin / Destination
  row('Origin', form.origin, 'Destination', form.destination);

  // Port of Loading / Port of Discharge
  row('Port of Loading', ctx.originPortName, 'Port of Discharge', ctx.destinationPortName);

  // Shipment Date
  row('Shipment Date', fmtDate(form.shipmentDate), '', '');

  y += 6;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Cargo details
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Cargo Details', margin, y);
  y += 16;

  row('Cargo Type', form.cargoType, 'Transport Mode', form.transportMode);
  row('Packages', form.packages, 'Pack Unit', form.packUnit);
  row('Gross Weight', form.grossWeight ? `${form.grossWeight} ${form.weightUnit || 'kg'}` : '', 'Net Weight', form.netWeight ? `${form.netWeight} ${form.weightUnit || 'kg'}` : '');
  row('Volume', form.volume ? `${form.volume} ${form.volumeUnit || 'm3'}` : '', 'Volumetric Weight', form.volumetricWeight ? `${form.volumetricWeight} ${form.weightUnit || 'kg'}` : '');

  y += 10;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Terms and Conditions
  pdf.setFillColor(243, 244, 246);
  pdf.rect(margin, y, pageWidth - margin * 2, 20, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(30, 30, 30);
  pdf.text('TERMS AND CONDITIONS', margin + 6, y + 14);
  y += 30;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(90, 90, 90);
  const terms = form.termsAndConditions ||
    'This document is generated electronically by CargoFlo and is subject to the standard terms ' +
    'and conditions of carriage. All cargo is handled in accordance with applicable laws and ' +
    'regulations. Please verify all details before use.';
  const lines = pdf.splitTextToSize(terms, pageWidth - margin * 2);
  pdf.text(lines, margin, y);

  return pdf;
};

export const downloadDocumentPdf = (doc, form, ctx = {}) => {
  const pdf = buildDocumentPdf(doc, form, ctx);
  const filename = `${(doc.type || doc.name || 'Document').replace(/\s+/g, '_').toUpperCase()}_${form.jobNumber || 'SHIPMENT'}.pdf`;
  pdf.save(filename);
};

export const getDocumentBlobUrl = (doc, form, ctx = {}) => {
  const pdf = buildDocumentPdf(doc, form, ctx);
  return pdf.output('bloburl');
};
