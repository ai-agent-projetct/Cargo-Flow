import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { accessAPI } from '../services/api';

// Holds the signed-in user's effective permissions so views can hide what they
// would only be refused on, and so a denial can be rendered as the ERP's
// Warning dialog rather than a bare error.
const PermissionContext = createContext(null);

export const PermissionProvider = ({ children }) => {
  const [state, setState] = useState({ loading: true, superuser: false, ownDocumentsOnly: false, groups: [], permissions: {} });
  // The Warning dialog: { model, label, action, message }
  const [denial, setDenial] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await accessAPI.me();
      setState({ loading: false, ...res.data.data });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('access_token')) refresh();
    else setState((s) => ({ ...s, loading: false }));
  }, [refresh]);

  const can = useCallback((model, action = 'read') => {
    if (state.superuser) return true;
    return !!state.permissions?.[model]?.[action];
  }, [state]);

  // Wrap any API call: a 403 carrying accessDenied opens the Warning dialog.
  const guard = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (err) {
      const d = err.response?.data;
      if (err.response?.status === 403 && d?.accessDenied) {
        setDenial({ ...d.accessDenied, message: d.message });
        return null;
      }
      throw err;
    }
  }, []);

  return (
    <PermissionContext.Provider value={{ ...state, can, refresh, denial, setDenial, guard }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used inside PermissionProvider');
  return ctx;
};

export default PermissionContext;
