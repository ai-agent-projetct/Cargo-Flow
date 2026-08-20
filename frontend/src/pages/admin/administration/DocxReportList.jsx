import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { DOCX_REPORTS } from './docxReportData';
import DocxReportExportDataModal from './DocxReportExportDataModal';
import SendMailModal from './SendMailModal';
import toast from 'react-hot-toast';
import MasterListToolbar from './MasterListToolbar';

// "Administration > Document Reports > Docx Reports" list, mirroring
// CargoFlo ERP's "Docx Report Template" screen: Report Name / Module
// columns, a Download-only toolbar (no Create), row checkboxes with an "N
// selected" badge + Action dropdown (Export / Archive / Unarchive / Send
// Mail (booking)), and an Export Data dialog. Clicking a row opens the
// record detail.
const DocxReportList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSendMail, setShowSendMail] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = DOCX_REPORTS
    .map((item, idx) => ({ ...item, idx }))
    .filter((item) =>
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.module.toLowerCase().includes(search.toLowerCase())
    );

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAction = (action) => {
    setShowActionMenu(false);
    if (action === 'Export') {
      setShowExport(true);
    } else if (action === 'Send Mail (booking)') {
      setShowSendMail(true);
    } else {
      toast.success(`${action} done`);
    }
  };

  const selectedRows = filtered.filter((item) => selected.has(item.idx));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Docx Report Template</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="docx-report"
          search={search}
          onSearch={setSearch}
          selectedCount={selected.size}
          onAction={handleAction}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="text-left px-4 py-3">Report Name</th>
                <th className="text-left px-4 py-3">Module</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selected.has(item.idx)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(item.idx)}
                    />
                  </td>
                  <td
                    className="px-4 py-3 text-primary-600 font-medium cursor-pointer hover:underline"
                    onClick={() => navigate(`/admin/administration/document-reports/docx-reports/${item.idx}`)}
                  >
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.module}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DocxReportExportDataModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows}
      />
      <SendMailModal
        isOpen={showSendMail}
        onClose={() => setShowSendMail(false)}
        recordName={selectedRows.length === 1 ? selectedRows[0].name : ''}
      />
    </div>
  );
};

export default DocxReportList;
