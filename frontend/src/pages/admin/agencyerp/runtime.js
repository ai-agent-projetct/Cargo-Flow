// Client runtime for the SearatesERP Agency clone: the Odoo RPC call, the
// small Python subset that action domains/contexts and view expressions use,
// and modifier evaluation. The views themselves come verbatim from upstream.
import api from '../../../services/api';

export const rpc = async (model, method, args = [], kwargs = {}) => {
  const res = await api.post('/odoo/call', { model, method, args, kwargs });
  return res.data.result;
};
export const loadMenus = async () => (await api.get('/odoo/menus')).data.result;

// ── Python literals ──────────────────────────────────────────────────────────
// "[('a', '=', 1), ('b', 'in', [True, False])]" -> JSON. Names resolve
// against `env` (uid, active_id, context...); unknown calls fail soft.
export const pyEval = (src, env = {}) => {
  if (src === null || src === undefined || src === false) return null;
  if (typeof src !== 'string') return src;
  const s = src.trim();
  if (!s) return null;
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i += 1; };
  const value = () => {
    ws();
    const c = s[i];
    if (c === '[' || c === '(') {
      const close = c === '[' ? ']' : ')';
      i += 1;
      const out = [];
      ws();
      while (s[i] !== close) {
        out.push(value());
        ws();
        if (s[i] === ',') i += 1;
        ws();
        if (i >= s.length) throw new Error('unterminated list');
      }
      i += 1;
      return out;
    }
    if (c === '{') {
      i += 1;
      const out = {};
      ws();
      while (s[i] !== '}') {
        const k = value();
        ws();
        if (s[i] !== ':') throw new Error('expected :');
        i += 1;
        out[k] = value();
        ws();
        if (s[i] === ',') i += 1;
        ws();
        if (i >= s.length) throw new Error('unterminated dict');
      }
      i += 1;
      return out;
    }
    if (c === '"' || c === "'") {
      i += 1;
      let out = '';
      while (i < s.length && s[i] !== c) {
        if (s[i] === '\\') { out += s[i + 1]; i += 2; } else { out += s[i]; i += 1; }
      }
      i += 1;
      return out;
    }
    const m = s.slice(i).match(/^-?\d+(\.\d+)?/);
    if (m) { i += m[0].length; return Number(m[0]); }
    const w = s.slice(i).match(/^[A-Za-z_][\w.]*/);
    if (w) {
      i += w[0].length;
      const name = w[0];
      ws();
      if (s[i] === '(') { // a call: skip its arguments, value unknown
        let depth = 0;
        do { if (s[i] === '(') depth += 1; if (s[i] === ')') depth -= 1; i += 1; } while (depth > 0 && i < s.length);
        if (name === 'context.get') return null;
        return null;
      }
      if (name === 'True') return true;
      if (name === 'False') return false;
      if (name === 'None') return null;
      return name.split('.').reduce((o, k) => (o == null ? undefined : o[k]), env) ?? null;
    }
    throw new Error(`cannot read "${s.slice(i, i + 12)}"`);
  };
  try {
    return value();
  } catch (e) {
    return null;
  }
};

