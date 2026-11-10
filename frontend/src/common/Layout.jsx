import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIAssistant from './AIAssistant';
import ErrorBoundary from './ErrorBoundary';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { sidebarCollapsed } = useApp();
  const { isAdmin } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="fade-in max-w-screen-2xl mx-auto">
            {/* The boundary sits inside the shell, so a screen that fails to
                render leaves the sidebar and header usable instead of
                blanking the whole application. Keying it on the path clears
                the error as soon as the user navigates away. */}
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {isAdmin() && <AIAssistant />}
    </div>
  );
};

export default Layout;
