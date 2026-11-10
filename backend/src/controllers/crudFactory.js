// CRUD handlers for the plain list-and-form models introduced by the
// Sales & CRM wave (stages, teams, targets, quote templates, prospects).
//
// These five screens are list, search, filter, paginate, create, update,
// delete and nothing more, so they share one set of handlers instead of five
// copies of the same seventy lines. Anything with real actions on it - leads,
// rate requests, PDCs, charge lines - gets its own controller.
//
// ponytail: a factory, because there are five callers. A sixth plain list
// should use it too; anything that needs a state machine should not.

const { Op } = require('sequelize');
const {
  successResponse, errorResponse, getPagination, getPaginationMeta,
} = require('../utils/helpers');

/**
 * @param {object} cfg
 * @param {import('sequelize').Model} cfg.model
 * @param {string} cfg.label human name used in response messages
 * @param {string[]} [cfg.searchFields] columns the `search` query hits
 * @param {string[]} [cfg.filterFields] columns an exact-match query filters on
 * @param {Array} [cfg.order] default ordering
 * @param {Array} [cfg.include] associations to eager-load on list and detail
 * @param {Array} [cfg.detailInclude] associations only loaded on detail
 * @param {(req:object)=>object} [cfg.scope] extra where clause per request
 * @param {(body:object, req:object)=>object} [cfg.beforeWrite] shape the payload
 * @param {(record:object, req:object)=>Promise<void>} [cfg.afterWrite]
 * @param {(record:object)=>string|null} [cfg.guardDelete] return a reason to refuse
 */
const crudController = (cfg) => {
  const {
    model, label, searchFields = ['name'], filterFields = [],
    order = [['createdAt', 'DESC']], include = [], detailInclude = null,
    scope = null, beforeWrite = null, afterWrite = null, guardDelete = null,
  } = cfg;

  const whereFor = (req) => {
    const where = { ...(scope ? scope(req) : {}) };
    const { search } = req.query;

    for (const field of filterFields) {
      const v = req.query[field];
      if (v === undefined || v === '') continue;
      if (v === 'true' || v === 'false') where[field] = v === 'true';
      else if (String(v).includes(',')) where[field] = { [Op.in]: String(v).split(',') };
      else where[field] = v;
    }

    if (search && searchFields.length) {
      where[Op.or] = searchFields.map((f) => ({ [f]: { [Op.like]: `%${search}%` } }));
    }
    return where;
  };

  return {
    getAll: async (req, res, next) => {
      try {
        const { page, limit, offset } = getPagination(req.query);
        // `limit=all` is what the lookup dropdowns use - they need every row,
        // not the first page of one.
        const unpaged = req.query.limit === 'all';
        const query = {
          where: whereFor(req),
          order,
          include,
          distinct: true,
        };
        if (!unpaged) Object.assign(query, { limit, offset });

        const { count, rows } = await model.findAndCountAll(query);
        return successResponse(
          res, rows, `${label} retrieved`, 200,
          unpaged ? null : getPaginationMeta(count, page, limit),
        );
      } catch (error) {
        next(error);
      }
    },

    getById: async (req, res, next) => {
      try {
        const record = await model.findByPk(req.params.id, {
          include: detailInclude || include,
        });
        if (!record) return errorResponse(res, `${label} not found`, 404);
        return successResponse(res, record, `${label} retrieved`);
      } catch (error) {
        next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const payload = beforeWrite ? beforeWrite(req.body, req) : req.body;
        const record = await model.create(payload);
        if (afterWrite) await afterWrite(record, req);
        const fresh = await model.findByPk(record.id, { include: detailInclude || include });
        return successResponse(res, fresh, `${label} created`, 201);
      } catch (error) {
        next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const record = await model.findByPk(req.params.id);
        if (!record) return errorResponse(res, `${label} not found`, 404);
        const payload = beforeWrite ? beforeWrite(req.body, req) : req.body;
        // The primary key is never taken from the body - a stale form must not
        // be able to rewrite which row it is editing.
        delete payload.id;
        await record.update(payload);
        if (afterWrite) await afterWrite(record, req);
        const fresh = await model.findByPk(record.id, { include: detailInclude || include });
        return successResponse(res, fresh, `${label} updated`);
      } catch (error) {
        next(error);
      }
    },

    remove: async (req, res, next) => {
      try {
        const record = await model.findByPk(req.params.id);
        if (!record) return errorResponse(res, `${label} not found`, 404);
        if (guardDelete) {
          const reason = await guardDelete(record, req);
          if (reason) return errorResponse(res, reason, 409);
        }
        await record.destroy();
        return successResponse(res, null, `${label} deleted`);
      } catch (error) {
        next(error);
      }
    },
  };
};

module.exports = { crudController };
