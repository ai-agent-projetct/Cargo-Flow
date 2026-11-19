// Odoo domains -> Sequelize where clauses, for the og_* tables.
//
// Supports the prefix operators '&', '|', '!' (implicit AND between leaves),
// the comparison operators the agency views use, and dotted paths through
// many2one links ('repair_request_id.state'), resolved as id sub-queries.
const { Op } = require('sequelize');

const OPS = {
  '=': Op.eq, '!=': Op.ne, '<>': Op.ne, '>': Op.gt, '<': Op.lt, '>=': Op.gte, '<=': Op.lte,
  in: Op.in, 'not in': Op.notIn,
};

const isLeaf = (t) => Array.isArray(t) && t.length === 3 && typeof t[0] === 'string';

/**
 * @param {Array} domain Odoo domain
 * @param {object} ctx { model, fieldsOf(model), resolveIds(model, domain) -> ids, nameSearchIds(relation, op, value) -> ids }
 */
const toWhere = async (domain, ctx) => {
  const list = Array.isArray(domain) ? domain.filter((t) => t !== undefined) : [];
  let i = 0;
  const parse = async () => {
    const t = list[i++];
    if (t === '&' || t === '|') {
      const a = await parse();
      const b = await parse();
      return { [t === '&' ? Op.and : Op.or]: [a, b] };
    }
    if (t === '!') return { [Op.not]: await parse() };
    if (isLeaf(t)) return leaf(t, ctx);
    return {};
  };
  const parts = [];
  while (i < list.length) parts.push(await parse());
  return parts.length === 1 ? parts[0] : { [Op.and]: parts };
};

const leaf = async ([path, op, value], ctx) => {
  if (path === 1 || path === '1') return {};
  if (typeof path === 'number') return value === path ? {} : { id: null };
  const fields = ctx.fieldsOf(ctx.model);
  const [head, ...rest] = String(path).split('.');
  const f = head === 'id' ? { type: 'integer' } : fields[head];
  if (!f) return {}; // unknown field: ignore rather than fail the whole search

  // Dotted path through a link: match the target, then filter on its ids.
  if (rest.length && f.relation) {
    const ids = await ctx.resolveIds(f.relation, [[rest.join('.'), op, value]]);
    if (f.type === 'one2many') {
      const inverse = await ctx.inverseIds(f, ids);
      return { id: { [Op.in]: inverse } };
    }
    return { [head]: { [Op.in]: ids.map(String) } };
  }

  // one2many: records whose lines match.
  if (f.type === 'one2many') {
    if (op === '=' && (value === false || value === null)) return { id: { [Op.notIn]: await ctx.inverseIds(f, null) } };
    if (op === '!=' && (value === false || value === null)) return { id: { [Op.in]: await ctx.inverseIds(f, null) } };
    const ids = Array.isArray(value) ? value : [value];
    return { id: { [Op.in]: await ctx.inverseIds(f, ids) } };
  }

  // many2one compared to text is a name search on the target.
  if (f.type === 'many2one' && typeof value === 'string' && /like/.test(op)) {
    const ids = await ctx.nameSearchIds(f.relation, op, value);
    return { [head]: { [Op.in]: ids.map(String) } };
  }

  // many2many stored as a JSON id array.
  if (f.type === 'many2many') {
    const ids = (Array.isArray(value) ? value : [value]).filter((v) => v !== false && v !== null);
    if (!ids.length) return op === '!=' || op === 'not in' ? {} : { [head]: null };
    const like = ids.map((id) => ({ [head]: { [Op.like]: `%${JSON.stringify(id)}%` } }));
    return op === 'not in' || op === '!=' ? { [Op.not]: { [Op.or]: like } } : { [Op.or]: like };
  }

  const v = (x) => (f.type === 'many2one' && x !== null && x !== false ? String(x) : x);
  if (value === false && (op === '=' || op === '!=')) {
    if (f.type === 'boolean') return op === '=' ? { [Op.or]: [{ [head]: false }, { [head]: null }] } : { [head]: true };
    return op === '=' ? { [head]: null } : { [head]: { [Op.ne]: null } };
  }
  switch (op) {
    case 'like': return { [head]: { [Op.like]: `%${value}%` } };
    case 'ilike': return { [head]: { [Op.like]: `%${value}%` } };
    case 'not like':
    case 'not ilike': return { [Op.or]: [{ [head]: { [Op.notLike]: `%${value}%` } }, { [head]: null }] };
    case '=like':
    case '=ilike': return { [head]: { [Op.like]: value } };
    case 'child_of':
    case 'parent_of': return { [head]: Array.isArray(value) ? { [Op.in]: value.map(v) } : v(value) };
    case 'in':
    case 'not in': {
      const vals = (Array.isArray(value) ? value : [value]);
      const hasFalse = vals.some((x) => x === false || x === null);
      const real = vals.filter((x) => x !== false && x !== null).map(v);
      const clause = { [head]: { [OPS[op]]: real } };
      if (!hasFalse) return clause;
      return op === 'in' ? { [Op.or]: [clause, { [head]: null }] } : { [Op.and]: [clause, { [head]: { [Op.ne]: null } }] };
    }
    default:
      if (!OPS[op]) return {};
      return { [head]: { [OPS[op]]: v(value) } };
  }
};

/** Evaluate a domain against one plain record (modifiers, client parity). */
const matches = (domain, rec) => {
  const list = Array.isArray(domain) ? domain : [];
  let i = 0;
  const val = (p) => {
    const x = rec[p];
    return Array.isArray(x) && x.length === 2 && typeof x[1] === 'string' ? x[0] : x;
  };
  const test = ([p, op, v]) => {
    const x = val(p);
    const falsy = (y) => y === false || y === null || y === undefined || y === '' || (Array.isArray(y) && !y.length);
    switch (op) {
      case '=': return v === false ? falsy(x) : x == v; // eslint-disable-line eqeqeq
      case '!=': return v === false ? !falsy(x) : x != v; // eslint-disable-line eqeqeq
      case 'in': return (v || []).some((y) => (y === false ? falsy(x) : y == x)); // eslint-disable-line eqeqeq
      case 'not in': return !(v || []).some((y) => (y === false ? falsy(x) : y == x)); // eslint-disable-line eqeqeq
      case '>': return x > v;
      case '<': return x < v;
      case '>=': return x >= v;
      case '<=': return x <= v;
      case 'ilike':
      case 'like': return String(x || '').toLowerCase().includes(String(v).toLowerCase());
      default: return true;
    }
  };
  const parse = () => {
    const t = list[i++];
    if (t === '&') return parse() & parse();
    if (t === '|') { const a = parse(); const b = parse(); return a || b; }
    if (t === '!') return !parse();
    return isLeaf(t) ? test(t) : true;
  };
  let ok = true;
  while (i < list.length) ok = parse() && ok;
  return !!ok;
};

module.exports = { toWhere, matches };

if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(matches([['state', 'in', ['draft', 'x']]], { state: 'draft' }), true);
  assert.strictEqual(matches(['|', ['state', '!=', 'cro_generated'], ['allow_approval', '=', false]], { state: 'cro_generated', allow_approval: true }), false);
  assert.strictEqual(matches(['|', ['state', '!=', 'cro_generated'], ['allow_approval', '=', false]], { state: 'cro_generated', allow_approval: false }), true);
  assert.strictEqual(matches([['partner_id', '=', 5]], { partner_id: [5, 'X'] }), true);
  assert.strictEqual(matches(['!', ['a', '=', 1]], { a: 2 }), true);
  console.log('domain self-check ok');
}
