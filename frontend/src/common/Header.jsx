import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  Menu, Bell, User, LogOut, Settings, ChevronDown, CheckCheck, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { companiesAPI } from '../services/api';
import { formatRelative } from '../utils/helpers';

const ACTIVE_COMPANIES_KEY = 'active_company_ids';

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const { toggleSidebar, unreadCount, notifications, fetchNotifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [activeCompanyIds, setActiveCompanyIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_COMPANIES_KEY)) || []; } catch { return []; }
  });
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const companyRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (companyRef.current && !companyRef.current.contains(e.target)) setCompanyMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!isAdmin()) return;
    companiesAPI.getAll({ limit: 100 })
      .then((res) => {
        const list = res.data?.data || [];
        setCompanies(list);
        // Default to the user's own company (or the first one) being active.
        setActiveCompanyIds((prev) => {
          if (prev.length) return prev;
          const initial = list.find((c) => c.id === user?.companyId) || list[0];
          return initial ? [initial.id] : [];
        });
      })
      .catch(() => setCompanies([]));
  }, [isAdmin, user?.companyId]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_COMPANIES_KEY, JSON.stringify(activeCompanyIds));
  }, [activeCompanyIds]);

  // At least one company must stay selected, matching the live demo's behaviour.
  const toggleCompany = (id) => {
    setActiveCompanyIds((prev) => (
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev)
        : [...prev, id]
    ));
  };

  const activeCompanies = companies.filter((c) => activeCompanyIds.includes(c.id));
  const companyLabel = activeCompanies.length === 0
    ? 'Select company'
    : activeCompanies.length === 1
      ? activeCompanies[0].name
      : `${activeCompanies[0].name} +${activeCompanies.length - 1}`;

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const userName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'User';

  const initials = user?.first_name?.[0] || user?.email?.[0] || 'U';

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between h-14 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* User portal: Tracking + Events nav links */}
        {!isAdmin() && (
          <nav className="flex items-center gap-1">
            <NavLink
              to="/user/tracking"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }`
              }
            >
              Shipment Tracking
            </NavLink>
            <NavLink
              to="/user/events"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }`
              }
            >
              Events
            </NavLink>
          </nav>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Company switcher (admin) - multi-select, mirrors the CargoFlo demo */}
        {isAdmin() && companies.length > 0 && (
          <div ref={companyRef} className="relative">
            <button
              onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors max-w-[16rem]"
            >
              <span className="text-sm font-medium text-gray-700 truncate">{companyLabel}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${companyMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {companyMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 max-h-80 overflow-y-auto">
                {companies.map((c) => {
                  const checked = activeCompanyIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCompany(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                        checked ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="truncate">{c.name}</span>
                      {c.currency && <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{c.currency}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Notifications bell (admin) */}
        {isAdmin() && (
          <div ref={notifRef} className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-50 cursor-pointer ${!n.is_read ? 'bg-blue-50' : ''}`}
                        onClick={() => markNotificationRead(n.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                          <div>
                            <p className="text-sm text-gray-700">{n.message || n.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatRelative(n.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{userName}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); navigate(isAdmin() ? '/admin/settings' : '/user/profile'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <User className="w-4 h-4" />
                My Account
              </button>
              {isAdmin() && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/admin/settings'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              )}
              <div className="border-t border-gray-100 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
