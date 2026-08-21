import React, { useState } from 'react';
import { MessageSquare, StickyNote, Clock, Paperclip, Users } from 'lucide-react';
import ScheduleActivityModal from '../../../common/ScheduleActivityModal';
import { organizationsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

// The chatter under an Organization form: compose row plus a date-grouped feed
// of messages, notes, and field-level change logs.
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const relative = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

// `api` lets other modules (RMS tariffs, etc.) reuse this feed — any client
// exposing addActivity(id, {kind, body}) works.
const OrganizationChatter = ({
  organizationId, entries = [], followerCount = 0, onPosted, api,
  resModel = 'organization', resName,
}) => {
  const client = api || organizationsAPI;
  const [composing, setComposing] = useState(null); // 'message' | 'note' | null
  const [showActivity, setShowActivity] = useState(false);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const post = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await client.addActivity(organizationId, { kind: composing, body: body.trim() });
      onPosted?.(res.data.data);
      setBody('');
      setComposing(null);
    } catch {
      toast.error('Failed to post');
    } finally {
      setSaving(false);
    }
  };

  // Group newest-first, preserving the order the API returned.
  const groups = [];
  for (const e of entries) {
    const key = dayKey(e.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, items: [e] });
  }

  return (
    <>
    <div className="mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-4">
          {[
            { kind: 'message', label: 'Send message', Icon: MessageSquare },
            { kind: 'note', label: 'Log note', Icon: StickyNote },
          ].map(({ kind, label, Icon }) => (
            <button
              key={kind}
              onClick={() => { setComposing(composing === kind ? null : kind); setBody(''); }}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                composing === kind ? 'text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
          <button
            onClick={() => setShowActivity(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <Clock className="w-4 h-4" /> Schedule activity
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> 0</span>
          <button className="hover:text-gray-700">Follow</button>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {followerCount}</span>
        </div>
      </div>

      {composing && (
        <div className={`mt-3 p-3 rounded-lg border ${composing === 'note' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <textarea
            rows={3}
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={composing === 'note' ? 'Log an internal note...' : 'Send a message to followers...'}
            className="w-full text-sm bg-transparent focus:outline-none resize-none"
          />
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={post}
              disabled={saving || !body.trim()}
              className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded"
            >
              {saving ? 'Posting...' : composing === 'note' ? 'Log' : 'Send'}
            </button>
            <button onClick={() => setComposing(null)} className="text-sm text-gray-500 hover:text-gray-700">Discard</button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-5">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No activity yet</p>
        ) : groups.map((g) => (
          <div key={g.key}>
            <p className="text-center text-xs font-semibold text-gray-500 mb-3">{g.key}</p>
            <div className="space-y-2">
              {g.items.map((e, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-lg ${e.kind === 'note' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <span className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 uppercase">
                    {(e.author || '?')[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold text-gray-800">{e.author}</span>
                      <span className="text-xs text-gray-400 ml-2">- {relative(e.at)}</span>
                    </p>
                    {e.body && <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{e.body}</p>}
                    {(e.changes || []).length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {e.changes.map((c, ci) => (
                          <li key={ci} className="text-sm text-gray-700 list-disc ml-4">
                            {c.field}: {c.from && <span>{c.from} </span>}
                            <span className="text-gray-400">➞</span> {c.to}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
      <ScheduleActivityModal
        open={showActivity}
        onClose={() => setShowActivity(false)}
        resModel={resModel}
        resId={organizationId}
        resName={resName}
      />
    </>
  );
};

export default OrganizationChatter;
