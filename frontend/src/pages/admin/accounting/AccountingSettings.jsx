import React, { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import api from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

// Accounting > Configuration > Settings. Values persist through the same
// AppSetting store the other module settings pages use.
const SECTIONS = [
  {
    title: 'Customer Invoices',
    fields: [
      ['defaultPaymentTerms', 'Default Payment Terms', 'text', '30 Days'],
      ['creditLimitEnabled', 'Enforce Credit Limits', 'boolean', true],
      ['invoiceOnlinePayment', 'Allow Online Payment', 'boolean', false],
    ],
  },
  {
    title: 'Vendor Bills',
    fields: [
      ['billDefaultTerms', 'Default Vendor Payment Terms', 'text', '30 Days'],
      ['threeWayMatching', '3-way Matching (Purchase, Receipt, Bill)', 'boolean', false],
    ],
  },
  {
    title: 'Taxes',
    fields: [
      ['defaultSalesTax', 'Default Sales Tax', 'text', 'VAT 5% (Dubai)'],
      ['defaultPurchaseTax', 'Default Purchase Tax', 'text', 'VAT 5%'],
      ['roundingMethod', 'Tax Rounding', 'select', 'Round per Line', ['Round per Line', 'Round Globally']],
    ],
  },
  {
    title: 'Currencies',
    fields: [
      ['mainCurrency', 'Main Currency', 'text', 'AED'],
      ['multiCurrency', 'Multi-Currencies', 'boolean', true],
      ['autoExchangeRates', 'Automatic Currency Rates', 'boolean', false],
    ],
  },
  {
    title: 'Fiscal Periods',
    fields: [
      ['fiscalYearLastDay', 'Last Day of Fiscal Year', 'text', '31'],
      ['fiscalYearLastMonth', 'Last Month of Fiscal Year', 'text', 'December'],
    ],
  },
];

const ALL = SECTIONS.flatMap((s) => s.fields);

const AccountingSettings = () => {
  const { guard } = usePermissions();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => api.get('/settings', { params: { category: 'accounting' } }));
    const rows = res?.data?.data || [];
    const byKey = Object.fromEntries(
      (Array.isArray(rows) ? rows : []).map((r) => [r.key, r.value])
    );
    // Fall back to each field's documented default when nothing is stored yet.
    setValues(Object.fromEntries(ALL.map(([key, , type, def]) => {
      const stored = byKey[key];
      if (stored === undefined) return [key, def];
      return [key, type === 'boolean' ? stored === 'true' || stored === true : stored];
    })));
    setLoading(false);
  }, [guard]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload = ALL.map(([key]) => ({
      category: 'accounting', key, value: String(values[key] ?? ''),
    }));
    const res = await guard(() => api.put('/settings/bulk', { settings: payload }));
    if (res) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-700">Saved</span>}
          <button onClick={save}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s.title} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">{s.title}</div>
            {s.fields.map(([key, label, type, , options]) => (
              <div key={key} className="flex items-center justify-between gap-3 mb-2.5">
                <label className="text-xs text-gray-700" htmlFor={key}>{label}</label>
                {type === 'boolean' ? (
                  <input id={key} type="checkbox" className="rounded border-gray-300"
                    checked={!!values[key]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))} />
                ) : type === 'select' ? (
                  <select id={key} value={values[key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1 text-xs">
                    {(options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={key} value={values[key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="w-44 border border-gray-300 rounded px-2 py-1 text-xs" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountingSettings;
