import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings, Download, FileText } from 'lucide-react';
import { DOCX_REPORTS } from './docxReportData';
import SendMailModal from './SendMailModal';
import toast from 'react-hot-toast';

// "Administration > Document Reports > Docx Reports / [Report Name]" detail
// view, mirroring CargoFlo ERP's "Docx Report Template" form: breadcrumb with
// record pagination, an "Action" dropdown (Archive / Send Mail (booking)), a
// "Fields Download" button, Module / Output Type / Active / Template (.docx)
// / Allowed Companies / Data Representation / Show Wizard fields, and "Excel
// Document Usage" / "Default Terms & Conditions" tabs.
const DocxReportDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showSendMail, setShowSendMail] = useState(false);
  const [activeTab, setActiveTab] = useState('excel');
  const [active, setActive] = useState(true);
  const menuRef = useRef(null);

  const index = Math.max(0, Math.min(DOCX_REPORTS.length - 1, parseInt(id, 10) || 0));
  const item = DOCX_REPORTS[index];
  const total = DOCX_REPORTS.length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goRelative = (delta) => {
    const nextIndex = (index + delta + total) % total;
    navigate(`/admin/administration/document-reports/docx-reports/${nextIndex}`);
  };

  const handleAction = (action) => {
    setShowActionMenu(false);
    if (action === 'Send Mail (booking)') {
      setShowSendMail(true);
    } else {
      toast.success(`${action} done`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <button
            onClick={() => navigate('/admin/administration/document-reports/docx-reports')}
            className="text-primary-600 font-medium hover:underline"
          >
            Docx Report Template
          </button>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-700">{item.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{index + 1} / {total}</span>
          <button onClick={() => goRelative(-1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goRelative(1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action + Fields Download */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowActionMenu((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <Settings className="w-3.5 h-3.5" /> Action
          </button>
          {showActionMenu && (
            <div className="absolute top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
              <button onClick={() => handleAction('Archive')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Archive</button>
              <button onClick={() => handleAction('Send Mail (booking)')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Send Mail (booking)</button>
            </div>
          )}
        </div>
        <button
          onClick={() => toast.success('Fields downloaded')}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Fields Download
        </button>
      </div>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{item.name}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Module</p>
            <span className="text-primary-600 font-medium hover:underline cursor-pointer">{item.module}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Allowed Companies</p>
            <span className="text-slate-700">CargoFlo (Dubai)</span>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Output Type</p>
            <span className="text-slate-700">{item.outputType}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Data Representation</p>
            <span className="text-slate-700">{item.dataRepresentation}</span>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Active</p>
            <button
              onClick={() => setActive((prev) => !prev)}
              className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${active ? 'bg-primary-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center text-[10px] ${active ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                {active ? '✓' : ''}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Show Wizard</p>
            <span className="text-slate-700">{item.showWizard ? 'Yes' : 'No'}</span>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Template (.docx)</p>
            <button onClick={() => toast.success('Downloaded')} className="flex items-center gap-1.5 text-primary-600 hover:underline">
              <Download className="w-3.5 h-3.5" /> {item.template}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <button
              onClick={() => setActiveTab('excel')}
              className={`text-sm font-semibold pb-2 ${activeTab === 'excel' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}
            >
              Excel Document Usage
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`text-sm font-semibold pb-2 ${activeTab === 'terms' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}
            >
              Default Terms &amp; Conditions
            </button>
          </div>

          {activeTab === 'excel' ? (
            <div className="px-2 py-2 space-y-4 text-sm text-slate-700">
              <h3 className="text-lg font-bold text-slate-900">How to use Fields Excel Document</h3>
              <p>
                The Fields document (downloaded via the "Fields Download" button above) lists every
                field available for this report's <code className="px-1 bg-slate-100 rounded">.docx</code> template,
                along with a short description. Use it as a reference when building or editing the
                Word template for {item.name}.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary-600 shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Possible Template Field types</p>
                  <ol className="list-decimal list-inside text-slate-600 space-y-0.5 mt-1">
                    <li><strong>Direct Field</strong> - use the field directly to print its value.</li>
                    <li><strong>Reference Field</strong> - access a related record's property via dot notation.</li>
                    <li><strong>Array Field</strong> - loop over related records to print a table of values.</li>
                  </ol>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Direct Field</h4>
                <p>Direct fields print their value as-is, with no dot notation.</p>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-3 mt-1 overflow-x-auto">{`{{FieldName}}

Shipment Number : {{Name}}
Shipment date: {{ShipmentDate}}`}</pre>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Reference Field</h4>
                <p>Reference fields link to another record - access that record's properties using dot notation.</p>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-3 mt-1 overflow-x-auto">{`{{FieldName.FieldProperty}}

Customer Name: {{Client.Name}}
Shipper Name: {{Shipper.Name}}
Consignee Name: {{Consignee.Name}}`}</pre>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Array Field</h4>
                <p>Array fields contain multiple records and are printed as a table or repeated rows.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Table with dynamic rows:
                </p>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-3 mt-1 overflow-x-auto">{`{%tr for cntr in CarrierBookingContainers %}
{{cntr.ContainerType.DisplayName}}  {{cntr.ContainerMode.DisplayName}}  {{cntr.ContainerCount}}  {{cntr.NoOfTeu}}
{% endfor %}`}</pre>
                <p className="text-xs text-amber-600 mt-1">Important: for dynamic rows the <code>{'{%tr for ... %}'}</code> / <code>{'{% endfor %}'}</code> syntax must be followed exactly.</p>
                <p className="mt-2">Printing rows without a table:</p>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-3 mt-1 overflow-x-auto">{`{% for cust_document in CustomDocuments %}
{{cust_document.Id}} - {{cust_document.DeclarationNumber}}
{% endfor %}`}</pre>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Conditional Syntax</h4>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-3 mt-1 overflow-x-auto">{`{% if Containers %}
  -- if containers are defined --
{% endif %}

{% if CustomsBEType == "self" %}
  -- if custom BE Type is 'self' --
{% endif %}

{% if CargoType.IsPackageGroup %}
  -- if Cargo Type is package group --
{% endif %}`}</pre>
                <p className="text-xs text-slate-500 mt-1">Any template field can be used in a condition, following the same syntax as Direct, Reference and Array fields.</p>
              </div>

              <button onClick={() => toast.success('Sample downloaded')} className="flex items-center gap-1.5 text-primary-600 hover:underline">
                <Download className="w-3.5 h-3.5" /> Download Sample
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-700 px-2 py-2">{item.defaultTermsConditions || 'No default terms & conditions configured for this report.'}</p>
          )}
        </div>
      </div>

      <SendMailModal
        isOpen={showSendMail}
        onClose={() => setShowSendMail(false)}
        recordName={item.name}
      />
    </div>
  );
};

export default DocxReportDetail;
