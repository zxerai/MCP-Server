import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissionCheck } from '../PermissionChecker';
import UserProfileMenu from '@/components/ui/UserProfileMenu';

interface SidebarProps {
  collapsed: boolean;
}

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { t } = useTranslation();
  const { auth } = useAuth();

  // Application version from package.json (accessed via Vite environment variables)
  const appVersion = import.meta.env.PACKAGE_VERSION as string;

  // Menu item configuration
  const menuItems: MenuItem[] = [
    {
      path: '/',
      label: t('nav.dashboard'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
          <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
        </svg>
      ),
    },
    {
      path: '/servers',
      label: t('nav.servers'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 11-2 0 1 1 0 012 0zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      path: '/groups',
      label: t('nav.groups'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      ),
    },
    ...(auth.user?.isAdmin && usePermissionCheck('x') ? [{
      path: '/users',
      label: t('nav.users'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    }] : []),
    {
      path: '/market',
      label: t('nav.market'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      ),
    },
    {
      path: '/logs',
      label: t('nav.logs'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`bg-gradient-to-b from-blue-800 via-blue-900 to-blue-950 dark:from-gray-800 dark:via-gray-900 dark:to-gray-950 transition-all duration-300 ease-in-out flex flex-col h-full relative shadow-xl ${collapsed ? 'w-16' : 'w-64'
        }`}
    >
      {/* Logo/Brand area */}
      {!collapsed && (
        <div className="p-6 border-b border-blue-700/30 dark:border-gray-700/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 dark:from-gray-400 dark:to-gray-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">MCP Server</h1>
              <p className="text-blue-300 text-xs">v{appVersion}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable navigation area */}
      <div className="overflow-y-auto flex-grow">
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
                                className={({ isActive }) =>
                    `group flex items-center px-4 py-3 rounded-2xl transition-all duration-200 relative
              ${isActive
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-gray-600 dark:to-gray-700 text-white shadow-lg'
                      : 'text-blue-200 dark:text-gray-300 hover:text-white hover:bg-blue-800/50 dark:hover:bg-gray-800/50'}`
                  }
              end={item.path === '/'}
            >
              {({ isActive }) => (
                <>
                  <span className={`flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="ml-3 font-medium">
                      {item.label}
                    </span>
                  )}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full opacity-80" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

                {/* User profile menu fixed at the bottom */}
          <div className="p-4 border-t border-blue-700/30 dark:border-gray-700/30">
            <UserProfileMenu collapsed={collapsed} version={appVersion} />
          </div>
    </aside>
  );
};

export default Sidebar;