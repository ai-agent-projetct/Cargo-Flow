import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { notificationsAPI } from '../services/api';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalLoading, setGlobalLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnreadCount(response.data.data?.count || 0);
    } catch {
      // silent - not critical
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationsAPI.getAll({ limit: 10 });
      setNotifications(response.data.data?.notifications || []);
    } catch {
      // silent
    }
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  // Poll for notifications every 60 seconds
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return (
    <AppContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        notifications,
        unreadCount,
        fetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        globalLoading,
        setGlobalLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export default AppContext;
