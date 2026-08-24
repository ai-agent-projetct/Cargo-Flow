import React, { useState, useEffect } from 'react';
import { downloadInvoicePdf } from '../../utils/invoicePdf';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Mail, CheckCircle, Edit, Printer } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockInvoice = {
  id: 1,
  invoiceNumber: 'INV-2024-0036',
  status: 'sent',
  customer: { companyName: 'Acme Corporation', address: '123 Business Park, New York, NY 10001, USA', email: 'accounts@acmecorp.com' },
  shipment: { shipmentNumber: 'CF-2024-0248' },
  issueDate: '2024-12-10T00:00:00Z',
  dueDate: '2025-01-10T00:00:00Z',
  currency: 'USD',
  paymentTerms: 'Net 30',
  bankDetails: 'Bank: HSBC | Account: 1234567890 | SWIFT: HSBCUAET',
  notes: 'Please include invoice number in payment reference.',
  items: [
    { description: 'Ocean Freight - Shanghai to Rotterdam', quantity: 2, unit: 'Container', unitPrice: 1800, amount: 3600 },
    { description: 'Port Handling Fee - Origin', quantity: 1, unit: 'Shipment', unitPrice: 250, amount: 250 },
    { description: 'Port Handling Fee - Destination', quantity: 1, unit: 'Shipment', unitPrice: 200, amount: 200 },
    { description: 'Documentation Fee', quantity: 1, unit: 'Shipment', unitPrice: 150, amount: 150 },
    { description: 'Bunker Adjustment Factor', quantity: 2, unit: 'Container', unitPrice: 325, amount: 650 },
  ],
  subtotal: 4850,
  taxAmount: 0,
  totalAmount: 4850,
};

const AdminInvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markPaidModal, setMarkPaidModal] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await invoicesAPI.getById(id);
        setInvoice(response.data.data);
      } catch {
        setInvoice({ ...mockInvoice, id });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleMarkPaid = async () => {
    setProcessing(true);
    try {
      await invoicesAPI.markPaid(id, { payment_reference: paymentRef });
      toast.success('Invoice marked as paid');
      setInvoice((inv) => ({ ...inv, status: 'paid' }));
    } catch {
      toast.error('Failed to update');
    } finally {
      setProcessing(false);
      setMarkPaidModal(false);
    }
  };

  const handleSendToCustomer = async () => {
    try {
      await invoicesAPI.sendToCustomer(id);
      toast.success('Invoice sent to customer');
    } catch {
      toast.error('Failed to send');
    }
  };

  if (loading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-16 text-slate-400">Invoice not found</div>;

  const inv = invoice;

  // Render this invoice as a PDF from the record on screen.
  const handleDownloadPdf = () => {
    try {
      downloadInvoicePdf(inv);
      toast.success('Invoice PDF downloaded');
    } catch {
      toast.error('Could not build the PDF');
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/invoices')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{inv.invoiceNumber}</h2>
              <StatusBadge status={inv.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(inv.status === 'sent' || inv.status === 'partially_paid' || inv.status === 'overdue') && (
            <button onClick={() => setMarkPaidModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Mark Paid
            </button>
          )}
          <button onClick={handleSendToCustomer} className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Mail className="w-4 h-4" /> Send
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
        {/* Invoice header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">CF</span>
              </div>
              <h1 className="text-xl font-bold text-primary-800">CargoFlo</h1>
            </div>
            <p className="text-xs text-slate-500">Cargo ERP Platform</p>
            <p className="text-xs text-slate-500 mt-1">accounts@cargoflo.com</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">INVOICE</p>
            <p className="text-lg font-semibold text-primary-600 mt-1">{inv.invoiceNumber}</p>
            <StatusBadge status={inv.status} />
          </div>
        </div>

        {/* Bill to + details */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bill To</p>
            <p className="font-semibold text-slate-900">{inv.customer?.companyName || '-'}</p>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{inv.customer?.address || '-'}</p>
            <p className="text-sm text-slate-600">{inv.customer?.email || '-'}</p>
          </div>
          <div className="text-right">
            <div className="space-y-2">
              {[
                ['Issue Date', formatDate(inv.issueDate)],
                ['Due Date', formatDate(inv.dueDate)],
                ['Payment Terms', inv.paymentTerms],
                ['Shipment Ref', inv.shipment?.shipmentNumber || '-'],
                ['Currency', inv.currency],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-xs text-slate-500">{label}:</span>
                  <span className="text-xs font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Unit</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Unit Price</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 text-slate-700">{item.description}</td>
                <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                <td className="py-3 text-right text-xs text-slate-500">{item.unit}</td>
                <td className="py-3 text-right text-slate-700">{formatCurrency(item.unitPrice, inv.currency)}</td>
                <td className="py-3 text-right font-medium text-slate-900">{formatCurrency(item.amount, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(inv.subtotal, inv.currency)}</span>
            </div>
            {inv.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax</span>
                <span className="font-medium">{formatCurrency(inv.taxAmount, inv.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2 mt-2">
              <span>Total</span>
              <span className="text-primary-700">{formatCurrency(inv.totalAmount, inv.currency)}</span>
            </div>
          </div>
        </div>

        {/* Bank details & notes */}
        {(inv.bankDetails || inv.notes) && (
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            {inv.bankDetails && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bank Details</p>
                <p className="text-xs text-slate-600">{inv.bankDetails}</p>
              </div>
            )}
            {inv.notes && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</p>
                <p className="text-xs text-slate-600">{inv.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mark Paid Modal */}
      <Modal isOpen={markPaidModal} onClose={() => setMarkPaidModal(false)} title="Mark Invoice as Paid" size="sm"
        footer={
          <>
            <button onClick={() => setMarkPaidModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleMarkPaid} disabled={processing} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">{processing ? 'Updating...' : 'Mark as Paid'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Confirm payment for <strong>{inv.invoiceNumber}</strong> — {formatCurrency(inv.totalAmount, inv.currency)}</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Reference (optional)</label>
            <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="input-field w-full" placeholder="Wire transfer ref, check number, etc." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminInvoiceDetail;