// ── Domains and modifiers ────────────────────────────────────────────────────
const idOf = (v) => (Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' ? v[0] : v);
const falsy = (y) => y === false || y === null || y === undefined || y === '' || (Array.isArray(y) && !y.length);

export const matchDomain = (domain, rec) => {
  if (domain === true || domain === false) return domain;
  const list = Array.isArray(domain) ? domain : [];
  let i = 0;
  const test = ([p, op, v]) => {
    const x = idOf(rec[p]);
    switch (op) {
      case '=': case '==': return v === false ? falsy(x) : x == v; // eslint-disable-line eqeqeq
      case '!=': case '<>': return v === false ? !falsy(x) : x != v; // eslint-disable-line eqeqeq
      case 'in': return (v || []).some((y) => (y === false ? falsy(x) : y == x)); // eslint-disable-line eqeqeq
      case 'not in': return !(v || []).some((y) => (y === false ? falsy(x) : y == x)); // eslint-disable-line eqeqeq
      case '>': return x > v;
      case '<': return x < v;
      case '>=': return x >= v;
      case '<=': return x <= v;
      case 'like': case 'ilike': return String(x || '').toLowerCase().includes(String(v).toLowerCase());
      default: return true;
    }
  };
  const parse = () => {
    const t = list[i++];
    if (t === '&') { const a = parse(); const b = parse(); return a && b; }
    if (t === '|') { const a = parse(); const b = parse(); return a || b; }
    if (t === '!') return !parse();
    return Array.isArray(t) && t.length === 3 ? test(t) : true;
  };
  let ok = true;
  while (i < list.length) { const r = parse(); ok = ok && r; }
  return ok;
};

/** Modifiers JSON of a view node, evaluated for a record. */
export const modifiersOf = (node, rec) => {
  let mods = {};
  const raw = node.getAttribute && node.getAttribute('modifiers');
  if (raw) { try { mods = JSON.parse(raw); } catch (e) { mods = {}; } }
  const ev = (k) => (mods[k] === undefined ? false : (typeof mods[k] === 'boolean' ? mods[k] : matchDomain(mods[k], rec)));
  return {
    invisible: ev('invisible') || node.getAttribute?.('invisible') === '1',
    readonly: ev('readonly'),
    required: ev('required'),
    columnInvisible: ev('column_invisible'),
  };
};

// Tiny evaluator for decoration-* and similar view expressions:
// "state == 'draft'", "status in ('a', 'b')", "a and not b".
export const pyExpr = (expr, rec) => {
  if (!expr) return false;
  const orParts = expr.split(/\s+or\s+/);
  return orParts.some((part) => part.split(/\s+and\s+/).every((t) => {
    let term = t.trim();
    let neg = false;
    if (term.startsWith('not ')) { neg = true; term = term.slice(4).trim(); }
    const m = term.match(/^([\w.]+)\s*(==|!=|>=|<=|>|<|not in|in)\s*(.+)$/);
    let r;
    if (!m) r = !falsy(idOf(rec[term]));
    else {
      const left = idOf(rec[m[1]]);
      const right = pyEval(m[3].replace(/^\(([^)]*)\)$/, '[$1]'));
      switch (m[2]) {
        case '==': r = left == right; break; // eslint-disable-line eqeqeq
        case '!=': r = left != right; break; // eslint-disable-line eqeqeq
        case '>': r = left > right; break;
        case '<': r = left < right; break;
        case '>=': r = left >= right; break;
        case '<=': r = left <= right; break;
        case 'in': r = (right || []).includes(left); break;
        default: r = !(right || []).includes(left);
      }
    }
    return neg ? !r : r;
  }));
};

/** Save a file a button returned: text, or base64 for XLSX/PDF. */
export const saveDownload = ({ filename, mime, content, encoding }) => {
  const body = encoding === 'base64' ? Uint8Array.from(atob(content), (c) => c.charCodeAt(0)) : content;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: mime || 'application/octet-stream' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

export const parseArch = (arch) => new DOMParser().parseFromString(arch, 'text/xml').documentElement;
export const children = (node) => [...(node?.childNodes || [])].filter((n) => n.nodeType === 1);

// ── Formatting ───────────────────────────────────────────────────────────────
export const fmtNumber = (v, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
export const fmtDate = (v) => {
  if (!v) return '';
  const [y, mo, d] = String(v).slice(0, 10).split('-');
  return `${d}/${mo}/${y}`;
};
export const fmtDatetime = (v) => {
  if (!v) return '';
  const dt = new Date(`${String(v).replace(' ', 'T')}${String(v).includes('Z') ? '' : 'Z'}`);
  if (Number.isNaN(dt.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
};

/** A field value as a list cell shows it. */
export const displayCell = (field, value) => {
  if (!field) return value === false || value == null ? '' : String(value);
  switch (field.type) {
    case 'many2one': return Array.isArray(value) ? value[1] : '';
    case 'many2many': case 'one2many': return Array.isArray(value) ? `${value.length} record${value.length === 1 ? '' : 's'}` : '';
    case 'selection': return ((field.selection || []).find(([k]) => k === value) || [null, ''])[1];
    case 'boolean': return value ? '✓' : '';
    case 'monetary': return value === false || value == null ? '' : fmtNumber(value, 2);
    case 'float': return value === false || value == null ? '' : fmtNumber(value, (field.digits && field.digits[1]) ?? 2);
    case 'integer': return value === false || value == null ? '' : String(value);
    case 'date': return fmtDate(value);
    case 'datetime': return fmtDatetime(value);
    case 'binary': return value ? '(file)' : '';
    default: return value === false || value == null ? '' : String(value);
  }
};

/** Odoo write values: many2one [id, name] -> id, x2many stays commands. */
export const toWriteValue = (field, v) => {
  if (!field) return v;
  if (field.type === 'many2one') return Array.isArray(v) ? v[0] : (v || false);
  return v === undefined ? false : v;
};
