// Global runtime configuration interface
export interface RuntimeConfig {
  basePath: string;
  version: string;
  name: string;
  readonly?: boolean;
}

// Extend Window interface to include runtime config
declare global {
  interface Window {
    __MCPSERVER_CONFIG__?: RuntimeConfig;
  }
}

export {};
