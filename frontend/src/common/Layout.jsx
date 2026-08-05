import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIAssistant from './AIAssistant';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { sidebarCollapsed } = useApp();
  const { isAdmin } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="fade-in max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {isAdmin() && <AIAssistant />}
    </div>
  );
};

export default Layout;
