import React from 'react';
import { useTranslation } from 'react-i18next';
import ThemeSwitch from '@/components/ui/ThemeSwitch';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import GitHubIcon from '@/components/icons/GitHubIcon';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { t } = useTranslation();

  return (
    <header className="bg-gradient-to-r from-slate-800/90 via-purple-800/70 to-slate-800/90 dark:from-gray-900/95 dark:via-gray-800/90 dark:to-gray-900/95 backdrop-blur-xl border-b border-white/20 dark:border-gray-700/50 z-10 sticky top-0 shadow-lg">
      <div className="flex justify-between items-center px-4 py-3">
        <div className="flex items-center">
          {/* 侧边栏切换按钮 */}
          <button
            onClick={onToggleSidebar}
            className="group p-2.5 rounded-xl text-white/80 hover:text-blue-400 hover:bg-white/10 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 hover:scale-105"
            aria-label={t('app.toggleSidebar')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 应用标题 */}
          <div className="ml-4 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-soft">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t('app.title')}
            </h1>
          </div>
        </div>

        {/* Theme Switch and Language Switcher and Version */}
        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-gray-100/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {import.meta.env.PACKAGE_VERSION === 'dev'
                ? import.meta.env.PACKAGE_VERSION
                : `v${import.meta.env.PACKAGE_VERSION}`}
            </span>
          </div>

          <a
            href="https://github.com/samanhappy/mcphub"
            target="_blank"
            rel="noopener noreferrer"
            className="group p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            aria-label="GitHub Repository"
          >
            <GitHubIcon className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
          </a>
          <ThemeSwitch />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
};

export default Header;