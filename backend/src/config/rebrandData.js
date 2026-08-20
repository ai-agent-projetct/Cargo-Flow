// Rewrites the old brand out of rows that were seeded before the rename.
//
// The strings live in far more places than a column list would suggest: company
// names, journal and move `company` fields, activity-log JSON, document
// payloads, email addresses, even lookup keys like the company code. Rather
// than enumerate them, sweep every text-ish column in the schema.
//
// Idempotent: REPLACE on already-renamed text is a no-op, and the whole pass is
// skipped once nothing matches.

// Order matters. Longer variants must go first, or "searatess" would first
// become "cargoflos" via the shorter "searates" rule.
const MAP = [
  ['SearatesERP (Dubai)', 'CargoFlo (Dubai)'],
  ['SearatesERP(Dubai)', 'CargoFlo (Dubai)'],
  ['SearatesERP(China)', 'CargoFlo (China)'],
  ['SearatesERP(India)', 'CargoFlo (India)'],
  ['SearatesERP(Saudi)', 'CargoFlo (Saudi)'],
  ['Searates (Malaysia)', 'CargoFlo (Malaysia)'],
  ['Searates(United Arab Emirates)', 'CargoFlo (United Arab Emirates)'],
  ['Searates(United Kingdom)', 'CargoFlo (United Kingdom)'],
  ['Searates USA', 'CargoFlo (USA)'],
  ['SEARATESERP', 'CARGOFLO'],
  ['SearatesERP', 'CargoFlo'],
  ['searateserp', 'cargoflo'],
  ['searatess', 'cargoflo'],
  ['SeaRates', 'CargoFlo'],
  ['Searates', 'CargoFlo'],
  ['searates', 'cargoflo'],
  // Company codes are lookup keys, so they have to move with the names.
  ['SR-DXB', 'CF-DXB'],
  ['SR-CN', 'CF-CN'],
  ['SR-IN', 'CF-IN'],
  ['SR-SA', 'CF-SA'],
  ['SR-MY', 'CF-MY'],
  ['SR-USA', 'CF-USA'],
  ['SR-UAE', 'CF-UAE'],
];

const TEXTUAL = new Set(['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext', 'json']);

const rebrandData = async (sequelize) => {
  const dbName = sequelize.config.database;

  // Cheap probe: if the canonical company name is already renamed and no code
  // still carries the old prefix, there is nothing to do.
  const [probe] = await sequelize.query(
    "SELECT COUNT(*) c FROM companies WHERE name LIKE '%earates%' OR code LIKE 'SR-%'"
  );
  if (!Number(probe[0].c)) return 0;

  const [columns] = await sequelize.query(
    `SELECT TABLE_NAME t, COLUMN_NAME c, DATA_TYPE d
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = :db`,
    { replacements: { db: dbName } }
  );

  let changed = 0;
  for (const col of columns) {
    if (!TEXTUAL.has(String(col.d).toLowerCase())) continue;
    for (const [from, to] of MAP) {
      // LIKE first so the UPDATE only touches rows that actually match.
      const [res] = await sequelize.query(
        `UPDATE \`${col.t}\` SET \`${col.c}\` = REPLACE(\`${col.c}\`, :from, :to)
          WHERE \`${col.c}\` LIKE :like`,
        { replacements: { from, to, like: `%${from}%` } }
      );
      changed += res?.affectedRows || 0;
    }
  }
  return changed;
};

module.exports = { rebrandData, MAP };
