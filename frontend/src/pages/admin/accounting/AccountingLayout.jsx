import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ACCOUNTING_MENU } from './menu';

// Accounting top bar. Dashboard navigates directly; the other five open
// dropdowns, matching the demo.
const AccountingLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const go = (href) => { setOpen(null); navigate(href); };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-1 px-4 py-2 overflow-visible flex-wrap relative" ref={ref}>
          <h1 className="text-2xl font-bold text-gray-900 mr-4">Accounting</h1>

          {ACCOUNTING_MENU.map((m) => {
            const active = m.href
              ? pathname === m.href
              : (m.groups || []).some((g) => g.items.some((i) => pathname.startsWith(i.href)));
            return (
              <div key={m.label} className="relative">
                <button
                  onClick={() => (m.href ? go(m.href) : setOpen(open === m.label ? null : m.label))}
                  className={`px-3 py-1.5 text-sm rounded ${
                    active || open === m.label ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {m.label}
                </button>

                {open === m.label && m.groups && (
                  <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[15rem] max-h-[70vh] overflow-y-auto">
                    {m.groups.map((g) => (
                      <div key={g.title || 'root'}>
                        {g.title && (
                          <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            {g.title}
                          </p>
                        )}
                        {g.items.map((i) => (
                          <button
                            key={i.href}
                            onClick={() => go(i.href)}
                            className="w-full text-left px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {i.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default AccountingLayout;
