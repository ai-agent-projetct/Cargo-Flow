// Portal scoping.
//
// The screens under /user are customer-facing: a portal login should see its
// own quotations, shipments, jobs and invoices and nobody else's. The frontend
// already asked for this by sending my_invoices / my_shipments, but nothing
// acted on it, so the portal returned every customer's records.
//
// Scoping is driven by the link on the account, not by the role name: a user
// with customerId set is narrowed to that customer, and a staff account with no
// link is left alone. That way adding the link is what turns scoping on, and no
// existing staff behaviour changes.

/**
 * Where-clause fragment narrowing to the caller's customer.
 * Returns {} for staff accounts.
 *
 * @param {object} req
 * @param {string} field  column holding the customer key on this model
 */
const portalWhere = (req, field = 'customerId') => {
  const id = req.user?.customerId;
  if (!id) return {};
  return { [field]: id };
};

/** True when this request comes from a portal login. */
const isPortalUser = (req) => !!req.user?.customerId;

/**
 * Guard for a single record: a portal user may only touch rows belonging to
 * their own customer.
 */
const ownsRecord = (req, record, field = 'customerId') => {
  const id = req.user?.customerId;
  if (!id) return true;
  if (!record) return false;
  return String(record[field] || '') === String(id);
};

module.exports = { portalWhere, isPortalUser, ownsRecord };
