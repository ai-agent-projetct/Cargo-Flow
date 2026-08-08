const { Op } = require('sequelize');
const { CalendarEvent, MasterDataItem, Organization, Customer, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const actorName = (req) =>
  req.user?.name
  || [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ')
  || req.user?.email
  || 'Administrator';

const logEntry = (author, body, changes = []) => ({
  at: new Date().toISOString(), author, kind: 'log', body, changes,
});

const pushLog = (record, entry) => [entry, ...(record.activityLog || [])];

// Blank dates arrive as '' from the form and MySQL rejects them.
const DATE_FIELDS = ['start', 'stop', 'until'];
const normalise = (body) => {
  const out = { ...body };
  DATE_FIELDS.forEach((f) => { if (out[f] === '') out[f] = null; });
  return out;
};

const withMeta = (record) => ({
  ...record.toJSON(),
  durationLabel: record.durationLabel(),
});

// The calendar grid asks for a window; the list view asks for a page.
exports.getAll = async (req, res, next) => {
  try {
    const { from, to, search, attendee, privacy, showAs, organizer, all } = req.query;

    const where = { active: true };
    if (from && to) {
      // Any event overlapping the window, so multi-hour events show on both edges.
      where.start = { [Op.lt]: new Date(to) };
      where.stop = { [Op.gt]: new Date(from) };
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { organizer: { [Op.like]: `%${search}%` } },
      ];
    }
    if (privacy) where.privacy = privacy;
    if (showAs) where.showAs = showAs;
    if (organizer) where.organizer = organizer;

    // Attendee filter lives in JSON, so match on the serialized label.
    if (attendee) {
      where.attendees = { [Op.like]: `%${attendee}%` };
    }

    if (all === 'true' || (from && to)) {
      const rows = await CalendarEvent.findAll({ where, order: [['start', 'DESC']] });
      return successResponse(res, rows, 'Events retrieved');
    }

    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await CalendarEvent.findAndCountAll({
      where, order: [['start', 'DESC']], limit, offset,
    });
    return successResponse(res, rows, 'Events retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    return successResponse(res, withMeta(record), 'Event retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const author = actorName(req);
    const record = await CalendarEvent.create({
      ...normalise(req.body),
      organizer: req.body.organizer || author,
      organizerId: req.user?.id || null,
      createdBy: req.user?.id || null,
      activityLog: [logEntry(author, 'Calendar Event created')],
    });
    return successResponse(res, withMeta(record), 'Event created', 201);
  } catch (error) {
    next(error);
  }
};

const TRACKED_FIELDS = {
  name: 'Meeting Subject',
  start: 'Starting at',
  stop: 'Ending At',
  location: 'Location',
  videocallLocation: 'Meeting URL',
  privacy: 'Privacy',
  showAs: 'Show as',
  organizer: 'Organizer',
};

exports.update = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);

    const patch = normalise(req.body);
    const changes = Object.entries(TRACKED_FIELDS)
      .filter(([f]) => f in patch && String(patch[f] ?? '') !== String(record[f] ?? ''))
      .map(([f, label]) => ({ field: label, from: record[f] || '', to: patch[f] || '' }));

    const { activityLog, ...rest } = patch;
    await record.update({
      ...rest,
      ...(changes.length ? { activityLog: pushLog(record, logEntry(actorName(req), '', changes)) } : {}),
    });
    return successResponse(res, withMeta(record), 'Event updated');
  } catch (error) {
    next(error);
  }
};

// Dragging or resizing an event on the grid only moves its times.
exports.reschedule = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    const { start, stop, allday } = req.body;
    const before = record.start;
    await record.update({
      start: start || record.start,
      stop: stop || record.stop,
      ...(allday !== undefined ? { allday } : {}),
      activityLog: pushLog(record, logEntry(actorName(req), '', [
        { field: 'Starting at', from: before, to: start || record.start },
      ])),
    });
    return successResponse(res, withMeta(record), 'Event rescheduled');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    await record.destroy();
    return successResponse(res, null, 'Event deleted');
  } catch (error) {
    next(error);
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    const source = await CalendarEvent.findByPk(req.params.id);
    if (!source) return errorResponse(res, 'Event not found', 404);
    const { id, createdAt, updatedAt, activityLog, ...rest } = source.toJSON();
    const copy = await CalendarEvent.create({
      ...rest,
      name: `${source.name} (copy)`,
      createdBy: req.user?.id || null,
      activityLog: [logEntry(actorName(req), `Duplicated from ${source.name}`)],
    });
    return successResponse(res, withMeta(copy), 'Event duplicated', 201);
  } catch (error) {
    next(error);
  }
};

