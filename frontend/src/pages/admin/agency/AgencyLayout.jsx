import React, { useEffect, useState } from 'react';
import {
  NavLink, Navigate, Route, Routes, useParams, Link,
} from 'react-router-dom';
import {
  Ship, Anchor, Wrench, Hammer, Settings, BarChart3, Landmark, Boxes, Upload, Users, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agencyAPI } from '../../../services/api';
import AgencyList from './AgencyList';
import AgencyRecord from './AgencyRecord';
import { loadOptions } from './fields';

// Liner Agency / NVOCC - the SearatesERP "Agency" instance: Booking,
// Operations (Sea Export / Import, Consolidation, Manifest, container
// tracking, EDI), Maintenance & Repair, the masters it needs and its reports.
// Screens are generated from the backend's resource spec (GET /agency/meta).

const SECTION_ICON = {
  Booking: Anchor, Operations: Ship, 'Operations Reporting': BarChart3, 'Operations Configuration': Settings,
  Maintenance: Wrench, Repair: Hammer, Manage: Boxes, Accounting: Landmark,
};
const BASE = '/admin/agency';

const itemPath = (item) => item.path || item.resource || item.page;
const findItem = (meta, path) => {
  for (const s of meta.menu) for (const i of s.items) if (!i.report && itemPath(i) === path) return i;
  return meta.resources[path] ? { resource: path, label: meta.resources[path].label } : null;
};

const ListRoute = ({ meta }) => {
  const { path } = useParams();
  const item = findItem(meta, path);
  if (!item || !item.resource) return <Navigate to={`${BASE}/pre-booking`} replace />;
  return <AgencyList key={path} meta={meta} resource={item.resource} title={item.label} basePath={`${BASE}/${path}`} params={item.params} bulk={!!item.bulk} />;
};

const RecordRoute = ({ meta }) => {
  const { path, id } = useParams();
  const item = findItem(meta, path);
  if (!item || !item.resource) return <Navigate to={`${BASE}/pre-booking`} replace />;
  return <AgencyRecord key={`${path}/${id}`} meta={meta} resource={item.resource} id={id} title={item.label} basePath={`${BASE}/${path}`} params={item.params} />;
};

