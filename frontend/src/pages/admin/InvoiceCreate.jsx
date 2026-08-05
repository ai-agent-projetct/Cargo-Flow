import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import { CURRENCIES, PAYMENT_TERMS, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const AdminInvoiceCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm({
    defaultValues: {
      customer_name: '',
      customer_email: '',
      customer_address: '',
      shipment_ref: '',
      issued_date: new Date().toISOString().split('T')[0],
      due_date: '',
      currency: 'USD',
      payment_terms: 'Net 30',
      notes: '',
      bank_details: '',
      line_items: [{ description: '', quantity: 1, unit: 'Shipment', unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });
  const watchLineItems = watch('line_items');
  const currency = watch('currency');
  const subtotal = watchLineItems?.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity) || 0), 0) || 0;

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        line_items: data.line_items.map((item) => ({
          ...item,
          total: Number(item.unit_price) * Number(item.quantity),
        })),
        subtotal,
        tax: 0,
        total: subtotal,
      };
      await invoicesAPI.create(payload);
      toast.success('Invoice created successfully!');
      navigate('/admin/invoices');
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/invoices')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold text-slate-900">Create Invoice</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Customer */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Name *</label>
              <input type="text" className="input-field w-full" {...register('customer_name', { required: 'Required' })} />
              {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Email</label>
              <input type="email" className="input-field w-full" {...register('customer_email')} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Address</label>
              <textarea rows={2} className="input-field w-full resize-none" {...register('customer_address')} />
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Shipment Reference</label>
              <input type="text" className="input-field w-full" placeholder="CF-2024-XXXX" {...register('shipment_ref')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Issue Date *</label>
              <input type="date" className="input-field w-full" {...register('issued_date', { required: 'Required' })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Due Date *</label>
              <input type="date" className="input-field w-full" {...register('due_date', { required: 'Required' })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
              <select className="input-field w-full" {...register('currency')}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Terms</label>
              <select className="input-field w-full" {...register('payment_terms')}>
                {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Line Items</h3>
            <button type="button" onClick={() => append({ description: '', quantity: 1, unit: 'Shipment', unit_price: 0 })}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Description</label>}
                  <input type="text" className="input-field w-full" placeholder="Service description" {...register(`line_items.${idx}.description`)} />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Qty</label>}
                  <input type="number" min="1" className="input-field w-full" {...register(`line_items.${idx}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Unit</label>}
                  <input type="text" className="input-field w-full" {...register(`line_items.${idx}.unit`)} />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Unit Price</label>}
                  <input type="number" min="0" step="0.01" className="input-field w-full" {...register(`line_items.${idx}.unit_price`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-1 flex justify-end pb-0.5">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="text-right">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-2xl font-bold text-primary-700">{currency} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Details</label>
              <textarea rows={2} className="input-field w-full resize-none" placeholder="Bank, account, SWIFT..." {...register('bank_details')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea rows={2} className="input-field w-full resize-none" placeholder="Additional notes..." {...register('notes')} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin/invoices')} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:bg-primary-400">
            <Save className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminInvoiceCreate;