// "Send Invitations" / "EMAIL" — both just record that invitations went out,
// which is all the demo surfaces without a live mail server.
exports.sendInvitations = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    const names = (record.attendees || []).map((a) => a.name).join(', ');
    if (!names) return errorResponse(res, 'This meeting has no attendees to invite', 400);
    await record.update({
      activityLog: pushLog(record, logEntry(actorName(req), `Invitation sent to ${names}`)),
    });
    return successResponse(res, withMeta(record), 'Invitations sent');
  } catch (error) {
    next(error);
  }
};

// Participants accept/decline from the Invitations tab.
exports.setAttendeeStatus = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    const { name, status } = req.body;
    const next_ = (record.attendees || []).map((a) => (a.name === name ? { ...a, status } : a));
    await record.update({
      attendees: next_,
      activityLog: pushLog(record, logEntry(actorName(req), `${name} — ${status}`)),
    });
    return successResponse(res, withMeta(record), 'Attendee status updated');
  } catch (error) {
    next(error);
  }
};

exports.addActivity = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    const entry = {
      at: new Date().toISOString(),
      author: actorName(req),
      kind: req.body.kind || 'message',
      body: req.body.body || '',
      changes: [],
    };
    await record.update({ activityLog: pushLog(record, entry) });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};

// Reminders + Tags picklists for the form.
exports.getPicklists = async (req, res, next) => {
  try {
    const rows = await MasterDataItem.findAll({
      where: { category: { [Op.in]: ['calendar-alarms', 'calendar-tags'] }, isActive: true },
      order: [['name', 'ASC']],
    });
    return successResponse(res, {
      alarms: rows.filter((r) => r.category === 'calendar-alarms').map((r) => r.name),
      tags: rows.filter((r) => r.category === 'calendar-tags').map((r) => r.name),
    }, 'Picklists retrieved');
  } catch (error) {
    next(error);
  }
};

// The "Search: Attendees" modal — a partner picker over organizations, with
// the customer rows folded in so every party in the system is reachable.
exports.searchAttendees = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { search } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { country: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Organization.findAndCountAll({
      where,
      attributes: ['id', 'customerCode', 'name', 'phone', 'email', 'city', 'country', 'companyName'],
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    const data = rows.map((o) => ({
      id: o.id,
      name: o.customerCode ? `${o.customerCode}: ${o.name}` : o.name,
      phone: o.phone || '',
      email: o.email || '',
      salesperson: '',
      nextActivity: '',
      city: o.city || '',
      country: o.country || '',
      company: o.companyName || '',
    }));

    return successResponse(res, data, 'Attendees retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// The Attendees sidebar lists everyone who organizes or attends meetings.
exports.getCalendarPeople = async (req, res, next) => {
  try {
    const rows = await CalendarEvent.findAll({
      attributes: ['organizer', 'attendees'],
      where: { active: true },
      raw: true,
    });
    const set = new Map();
    rows.forEach((r) => {
      if (r.organizer) set.set(r.organizer, (set.get(r.organizer) || 0) + 1);
      const list = typeof r.attendees === 'string' ? JSON.parse(r.attendees || '[]') : (r.attendees || []);
      list.forEach((a) => { if (a?.name) set.set(a.name, (set.get(a.name) || 0) + 1); });
    });
    const people = [...set.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return successResponse(res, people, 'People retrieved');
  } catch (error) {
    next(error);
  }
};

// The Document button resolves the linked source record to a route the SPA can open.
const ROUTE_BY_MODEL = {
  'house.shipment': '/admin/house-shipments',
  'prospect.lead': '/admin/opportunities',
  'opportunity': '/admin/opportunities',
  'quotation': '/admin/quotations',
  'organization': '/admin/organizations',
  'sale.target': '/admin/reports',
};

exports.resolveDocument = async (req, res, next) => {
  try {
    const record = await CalendarEvent.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Event not found', 404);
    if (!record.resModel) return errorResponse(res, 'This meeting is not linked to a document', 404);

    const base = ROUTE_BY_MODEL[record.resModel];
    if (!base) return errorResponse(res, `No view for ${record.resModel}`, 404);

    return successResponse(res, {
      resModel: record.resModel,
      resName: record.resName || record.name,
      // Search the target list by the meeting's subject, which is the doc's reference.
      route: record.resId ? `${base}/${record.resId}` : `${base}?search=${encodeURIComponent(record.name)}`,
    }, 'Document resolved');
  } catch (error) {
    next(error);
  }
};
