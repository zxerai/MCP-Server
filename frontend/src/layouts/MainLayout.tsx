import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Content from '@/components/layout/Content';

const MainLayout: React.FC = () => {
  // 控制侧边栏展开/折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="main-layout flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* 顶部导航 */}
      <Header onToggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边导航 */}
        <Sidebar collapsed={sidebarCollapsed} />
        
        {/* 主内容区域 */}
        <Content>
          <div className="animate-fade-in-up">
            <Outlet />
          </div>
        </Content>
      </div>
    </div>
  );
};

export default MainLayout;