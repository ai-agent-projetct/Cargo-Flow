import jsPDF from 'jspdf';

// A printable invoice. The shipment PDF builder next door is laid out around
// shipper/consignee and a job number, which is the wrong shape for a bill, so
// this renders the invoice's own parties, lines and totals.

const money = (v, cur = '') => `${Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}${cur ? ` ${cur}` : ''}`;

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '');

export const buildInvoicePdf = (inv, { company = 'CargoFlo' } = {}) => {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const right = pageWidth - margin;
  let y = margin;

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(29, 78, 216);
  pdf.text(company, margin, y);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(16);
  pdf.text('INVOICE', right, y, { align: 'right' });
  y += 18;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(inv.invoiceNumber || '', right, y, { align: 'right' });
  y += 22;

  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, y, right, y);
  y += 20;

  // Parties and dates, side by side
  const customer = inv.customer || {};
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(9);
  pdf.text('BILL TO', margin, y);
  pdf.text('DETAILS', right, y, { align: 'right' });
  y += 14;

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(customer.companyName || customer.contactName || '—', margin, y);
  pdf.setFont('helvetica', 'normal');

  const details = [
    ['Issue Date', fmtDate(inv.issueDate)],
    ['Due Date', fmtDate(inv.dueDate)],
    ['Payment Terms', inv.paymentTerms || ''],
    ['Shipment', inv.shipment?.shipmentNumber || ''],
  ].filter(([, v]) => v);
  details.forEach(([k, v], i) => {
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${k}:`, right - 150, y + i * 13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(v), right, y + i * 13, { align: 'right' });
  });

  // Address wraps under the customer name.
  pdf.setTextColor(71, 85, 105);
  const addr = pdf.splitTextToSize(customer.address || '', 220);
  pdf.text(addr, margin, y + 14);
  if (customer.email) pdf.text(customer.email, margin, y + 14 + addr.length * 12);

  y += Math.max(details.length * 13, 14 + addr.length * 12 + (customer.email ? 12 : 0)) + 22;

  // Line items
  const cols = [margin, margin + 250, margin + 320, margin + 400, right];
  pdf.setFillColor(241, 245, 249);
  pdf.rect(margin, y - 12, right - margin, 20, 'F');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRIPTION', cols[0] + 4, y);
  pdf.text('QTY', cols[1], y);
  pdf.text('UNIT PRICE', cols[2], y);
  pdf.text('AMOUNT', cols[4] - 4, y, { align: 'right' });
  y += 20;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  for (const item of (inv.items || [])) {
    if (y > pdf.internal.pageSize.getHeight() - 120) { pdf.addPage(); y = margin; }
    const desc = pdf.splitTextToSize(item.description || '', 240);
    pdf.text(desc, cols[0] + 4, y);
    pdf.text(`${item.quantity ?? ''} ${item.unit || ''}`.trim(), cols[1], y);
    pdf.text(money(item.unitPrice), cols[2], y);
    pdf.text(money(item.amount), cols[4] - 4, y, { align: 'right' });
    y += Math.max(desc.length * 12, 14) + 4;
  }

  // Totals
  y += 8;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(cols[2] - 20, y, right, y);
  y += 16;

  const totals = [
    ['Subtotal', money(inv.subtotal, inv.currency)],
    ...(Number(inv.taxAmount) ? [['Tax', money(inv.taxAmount, inv.currency)]] : []),
    ['Total', money(inv.totalAmount, inv.currency)],
    ...(Number(inv.paidAmount) ? [['Paid', money(inv.paidAmount, inv.currency)]] : []),
    ...(Number(inv.balanceAmount) ? [['Balance Due', money(inv.balanceAmount, inv.currency)]] : []),
  ];
  totals.forEach(([k, v], i) => {
    const last = k === 'Total';
    pdf.setFont('helvetica', last ? 'bold' : 'normal');
    pdf.setTextColor(last ? 15 : 100, last ? 23 : 116, last ? 42 : 139);
    pdf.text(k, cols[2], y + i * 16);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(v), right, y + i * 16, { align: 'right' });
  });
  y += totals.length * 16 + 24;

  // Footer notes
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  if (inv.bankDetails) { pdf.text(pdf.splitTextToSize(inv.bankDetails, right - margin), margin, y); y += 24; }
  if (inv.notes) pdf.text(pdf.splitTextToSize(inv.notes, right - margin), margin, y);

  return pdf;
};

export const downloadInvoicePdf = (inv, opts) => {
  const pdf = buildInvoicePdf(inv, opts);
  pdf.save(`${(inv.invoiceNumber || 'invoice').replace(/[\\/]/g, '-')}.pdf`);
};

export default downloadInvoicePdf;
