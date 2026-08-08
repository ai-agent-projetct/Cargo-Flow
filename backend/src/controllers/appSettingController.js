const { AppSetting } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

const MASK = '••••••••••••';

// Settings come back grouped by pane: { freight_booking: { cargoai_enabled: true, … } }
exports.getAll = async (req, res, next) => {
  try {
    const rows = await AppSetting.findAll({ order: [['category', 'ASC'], ['key', 'ASC']] });
    const out = {};
    const secrets = [];
    rows.forEach((r) => {
      out[r.category] = out[r.category] || {};
      // A stored secret is reported as set, never echoed back.
      out[r.category][r.key] = r.isSecret && r.value ? MASK : r.typed();
      if (r.isSecret) secrets.push(`${r.category}.${r.key}`);
    });
    return successResponse(res, { settings: out, secrets }, 'Settings retrieved');
  } catch (error) {
    next(error);
  }
};

// Save accepts the same grouped shape and upserts each leaf.
exports.bulkUpdate = async (req, res, next) => {
  try {
    const payload = req.body?.settings;
    if (!payload || typeof payload !== 'object') {
      return errorResponse(res, 'settings object is required', 400);
    }

    let changed = 0;
    for (const [category, entries] of Object.entries(payload)) {
      if (!entries || typeof entries !== 'object') continue;
      for (const [key, raw] of Object.entries(entries)) {
        const existing = await AppSetting.findOne({ where: { category, key } });
        // Never overwrite a stored secret with the mask the UI showed.
        if (existing?.isSecret && raw === MASK) continue;

        const kind = typeof raw === 'boolean' ? 'bool'
          : typeof raw === 'number' ? 'number'
            : existing?.kind || 'text';
        const value = raw === null || raw === undefined ? null : String(raw);

        if (existing) {
          if (existing.value !== value) { await existing.update({ value, kind }); changed += 1; }
        } else {
          await AppSetting.create({ category, key, value, kind });
          changed += 1;
        }
      }
    }
    return successResponse(res, { changed }, `${changed} setting${changed === 1 ? '' : 's'} saved`);
  } catch (error) {
    next(error);
  }
};

// Activate / Deactivate on an integration card.
exports.toggleIntegration = async (req, res, next) => {
  try {
    const { category, key } = req.params;
    const enable = req.body.enabled !== false;
    const [row] = await AppSetting.findOrCreate({
      where: { category, key },
      defaults: { category, key, kind: 'bool', value: String(enable) },
    });
    await row.update({ value: String(enable), kind: 'bool' });
    return successResponse(res, { category, key, enabled: enable },
      enable ? 'Integration activated' : 'Integration deactivated');
  } catch (error) {
    next(error);
  }
};

module.exports.MASK = MASK;
