// Tables and reference data for the Agency clone.
//
// Tables: CREATE TABLE IF NOT EXISTS per model, then any upstream field the
// table lacks is added as a column. Reference data: the instance's own master
// records (agency-masters.json), loaded once into empty tables with their
// upstream ids, so action domains such as shipment_type_id = 1 mean exactly
// what they mean upstream.
const R = require('./registry');

const ensureOdooTables = async (sequelize) => {
  const qi = sequelize.getQueryInterface();
  for (const [m, Model] of Object.entries(R.MODELS)) {
    await Model.sync();
    const cols = await qi.describeTable(R.tableOf(m));
    for (const [name, attr] of Object.entries(Model.rawAttributes)) {
      if (cols[name]) continue;
      await qi.addColumn(R.tableOf(m), name, { type: attr.type, allowNull: true });
    }
  }
  await R.OgRef.sync();
  console.log(`  Agency clone tables ready (${Object.keys(R.MODELS).length} models)`);
};

const toRow = (m, rec) => {
  const fields = R.fieldsOf(m);
  const row = { id: rec.id, x_display: rec.display_name || null };
  for (const [k, f] of R.storedFields(m)) {
    if (!(k in rec)) continue;
    let v = rec[k];
    if (v === false) v = f.type === 'boolean' ? false : null;
    else if (f.type === 'many2one') v = Array.isArray(v) ? String(v[0]) : (v == null ? null : String(v));
    else if (f.type === 'datetime' && v) v = new Date(`${String(v).replace(' ', 'T')}Z`);
    row[k] = v;
  }
  void fields;
  return row;
};

const seedOdooMasters = async () => {
  const data = R.MASTER_DATA;
  if (!data || !data.records) {
    console.log('  Agency clone: no agency-masters.json yet - reference data not loaded');
    return;
  }
  let own = 0;
  let refs = 0;
  for (const [m, rows] of Object.entries(data.records)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    if (R.isOwn(m)) {
      const Model = R.MODELS[m];
      if (await Model.count()) continue;
      for (let i = 0; i < rows.length; i += 500) {
        await Model.bulkCreate(rows.slice(i, i + 500).map((r) => toRow(m, r)), { validate: false });
      }
      own += rows.length;
    } else if (!R.isExternal(m)) {
      if (await R.OgRef.count({ where: { model: m } })) continue;
      const shaped = rows.map((r) => {
        const d = {};
        for (const [k, v] of Object.entries(r)) d[k] = Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' ? v[0] : v;
        return { model: m, ref_id: String(r.id), name: r.display_name || r.name || String(r.id), data: d };
      });
      for (let i = 0; i < shaped.length; i += 500) await R.OgRef.bulkCreate(shaped.slice(i, i + 500));
      refs += rows.length;
    }
  }
  console.log(`  Agency clone masters: ${own} records, ${refs} reference rows`);
};

module.exports = { ensureOdooTables, seedOdooMasters };
