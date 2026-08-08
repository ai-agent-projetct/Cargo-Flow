import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Mail, Menu, Copy, Trash2, Send, X, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calendarAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import OrganizationChatter from '../organization/OrganizationChatter';
import AttendeeSearchModal from './AttendeeSearchModal';
import {
  PRIVACY, SHOW_AS, RRULE_TYPE, END_TYPE, MONTH_BY, BYDAY, WEEKDAYS,
  ATTENDEE_STATUS, fmtDuration, toLocalInput, colorFor, initials,
} from './constants';

const TABS = ['Meeting Details', 'Options', 'Invitations'];

const Field = ({ label, children }) => (
  <div className="grid grid-cols-[9rem_1fr] items-start gap-3 py-1.5">
    <label className="text-sm font-semibold text-gray-700 pt-1">{label}</label>
    <div className="min-w-0">{children}</div>
  </div>
);

const inputCls = 'w-full text-sm px-2 py-1 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent disabled:text-gray-800';

const CalendarEventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('Meeting Details');
  const [busy, setBusy] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [picklists, setPicklists] = useState({ alarms: [], tags: [] });
  const actionRef = useRef(null);

  const load = useCallback(async () => {
    setEditing(false);
    setActionOpen(false);
    setTab('Meeting Details');
    setLoading(true);
    try {
      const res = await calendarAPI.getById(id);
      setEvent(res.data.data);
      setDraft(res.data.data);
    } catch {
      toast.error('Meeting not found');
      navigate('/admin/calendar');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    calendarAPI.getPicklists()
      .then((r) => setPicklists(r.data?.data || { alarms: [], tags: [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const away = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  if (loading || !event) return <PageLoader />;

  const view = editing ? draft : event;
  const readOnly = !editing;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const res = await calendarAPI.update(id, draft);
      setEvent(res.data.data);
      setDraft(res.data.data);
      setEditing(false);
      toast.success('Meeting saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async () => {
    try {
      const res = await calendarAPI.resolveDocument(id);
      navigate(res.data.data.route);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No linked document');
    }
  };

  const sendInvites = async () => {
    try {
      const res = await calendarAPI.sendInvitations(id);
      setEvent(res.data.data);
      setDraft(res.data.data);
      toast.success('Invitations sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send invitations');
    } finally {
      setActionOpen(false);
    }
  };

  const setStatus = async (name, status) => {
    try {
      const res = await calendarAPI.setAttendeeStatus(id, { name, status });
      setEvent(res.data.data);
      setDraft(res.data.data);
    } catch {
      toast.error('Could not update status');
    }
  };

  const removeAttendee = (name) =>
    set({ attendees: (draft.attendees || []).filter((a) => a.name !== name) });

  const toggleList = (key, value) => {
    const list = draft[key] || [];
    set({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  return (
    <div className="p-6">
      {/* Breadcrumb + pager */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/admin/calendar')} className="text-blue-700 hover:underline">Meetings</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700 font-medium">{event.name}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <ChevronLeft className="w-4 h-4" /><ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 flex-wrap">
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={busy}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => { setDraft(event); setEditing(false); }}
                  className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
                >
                  Discard
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded"
              >
                Edit
              </button>
            )}
          </div>

          <div className="relative" ref={actionRef}>
            <button
              onClick={() => setActionOpen((o) => !o)}
              className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
            >
              ⚙ Action
            </button>
            {actionOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button onClick={sendInvites} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send Invitations
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await calendarAPI.duplicate(id);
                      toast.success('Meeting duplicated');
                      navigate(`/admin/calendar/events/${res.data.data.id}`);
                    } catch { toast.error('Duplicate failed'); }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete "${event.name}"?`)) return;
                    try {
                      await calendarAPI.delete(id);
                      toast.success('Meeting deleted');
                      navigate('/admin/calendar');
                    } catch { toast.error('Delete failed'); }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Document button */}
        <div className="flex justify-end px-5 pt-4">
          <button
            onClick={openDocument}
            disabled={!event.resModel}
            title={event.resModel ? `Open ${event.resName || event.name}` : 'Not linked to a document'}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm text-blue-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <Menu className="w-4 h-4" /> Document
          </button>
        </div>

        {/* Title */}
        <div className="px-5 pt-2">
          <p className="text-sm font-semibold text-gray-700">Meeting Subject</p>
          {editing ? (
            <input
              value={view.name || ''}
              onChange={(e) => set({ name: e.target.value })}
              className="text-3xl font-bold text-gray-900 w-full border-b border-gray-300 focus:border-blue-600 focus:outline-none py-1"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
          )}
        </div>

        {/* Attendee chips + EMAIL */}
        <div className="flex items-center gap-2 px-5 pt-4 flex-wrap">
          {(view.attendees || []).map((a) => (
            <span key={a.name} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-green-100 text-sm text-gray-800">
              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${colorFor(a.name)}`}>
                {initials(a.name)}
              </span>
              <span className="max-w-[16rem] truncate">{a.name}</span>
              {editing && (
                <button onClick={() => removeAttendee(a.name)} className="text-gray-500 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
          {editing && (
            <button
              onClick={() => setPicker(true)}
              className="inline-flex items-center gap-1 px-2 py-1 border border-dashed border-gray-300 rounded-full text-xs text-gray-600 hover:bg-gray-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
          <button
            onClick={sendInvites}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            <Mail className="w-4 h-4" /> EMAIL
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 mt-4 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-5 py-5">
          {tab === 'Meeting Details' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10">
              <div>
                <Field label="Starting at">
                  <input
                    type="datetime-local"
                    disabled={readOnly}
                    value={toLocalInput(view.start)}
                    onChange={(e) => set({ start: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Ending At">
                  <input
                    type="datetime-local"
                    disabled={readOnly}
                    value={toLocalInput(view.stop)}
                    onChange={(e) => set({ stop: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Duration">
                  <span className="text-sm text-gray-800">{fmtDuration(view.duration)} hours</span>
                </Field>
                <Field label="All Day">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={!!view.allday}
                    onChange={(e) => set({ allday: e.target.checked })}
                    className="rounded border-gray-300 mt-1"
                  />
                </Field>
                <Field label="Organizer">
                  {readOnly ? (
                    <span className="inline-flex items-center gap-2 text-sm text-gray-800">
                      <span className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${colorFor(view.organizer)}`}>
                        {initials(view.organizer)}
                      </span>
                      {view.organizer || '-'}
                    </span>
                  ) : (
                    <input value={view.organizer || ''} onChange={(e) => set({ organizer: e.target.value })} className={inputCls} />
                  )}
                </Field>
                <Field label="Description">
                  {readOnly ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{view.description || ''}</p>
                  ) : (
                    <textarea
                      rows={3}
                      value={view.description || ''}
                      onChange={(e) => set({ description: e.target.value })}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:border-blue-600 focus:outline-none resize-none"
                    />
                  )}
                </Field>
              </div>

              <div>
                <Field label="Reminders">
                  {readOnly ? (
                    <div className="flex flex-wrap gap-1">
                      {(view.alarms || []).map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">{a}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {picklists.alarms.map((a) => (
                        <button
                          key={a}
                          onClick={() => toggleList('alarms', a)}
                          className={`px-2 py-0.5 rounded-full text-xs border ${
                            (draft.alarms || []).includes(a)
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
                <Field label="Location">
                  <input disabled={readOnly} value={view.location || ''} onChange={(e) => set({ location: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Meeting URL">
                  <input disabled={readOnly} value={view.videocallLocation || ''} onChange={(e) => set({ videocallLocation: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Tags">
                  {readOnly ? (
                    <div className="flex flex-wrap gap-1">
                      {(view.tags || []).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-violet-100 text-xs text-violet-800">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {picklists.tags.map((t) => (
                        <button
                          key={t}
                          onClick={() => toggleList('tags', t)}
                          className={`px-2 py-0.5 rounded-full text-xs border ${
                            (draft.tags || []).includes(t)
                              ? 'bg-violet-600 border-violet-600 text-white'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            </div>
          )}

          {tab === 'Options' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 max-w-4xl">
              <div>
                <Field label="Privacy">
                  <select disabled={readOnly} value={view.privacy || 'public'} onChange={(e) => set({ privacy: e.target.value })} className={inputCls}>
                    {PRIVACY.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Show as">
                  <select disabled={readOnly} value={view.showAs || 'busy'} onChange={(e) => set({ showAs: e.target.value })} className={inputCls}>
                    {SHOW_AS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Recurrent">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={!!view.recurrency}
                    onChange={(e) => set({ recurrency: e.target.checked })}
                    className="rounded border-gray-300 mt-1"
                  />
                </Field>
              </div>

              {/* The rrule block only matters once the meeting repeats. */}
              {view.recurrency && (
                <div>
                  <Field label="Repeat Every">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} disabled={readOnly}
                        value={view.interval || 1}
                        onChange={(e) => set({ interval: Number(e.target.value) })}
                        className="w-20 text-sm px-2 py-1 border-b border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent disabled:border-transparent"
                      />
                      <select disabled={readOnly} value={view.rruleType || 'weekly'} onChange={(e) => set({ rruleType: e.target.value })} className={inputCls}>
                        {RRULE_TYPE.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    </div>
                  </Field>

                  {view.rruleType === 'weekly' && (
                    <Field label="On">
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAYS.map((d) => (
                          <button
                            key={d.key}
                            disabled={readOnly}
                            onClick={() => toggleList('weekdays', d.key)}
                            className={`px-2 py-0.5 rounded text-xs border disabled:opacity-60 ${
                              (view.weekdays || []).includes(d.key)
                                ? 'bg-blue-700 border-blue-700 text-white'
                                : 'bg-white border-gray-300 text-gray-700'
                            }`}
                          >
                            {d.short}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}

                  {view.rruleType === 'monthly' && (
                    <>
                      <Field label="Option">
                        <select disabled={readOnly} value={view.monthBy || 'date'} onChange={(e) => set({ monthBy: e.target.value })} className={inputCls}>
                          {MONTH_BY.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                      </Field>
                      {view.monthBy === 'date' ? (
                        <Field label="Date of month">
                          <input
                            type="number" min={1} max={31} disabled={readOnly}
                            value={view.day || ''}
                            onChange={(e) => set({ day: Number(e.target.value) })}
                            className={inputCls}
                          />
                        </Field>
                      ) : (
                        <>
                          <Field label="Byday">
                            <select disabled={readOnly} value={view.byday || '1'} onChange={(e) => set({ byday: e.target.value })} className={inputCls}>
                              {BYDAY.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Weekday">
                            <select disabled={readOnly} value={view.weekday || 'MON'} onChange={(e) => set({ weekday: e.target.value })} className={inputCls}>
                              {WEEKDAYS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
                            </select>
                          </Field>
                        </>
                      )}
                    </>
                  )}

                  <Field label="Until">
                    <select disabled={readOnly} value={view.endType || 'count'} onChange={(e) => set({ endType: e.target.value })} className={inputCls}>
                      {END_TYPE.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </Field>
                  {view.endType === 'count' && (
                    <Field label="Repeat">
                      <input
                        type="number" min={1} disabled={readOnly}
                        value={view.count || 1}
                        onChange={(e) => set({ count: Number(e.target.value) })}
                        className={inputCls}
                      />
                    </Field>
                  )}
                  {view.endType === 'end_date' && (
                    <Field label="End date">
                      <input
                        type="date" disabled={readOnly}
                        value={view.until ? String(view.until).slice(0, 10) : ''}
                        onChange={(e) => set({ until: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'Invitations' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Participant</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Email</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Status</th>
                    <th className="w-64" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(view.attendees || []).length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-xs">No participants</td></tr>
                  ) : (view.attendees || []).map((a) => {
                    const st = ATTENDEE_STATUS.find((s) => s.key === (a.status || 'needsAction'));
                    return (
                      <tr key={a.name}>
                        <td className="px-4 py-2 text-gray-800">{a.name}</td>
                        <td className="px-4 py-2 text-gray-600 text-xs">{a.email || ''}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${st?.badge}`}>{st?.label}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            {ATTENDEE_STATUS.filter((s) => s.key !== 'needsAction').map((s) => (
                              <button
                                key={s.key}
                                onClick={() => setStatus(a.name, s.key)}
                                className="px-2 py-0.5 border border-gray-300 rounded text-[11px] text-gray-600 hover:bg-gray-50"
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 pb-6">
          <OrganizationChatter
            organizationId={event.id}
            entries={event.activityLog || []}
            followerCount={event.followerCount || 1}
            api={calendarAPI}
            onPosted={(entry) => setEvent((e) => ({ ...e, activityLog: [entry, ...(e.activityLog || [])] }))}
          />
        </div>
      </div>

      {picker && (
        <AttendeeSearchModal
          onClose={() => setPicker(false)}
          onPick={(p) => {
            const list = draft.attendees || [];
            if (!list.some((a) => a.name === p.name)) {
              set({ attendees: [...list, { name: p.name, email: p.email || '', status: 'needsAction' }] });
            }
            setPicker(false);
          }}
        />
      )}
    </div>
  );
};

export default CalendarEventDetail;
