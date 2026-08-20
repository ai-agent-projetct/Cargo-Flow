import React from 'react';
import UsersTab from './administration/UsersTab';

// Render the CargoFlo-style Users page (same as Administration > Companies & Users > Users)
// at the top-level /admin/users route.
const AdminUsers = () => <UsersTab basePath="/admin/users" />;

export default AdminUsers;
