require('dotenv').config();
const { sequelize } = require('./src/config/database');
const User = require('./src/models/User');
const Company = require('./src/models/Company');

// Creates (or resets) two local demo logins.
//
// Credentials come from the environment so none are committed. Set them in
// backend/.env, or pass them inline:
//
//   DEMO_ADMIN_EMAIL=me@example.com DEMO_ADMIN_PASSWORD=... node createDemoUsers.js
//
// Falls back to the standard CargoFlo seed accounts when unset.
const DEMO_USERS = [
  {
    label: 'Admin',
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@cargoflo.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@123',
    name: process.env.DEMO_ADMIN_NAME || 'Demo Admin',
    role: 'admin',
  },
  {
    label: 'User',
    email: process.env.DEMO_USER_EMAIL || 'user@cargoflo.com',
    password: process.env.DEMO_USER_PASSWORD || 'User@123',
    name: process.env.DEMO_USER_NAME || 'Demo User',
    role: 'user',
  },
];

(async () => {
  try {
    await sequelize.authenticate();

    const company = (await Company.findOne({ where: { code: 'CFLO' } })) || (await Company.findOne());

    for (const demo of DEMO_USERS) {
      const [record, created] = await User.findOrCreate({
        where: { email: demo.email },
        defaults: {
          name: demo.name,
          email: demo.email,
          password: demo.password,
          role: demo.role,
          companyId: company ? company.id : null,
          status: 'active',
        },
      });

      if (!created) {
        // Reset an existing account back to a known-good state.
        record.password = demo.password;
        record.role = demo.role;
        record.status = 'active';
        await record.save();
      }

      console.log(`${demo.label}: ${demo.email} (${created ? 'created' : 'reset'})`);
    }

    console.log('\nDemo users ready. Passwords are whatever you configured in the environment.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