/** Operations > EDI > Import EDI */
const ImportEdi = () => {
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [shipmentType, setShipmentType] = useState('import');
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadOptions('edi-template').then(setTemplates); }, []);
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFilename(f.name);
    const rd = new FileReader();
    rd.onload = () => setContent(String(rd.result || ''));
    rd.readAsText(f);
  };
  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await agencyAPI.importEdi({ templateId: templateId || null, content, filename, shipmentType });
      setResult(res.data.data);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 max-w-3xl">
      <h1 className="text-lg font-semibold text-slate-800">Import EDI</h1>
      <p className="text-xs text-slate-500">Load a manifest feed (XML or CSV). Each record becomes a job with its containers. Values that match no port, vessel, line or party are listed under EDI Discrepancy Data so they can be mapped once and resolve on every later import.</p>
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">EDI Template</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs">
              <option value="">Default mapping</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Jobs are</span>
            <select value={shipmentType} onChange={(e) => setShipmentType(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs">
              <option value="import">Sea Import</option>
              <option value="export">Sea Export</option>
            </select>
          </label>
        </div>
        <input type="file" accept=".xml,.csv,.txt,.edi" onChange={onFile} className="text-xs" />
        <textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} placeholder={'<shipments>\n  <shipment>\n    <BLNumber>JEAKHI26150999</BLNumber>\n    <Consignee>KHAS TRADING CO</Consignee>\n    <PortOfLoading>AEJEA</PortOfLoading>\n    <PortOfDischarge>PKKHI</PortOfDischarge>\n    <Vessel>GSL ELIZABETH</Vessel>\n    <Voyage>012W</Voyage>\n    <container><ContainerNo>MSCU1234565</ContainerNo><ContainerType>40HC</ContainerType></container>\n  </shipment>\n</shipments>'} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono" />
        <button type="button" onClick={run} disabled={busy || !content.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white disabled:opacity-40">
          <Upload size={13} /> {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
      {result && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs space-y-2">
          <p className="font-semibold">{result.message}</p>
          {!!result.created.length && <p>Jobs created: {result.created.join(', ')} · <Link className="text-blue-600 underline" to={`${BASE}/${shipmentType === 'import' ? 'sea-import' : 'sea-export'}`}>open list</Link></p>}
          {!!result.discrepancies.length && (
            <div>
              <p className="text-amber-700">Needs attention:</p>
              <ul className="list-disc ml-5">{result.discrepancies.map((d) => <li key={d}>{d}</li>)}</ul>
              <Link className="text-blue-600 underline" to={`${BASE}/edi-mapping`}>Map them in EDI Discrepancy Data</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Contacts > Principal */
const Principals = () => {
  const [rows, setRows] = useState(null);
  useEffect(() => { agencyAPI.principals().then((r) => setRows(r.data.data)).catch(() => setRows([])); }, []);
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-slate-800">Principal</h1>
      <p className="text-xs text-slate-500">Shipping lines this agency represents (contacts tagged with the Principal party type).</p>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600"><tr>
            {['Principal', 'Code', 'Country', 'Email', 'Jobs', 'Open Jobs', 'Containers', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {!rows && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {rows && !rows.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">No contact carries the Principal party type yet.</td></tr>}
            {(rows || []).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-3 py-2">{p.customerCode || '-'}</td>
                <td className="px-3 py-2">{p.country || '-'}</td>
                <td className="px-3 py-2">{p.email || '-'}</td>
                <td className="px-3 py-2"><Link className="text-blue-600 hover:underline" to={`${BASE}/job?principalId=${p.id}`}>{p.jobs}</Link></td>
                <td className="px-3 py-2">{p.openJobs}</td>
                <td className="px-3 py-2"><Link className="text-blue-600 hover:underline" to={`${BASE}/container-registry?principalId=${p.id}`}>{p.containers}</Link></td>
                <td className="px-3 py-2"><Link className="text-blue-600 hover:underline" to={`/admin/organizations/${p.id}`}>Contact</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AgencyLayout = () => {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    agencyAPI.meta().then((r) => setMeta(r.data.data)).catch((err) => toast.error(err.response?.data?.message || 'Could not load the Liner Agency module'));
  }, []);
  if (!meta) return <div className="text-xs text-slate-400 p-6">Loading Liner Agency…</div>;

  return (
    <div className="flex gap-4 h-full">
      <aside className="w-56 flex-shrink-0 bg-white border border-slate-200 rounded-lg p-3 h-fit max-h-[calc(100vh-7rem)] overflow-y-auto">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Liner Agency</h2>
        {meta.menu.map((section) => {
          const Icon = SECTION_ICON[section.title] || ClipboardList;
          return (
            <div key={section.title} className="mb-3">
              <p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Icon size={11} /> {section.title}
              </p>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const to = item.report ? `/admin/ops-reports/${item.report}` : `${BASE}/${itemPath(item)}`;
                  return (
                    <NavLink
                      key={`${section.title}-${item.label}`}
                      to={to}
                      className={({ isActive }) => `flex items-center gap-2 px-2 py-1 rounded text-xs ${isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {item.report && <BarChart3 size={11} className="flex-shrink-0 opacity-60" />}
                      {item.page === 'principals' && <Users size={11} className="flex-shrink-0 opacity-60" />}
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </aside>
      <div className="flex-1 min-w-0">
        <Routes>
          <Route index element={<Navigate to="pre-booking" replace />} />
          <Route path="import-edi" element={<ImportEdi />} />
          <Route path="principals" element={<Principals />} />
          <Route path=":path" element={<ListRoute meta={meta} />} />
          <Route path=":path/:id" element={<RecordRoute meta={meta} />} />
        </Routes>
      </div>
    </div>
  );
};

export default AgencyLayout;
