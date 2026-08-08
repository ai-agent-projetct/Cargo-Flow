import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { tmsAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';

const STATUSBAR = ['init', 'success', 'fail', 'invalid'];
const STATUS = { init: 'Initialized', success: 'Success', fail: 'Failed', invalid: 'Invalid' };

const pad = (n) => String(n).padStart(2, '0');
const fmt = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[11rem_1fr] items-start gap-3 py-1.5">
    <label className="text-sm font-semibold text-gray-700">{label}</label>
    <div className="min-w-0 text-sm text-gray-800 break-words">{children}</div>
  </div>
);

// A read-only JSON pane standing in for the demo's ace editor.
const CodePane = ({ value }) => (
  <pre className="bg-slate-900 text-slate-100 text-xs rounded p-3 overflow-x-auto max-h-72 whitespace-pre">
    {value || '—'}
  </pre>
);

const TMSRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { guard } = usePermissions();
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => tmsAPI.getById(id));
    if (res) setRec(res.data.data);
    else navigate('/admin/tms');
    setLoading(false);
  }, [id, guard, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading || !rec) return <PageLoader />;

  // Clicking through to the source document is a read on house.shipment —
  // this is the call that raises the Warning dialog for users without access.
  const openDocument = async () => {
    const res = await guard(() => tmsAPI.resolveDocument(id));
    if (res) navigate(res.data.data.route);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/admin/tms')} className="text-blue-700 hover:underline">TMS Request</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">{rec.name}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Read-only model: no Edit / Save / Delete anywhere. */}
      <div className="flex justify-end mb-3">
        <div className="flex items-center">
          {STATUSBAR.map((s, i) => (
            <span key={s} className={`px-4 py-1.5 text-sm ${
              rec.status === s ? 'bg-blue-700 text-white font-medium' : 'bg-white text-gray-500 border-y border-gray-300'
            } ${i === 0 ? 'border-l rounded-l' : ''} ${i === STATUSBAR.length - 1 ? 'border-r rounded-r' : ''}`}>
              {STATUS[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-sm font-semibold text-gray-700">Shipment ID</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{rec.name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12">
          <div>
            <Field label="Record">
              <button onClick={openDocument} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline">
                {rec.reference || rec.name} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </Field>
            <Field label="Request ID"><span className="font-mono text-xs">{rec.requestUuid || ''}</span></Field>
            <Field label="Request Date">{fmt(rec.requestDate)}</Field>
            <Field label="Request Complete Date">{fmt(rec.requestCompleteDate)}</Field>
            <Field label="Requested By">{rec.requestedBy || ''}</Field>
          </div>
          <div>
            <Field label="Model Name"><span className="font-mono text-xs">{rec.resModel || ''}</span></Field>
            <Field label="Related Document ID"><span className="font-mono text-xs">{rec.resId || ''}</span></Field>
            <Field label="Provider Status">
              <span className={rec.status === 'success' ? 'text-green-700 font-medium' : 'text-gray-800'}>
                {rec.providerStatus || ''}
              </span>
            </Field>
            <Field label="Provider Message Type">{rec.providerMessageType || ''}</Field>
            <Field label="Resubmit Url">
              {rec.resubmitUrl
                ? <a href={rec.resubmitUrl} className="text-blue-700 hover:underline">{rec.resubmitUrl}</a>
                : ''}
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">JSON Payload</p>
            <CodePane value={rec.jsonPayload} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Request Response</p>
            <CodePane value={rec.requestResponse} />
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-xl px-6 py-4">
        <OrganizationChatter
          organizationId={rec.id}
          entries={rec.activityLog || []}
          followerCount={rec.followerCount || 1}
          // Read-only model: the chatter shows history but takes no new posts.
          api={{ addActivity: async () => { throw new Error('read-only'); } }}
        />
      </div>
    </div>
  );
};

export default TMSRequestDetail;
