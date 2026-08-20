const { Op } = require('sequelize');

// Multi-company scoping.
//
// The header's company switcher picks which operating companies the user is
// currently looking at. That choice arrives as X-Active-Companies. It is a
// *narrowing* control only: whatever it asks for is intersected with the
// companies the user is actually entitled to, so it can never widen access.
//
// req.companyIds ends up as:
//   null        -> no restriction (user may see every company, none selected)
//   [ids...]    -> restrict to these
//   []          -> entitled to nothing; queries must return empty

const parseHeader = (raw) => {
  if (!raw) return null;
  const ids = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids : null;
};

const attachCompanyScope = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) { req.companyIds = null; return next(); }

    // What the user is entitled to. An empty allowedCompanyIds means "not
    // restricted", which is how existing accounts were created.
    let allowed = null;
    const raw = user.allowedCompanyIds;
    if (Array.isArray(raw) && raw.length) allowed = raw;
    else if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) allowed = parsed;
      } catch { /* a malformed value means no restriction */ }
    }

    const selected = parseHeader(req.get('X-Active-Companies'));

    if (!allowed) {
      req.companyIds = selected;           // free to look at whatever is picked
    } else if (!selected) {
      req.companyIds = allowed;            // nothing picked: everything allowed
    } else {
      req.companyIds = selected.filter((id) => allowed.includes(id));
    }

    return next();
  } catch (error) { return next(error); }
};

/**
 * Where-clause fragment for a company-scoped model. Spread into an existing
 * where object. Returns {} when there is no restriction in force.
 */
const companyWhere = (req, field = 'companyId') => {
  const ids = req?.companyIds;
  if (!ids) return {};
  // An empty entitlement must match nothing rather than everything.
  if (!ids.length) return { [field]: { [Op.in]: ['00000000-0000-0000-0000-000000000000'] } };
  return { [field]: { [Op.in]: ids } };
};

/** The company a newly created record should belong to. */
const defaultCompanyId = (req) => {
  const ids = req?.companyIds;
  if (ids && ids.length === 1) return ids[0];
  return req?.user?.defaultCompanyId || req?.user?.companyId || null;
};

module.exports = { attachCompanyScope, companyWhere, defaultCompanyId };
