// Calendar > Meetings — selections and date helpers shared by every view.

export const SCALES = ['Day', 'Week', 'Month', 'Year'];

export const PRIVACY = [
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
  { key: 'confidential', label: 'Only internal users' },
];

export const SHOW_AS = [
  { key: 'free', label: 'Available' },
  { key: 'busy', label: 'Busy' },
];

export const RRULE_TYPE = [
  { key: 'daily', label: 'Days' },
  { key: 'weekly', label: 'Weeks' },
  { key: 'monthly', label: 'Months' },
  { key: 'yearly', label: 'Years' },
];

export const END_TYPE = [
  { key: 'count', label: 'Number of repetitions' },
  { key: 'end_date', label: 'End date' },
  { key: 'forever', label: 'Forever' },
];

export const MONTH_BY = [
  { key: 'date', label: 'Date of month' },
  { key: 'day', label: 'Day of month' },
];

export const BYDAY = [
  { key: '1', label: 'First' },
  { key: '2', label: 'Second' },
  { key: '3', label: 'Third' },
  { key: '4', label: 'Fourth' },
  { key: '-1', label: 'Last' },
];

export const WEEKDAYS = [
  { key: 'MON', label: 'Monday', short: 'Mon' },
  { key: 'TUE', label: 'Tuesday', short: 'Tue' },
  { key: 'WED', label: 'Wednesday', short: 'Wed' },
  { key: 'THU', label: 'Thursday', short: 'Thu' },
  { key: 'FRI', label: 'Friday', short: 'Fri' },
  { key: 'SAT', label: 'Saturday', short: 'Sat' },
  { key: 'SUN', label: 'Sunday', short: 'Sun' },
];

export const RECURRENCE_UPDATE = [
  { key: 'self_only', label: 'This event' },
  { key: 'future_events', label: 'This and following events' },
  { key: 'all_events', label: 'All events' },
];

export const ATTENDEE_STATUS = [
  { key: 'needsAction', label: 'Needs Action', badge: 'bg-gray-100 text-gray-700' },
  { key: 'tentative', label: 'Uncertain', badge: 'bg-amber-100 text-amber-800' },
  { key: 'declined', label: 'Declined', badge: 'bg-red-100 text-red-700' },
  { key: 'accepted', label: 'Accepted', badge: 'bg-green-100 text-green-700' },
];

export const FILTERS = [
  { key: 'showAs=busy', label: 'Busy' },
  { key: 'showAs=free', label: 'Available' },
  { key: 'privacy=public', label: 'Public' },
  { key: 'privacy=private', label: 'Private' },
];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// ── date helpers ────────────────────────────────────────────────────────────
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// The demo's weeks run Sunday → Saturday.
export const startOfWeek = (d) => addDays(startOfDay(d), -startOfDay(d).getDay());

// ISO-ish week number, matching the "Week 31" label in the demo.
export const weekNumber = (d) => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
};

// Month grid always renders 6 weeks so the layout doesn't jump between months.
export const monthGrid = (d) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
};

export const pad = (n) => String(n).padStart(2, '0');

export const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const fmtTime = (v) => {
  const d = new Date(v);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// float_time: 1.5 -> "01:30"
export const fmtDuration = (hours) => {
  const h = Math.floor(hours || 0);
  const m = Math.round(((hours || 0) - h) * 60);
  return `${pad(h)}:${pad(m)}`;
};

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not an ISO UTC string.
export const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// The calendar colours events by attendee, like color="partner_ids".
const PALETTE = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
];
export const colorFor = (key) => {
  const s = String(key || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 997;
  return PALETTE[h % PALETTE.length];
};

export const initials = (name) => (name || '?').replace(/^[A-Z0-9-]+:\s*/, '').trim()[0]?.toUpperCase() || '?';

// Title in the toolbar changes shape per scale.
export const titleFor = (scale, cursor) => {
  const m = MONTH_NAMES[cursor.getMonth()];
  if (scale === 'Day') return `${m} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  if (scale === 'Week') {
    const s = startOfWeek(cursor); const e = addDays(s, 6);
    const sm = MONTH_NAMES[s.getMonth()].slice(0, 3);
    const em = MONTH_NAMES[e.getMonth()].slice(0, 3);
    return s.getMonth() === e.getMonth()
      ? `${sm} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`
      : `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (scale === 'Month') return `${m} ${cursor.getFullYear()}`;
  return `${cursor.getFullYear()}`;
};

// The window the grid asks the API for.
export const rangeFor = (scale, cursor) => {
  if (scale === 'Day') return [startOfDay(cursor), addDays(startOfDay(cursor), 1)];
  if (scale === 'Week') return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)];
  if (scale === 'Month') {
    const g = monthGrid(cursor);
    return [g[0][0], addDays(g[5][6], 1)];
  }
  return [new Date(cursor.getFullYear(), 0, 1), new Date(cursor.getFullYear() + 1, 0, 1)];
};
