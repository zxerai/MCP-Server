import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useServerData } from '@/hooks/useServerData';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useToast } from '@/contexts/ToastContext';
import { apiPost } from '@/utils/fetchInterceptor';
import CircularProgress from '@/components/ui/CircularProgress';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { servers, error, setError, isLoading, triggerRefresh } = useServerData();
  const { installConfig, routingConfig, smartRoutingConfig } = useSettingsData();
  const { showToast } = useToast();
  const [isRestarting, setIsRestarting] = useState(false);
  
  // Get current base URL
  const getCurrentBaseUrl = () => {
    const { protocol, hostname, port } = window.location;
    const currentPort = port || (protocol === 'https:' ? '443' : '80');
    return `${protocol}//${hostname}${currentPort !== '80' && currentPort !== '443' ? ':' + currentPort : ''}`;
  };
  
  // Generate SSE endpoints
  const baseUrl = installConfig?.baseUrl || getCurrentBaseUrl();
  const sseEndpoints = {
    global: `${baseUrl}/sse`,
    smart: `${baseUrl}/sse/$smart`,
    groupExample: `${baseUrl}/sse/{group}`,
    serverExample: `${baseUrl}/sse/{server}`
  };
  
  // Copy to clipboard function
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('common.copied', { item: label }), 'success');
    } catch (err) {
      showToast(t('common.copyFailed'), 'error');
    }
  };

  // Quick action functions
  const handleAddServer = () => {
    navigate('/servers');
  };

  const handleRestartAllServices = async () => {
    if (isRestarting) return;
    
    setIsRestarting(true);
    try {
      showToast('正在重启所有服务...', 'info');
      
      // Call the restart API
      const response = await apiPost('/servers/restart-all', {});
      
      if (response && response.success) {
        showToast(response.message || '所有服务重启完成', 'success');
        
        // Wait a bit for services to fully restart, then refresh data
        setTimeout(() => {
          triggerRefresh();
        }, 1000);
      } else {
        throw new Error(response?.message || 'Failed to restart services');
      }
    } catch (error) {
      console.error('Failed to restart services:', error);
      showToast(
        error instanceof Error ? error.message : '重启服务失败', 
        'error'
      );
    } finally {
      setIsRestarting(false);
    }
  };

  // Calculate server statistics
  const serverStats = {
    total: servers.length,
    online: servers.filter(server => server.status === 'connected').length,
    offline: servers.filter(server => server.status === 'disconnected').length,
    connecting: servers.filter(server => server.status === 'connecting').length
  };

  // Map status to translation keys
  const statusTranslations = {
    connected: 'status.online',
    disconnected: 'status.offline',
    connecting: 'status.connecting'
  }

  return (
    <div className="space-y-6">
                {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
    <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('pages.dashboard.title')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">管理您的 MCP 服务器集群</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
            <span>实时更新</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass border border-error-200/50 dark:border-error-700/50 p-6 rounded-2xl animate-fade-in-down">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-error-100 dark:bg-error-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-error-600 dark:text-error-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            <div>
                <h3 className="text-error-800 dark:text-error-200 text-lg font-semibold">{t('app.error')}</h3>
                <p className="text-error-600 dark:text-error-400 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-2 text-error-400 hover:text-error-600 dark:hover:text-error-300 transition-colors duration-200 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20"
              aria-label={t('app.closeButton')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 011.414 0L10 8.586l4.293-4.293a1 1 111.414 1.414L11.414 10l4.293 4.293a1 1 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 01-1.414-1.414L8.586 10 4.293 5.707a1 1 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="glass p-8 rounded-2xl flex items-center justify-center animate-scale-in">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin"></div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">{t('app.loading')}</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
          {/* Total servers */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">{t('pages.dashboard.totalServers')}</p>
                <p className="text-2xl font-bold text-gray-900">{serverStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
            </div>
          </div>

          {/* Online servers */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">{t('pages.dashboard.onlineServers')}</p>
                <p className="text-2xl font-bold text-gray-900">{serverStats.online}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Offline servers */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">{t('pages.dashboard.offlineServers')}</p>
                <p className="text-2xl font-bold text-gray-900">{serverStats.offline}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Connecting servers */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">{t('pages.dashboard.connectingServers')}</p>
                <p className="text-2xl font-bold text-gray-900">{serverStats.connecting}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Information */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up animate-delay-200">
          {/* System Status */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">系统状态</h3>
            <div className="grid grid-cols-2 gap-4">
              <CircularProgress
                percentage={Math.round((serverStats.online / serverStats.total) * 100) || 0}
                size={100}
                color="#10b981"
                label="服务器在线率"
              />
              <CircularProgress
                percentage={75}
                size={100}
                color="#3b82f6"
                label="系统负载"
              />
            </div>
          </div>

          {/* Network Status */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">网络状态</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">网络连接</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">正常</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">HTTP服务器</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">运行中</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">WebSocket</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">1个连接</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">快速操作</h3>
            <div className="space-y-3">
              <button 
                onClick={handleAddServer}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-xl transition-colors duration-200 hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                添加服务器
              </button>
              <button 
                onClick={handleRestartAllServices}
                disabled={isRestarting}
                className={`w-full flex items-center justify-center px-4 py-3 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                  isRestarting 
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-800/40 text-green-700 dark:text-green-300'
                }`}
              >
                {isRestarting ? (
                  <>
                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    重启中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重启所有服务
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SSE Endpoints */}
      {!isLoading && (
        <div className="animate-fade-in-up animate-delay-300">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('pages.dashboard.sseEndpoints')}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t('pages.dashboard.sseEndpointsDescription')}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Global SSE Endpoint */}
            {routingConfig?.enableGlobalRoute && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t('pages.dashboard.globalEndpoint')}</h3>
                      <p className="text-sm text-gray-500">{t('pages.dashboard.globalEndpointDesc')}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 break-all">{sseEndpoints.global}</span>
                    <button
                      onClick={() => copyToClipboard(sseEndpoints.global, t('pages.dashboard.globalEndpoint'))}
                      className="ml-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex-shrink-0"
                      title={t('common.copy')}
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Routing Endpoint */}
            {smartRoutingConfig?.enabled && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t('pages.dashboard.smartEndpoint')}</h3>
                      <p className="text-sm text-gray-500">{t('pages.dashboard.smartEndpointDesc')}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-600 break-all">{sseEndpoints.smart}</span>
                    <button
                      onClick={() => copyToClipboard(sseEndpoints.smart, t('pages.dashboard.smartEndpoint'))}
                      className="ml-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex-shrink-0"
                      title={t('common.copy')}
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Group/Server Examples */}
            {routingConfig?.enableGroupNameRoute && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t('pages.dashboard.groupServerEndpoints')}</h3>
                      <p className="text-sm text-gray-500">{t('pages.dashboard.groupServerEndpointsDesc')}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-green-600 break-all">{sseEndpoints.groupExample}</span>
                      <button
                        onClick={() => copyToClipboard(sseEndpoints.groupExample, t('pages.dashboard.groupEndpoint'))}
                        className="ml-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex-shrink-0"
                        title={t('common.copy')}
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-teal-600 break-all">{sseEndpoints.serverExample}</span>
                      <button
                        onClick={() => copyToClipboard(sseEndpoints.serverExample, t('pages.dashboard.serverEndpoint'))}
                        className="ml-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex-shrink-0"
                        title={t('common.copy')}
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent activity list */}
      {servers.length > 0 && !isLoading && (
        <div className="animate-fade-in-up animate-delay-400">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{t('pages.dashboard.recentServers')}</h2>
                  <p className="text-sm text-gray-500">显示最近 {Math.min(servers.length, 5)} 个服务器</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 rounded-xl">
                <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider rounded-tl-xl">
                    {t('server.name')}
                  </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    {t('server.status')}
                  </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    {t('server.tools')}
                  </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider rounded-tr-xl">
                    {t('server.enabled')}
                  </th>
                </tr>
              </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                {servers.slice(0, 5).map((server, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                          <span>{server.name}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-medium rounded-full ${server.status === 'connected'
                          ? 'bg-green-100 text-green-800'
                        : server.status === 'disconnected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {t(statusTranslations[server.status] || server.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="font-medium">{server.tools?.length || 0}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {server.enabled !== false ? (
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 01-1.414-1.414L8.586 10 4.293 5.707a1 1 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;