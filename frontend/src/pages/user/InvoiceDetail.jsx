import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockInvoice = {
  id: 1, invoiceNumber: 'INV-2024-0036', status: 'sent',
  issueDate: '2024-12-10T00:00:00Z', dueDate: '2025-01-10T00:00:00Z',
  currency: 'USD', paymentTerms: 'Net 30',
  shipment: { shipmentNumber: 'CF-2024-0248' },
  fromCompany: 'CargoFlo Logistics', fromEmail: 'accounts@cargoflo.com',
  bankDetails: 'Bank: HSBC | Account: 1234567890 | SWIFT: HSBCUAET',
  notes: 'Please include invoice number in payment reference.',
  items: [
    { description: 'Ocean Freight - Shanghai to Rotterdam', quantity: 2, unit: 'Container', unitPrice: 1800, amount: 3600 },
    { description: 'Port Handling Fee', quantity: 1, unit: 'Shipment', unitPrice: 250, amount: 250 },
    { description: 'Documentation Fee', quantity: 1, unit: 'Shipment', unitPrice: 150, amount: 150 },
    { description: 'Bunker Adjustment Factor', quantity: 2, unit: 'Container', unitPrice: 325, amount: 650 },
  ],
  subtotal: 4850, taxAmount: 0, totalAmount: 4850,
};

const UserInvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-16 text-slate-400">Invoice not found</div>;

  const inv = invoice;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/user/invoices')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">{inv.invoiceNumber}</h2>
            <StatusBadge status={inv.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {(inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'partially_paid') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">Payment Due: {formatDate(inv.dueDate)}</p>
          <p className="text-xs text-amber-700 mt-0.5">Please pay {formatCurrency(inv.totalAmount, inv.currency)} to avoid late fees.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">CF</span>
              </div>
              <h1 className="text-xl font-bold text-primary-800">CargoFlo</h1>
            </div>
            <p className="text-xs text-slate-500">{inv.fromEmail}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">INVOICE</p>
            <p className="text-lg font-semibold text-primary-600">{inv.invoiceNumber}</p>
            <StatusBadge status={inv.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">From</p>
            <p className="font-semibold text-slate-900">{inv.fromCompany || 'CargoFlo Logistics'}</p>
          </div>
          <div className="text-right">
            <div className="space-y-1.5">
              {[
                ['Issue Date', formatDate(inv.issueDate)],
                ['Due Date', formatDate(inv.dueDate)],
                ['Payment Terms', inv.paymentTerms],
                ['Shipment', inv.shipment?.shipmentNumber || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-xs text-slate-500">{label}:</span>
                  <span className="text-xs font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Unit Price</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50">
                <td className="py-3 text-slate-700">{item.description}</td>
                <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                <td className="py-3 text-right text-slate-600">{formatCurrency(item.unitPrice, inv.currency)}</td>
                <td className="py-3 text-right font-medium">{formatCurrency(item.amount, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-56 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatCurrency(inv.subtotal, inv.currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2 mt-2">
              <span>Total</span>
              <span className="text-primary-700">{formatCurrency(inv.totalAmount, inv.currency)}</span>
            </div>
          </div>
        </div>

        {inv.bankDetails && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Payment Details</p>
            <p className="text-xs text-slate-600">{inv.bankDetails}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserInvoiceDetail;
