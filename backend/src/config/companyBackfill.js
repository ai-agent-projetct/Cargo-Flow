// Transactional rows carry the operating company as a display string but not
// as a key, so nothing can filter by it. Add the key where it is missing and
// resolve it from the name that is already stored.
//
// Idempotent: only rows with a null companyId are touched.

const TABLES = [
  'account_moves',
  'account_payments',
  'pro_forma_invoices',
  'account_assets',
];

const backfillCompanyIds = async (sequelize, qi) => {
  let added = 0;
  let linked = 0;

  for (const table of TABLES) {
    const cols = await qi.describeTable(table).catch(() => null);
    if (!cols) continue;

    if (!cols.companyId) {
      // CHAR(36) BINARY matches how the other UUID foreign keys are stored;
      // a plain CHAR(36) breaks joins against them.
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN companyId CHAR(36) BINARY NULL`);
      await sequelize.query(`CREATE INDEX ${table}_company ON \`${table}\` (companyId)`).catch(() => {});
      added += 1;
    }

    // Resolve the stored company name to its row.
    const [res] = await sequelize.query(
      `UPDATE \`${table}\` t
         JOIN companies c ON c.name = t.company
          SET t.companyId = c.id
        WHERE t.companyId IS NULL AND t.company IS NOT NULL AND t.company <> ''`
    );
    linked += res?.affectedRows || 0;
  }

  // Anything still unresolved belongs to the default operating company, which
  // is what the seeds assume when they do not say otherwise.
  const [[fallback]] = await sequelize.query(
    "SELECT id FROM companies WHERE code = 'CF-DXB' LIMIT 1"
  );
  if (fallback) {
    for (const table of TABLES) {
      const [res] = await sequelize.query(
        `UPDATE \`${table}\` SET companyId = :id WHERE companyId IS NULL`,
        { replacements: { id: fallback.id } }
      );
      linked += res?.affectedRows || 0;
    }
  }

  return { added, linked };
};

module.exports = { backfillCompanyIds, COMPANY_SCOPED_TABLES: TABLES };
