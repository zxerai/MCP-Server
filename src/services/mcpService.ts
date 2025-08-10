import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ServerInfo, ServerConfig, ToolInfo } from '../types/index.js';
import { loadSettings, saveSettings, expandEnvVars, replaceEnvVars } from '../config/index.js';
import config from '../config/index.js';
import { getGroup } from './sseService.js';
import { getServersInGroup, getServerConfigInGroup } from './groupService.js';
import { saveToolsAsVectorEmbeddings, searchToolsByVector } from './vectorSearchService.js';
import { OpenAPIClient } from '../clients/openapi.js';
import { getDataService } from './services.js';

const servers: { [sessionId: string]: Server } = {};

// Helper function to set up keep-alive ping for SSE connections
const setupKeepAlive = (serverInfo: ServerInfo, serverConfig: ServerConfig): void => {
  // Only set up keep-alive for SSE connections
  if (!(serverInfo.transport instanceof SSEClientTransport)) {
    return;
  }

  // Clear any existing interval first
  if (serverInfo.keepAliveIntervalId) {
    clearInterval(serverInfo.keepAliveIntervalId);
  }

  // Use configured interval or default to 60 seconds for SSE
  const interval = serverConfig.keepAliveInterval || 60000;

  serverInfo.keepAliveIntervalId = setInterval(async () => {
    try {
      if (serverInfo.client && serverInfo.status === 'connected') {
        await serverInfo.client.ping();
        console.log(`Keep-alive ping successful for server: ${serverInfo.name}`);
      }
    } catch (error) {
      console.warn(`Keep-alive ping failed for server ${serverInfo.name}:`, error);
      // TODO Consider handling reconnection logic here if needed
    }
  }, interval);

  console.log(
    `Keep-alive ping set up for server ${serverInfo.name} with interval ${interval / 1000} seconds`,
  );
};

export const initUpstreamServers = async (): Promise<void> => {
  await registerAllTools(true);
};

export const getMcpServer = (sessionId?: string, group?: string): Server => {
  if (!sessionId) {
    return createMcpServer(config.mcpHubName, config.mcpHubVersion, group);
  }

  if (!servers[sessionId]) {
    const serverGroup = group || getGroup(sessionId);
    const server = createMcpServer(config.mcpHubName, config.mcpHubVersion, serverGroup);
    servers[sessionId] = server;
  } else {
    console.log(`MCP server already exists for sessionId: ${sessionId}`);
  }
  return servers[sessionId];
};

export const deleteMcpServer = (sessionId: string): void => {
  delete servers[sessionId];
};

export const notifyToolChanged = async (name?: string) => {
  await registerAllTools(false, name);
  Object.values(servers).forEach((server) => {
    server
      .sendToolListChanged()
      .catch((error) => {
        console.warn('Failed to send tool list changed notification:', error.message);
      })
      .then(() => {
        console.log('Tool list changed notification sent successfully');
      });
  });
};

export const syncToolEmbedding = async (serverName: string, toolName: string) => {
  const serverInfo = getServerByName(serverName);
  if (!serverInfo) {
    console.warn(`Server not found: ${serverName}`);
    return;
  }
  const tool = serverInfo.tools.find((t) => t.name === toolName);
  if (!tool) {
    console.warn(`Tool not found: ${toolName} on server: ${serverName}`);
    return;
  }
  // Save tool as vector embedding for search
  saveToolsAsVectorEmbeddings(serverName, [tool]);
};

// Helper function to clean $schema field from inputSchema
const cleanInputSchema = (schema: any): any => {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const cleanedSchema = { ...schema };
  delete cleanedSchema.$schema;

  return cleanedSchema;
};

// Store all server information
let serverInfos: ServerInfo[] = [];

// Returns true if all enabled servers are connected
export const connected = (): boolean => {
  return serverInfos
    .filter((serverInfo) => serverInfo.enabled !== false)
    .every((serverInfo) => serverInfo.status === 'connected');
};

// Global cleanup function to close all connections
export const cleanupAllServers = (): void => {
  for (const serverInfo of serverInfos) {
    try {
      if (serverInfo.client) {
        serverInfo.client.close();
      }
      if (serverInfo.transport) {
        serverInfo.transport.close();
      }
    } catch (error) {
      console.warn(`Error closing server ${serverInfo.name}:`, error);
    }
  }
  serverInfos = [];

  // Clear session servers as well
  Object.keys(servers).forEach((sessionId) => {
    delete servers[sessionId];
  });
};

// Helper function to create transport based on server configuration
const createTransportFromConfig = (name: string, conf: ServerConfig): any => {
  let transport;

  if (conf.type === 'streamable-http') {
    const options: any = {};
    if (conf.headers && Object.keys(conf.headers).length > 0) {
      options.requestInit = {
        headers: conf.headers,
      };
    }
    transport = new StreamableHTTPClientTransport(new URL(conf.url || ''), options);
  } else if (conf.url) {
    // SSE transport
    const options: any = {};
    if (conf.headers && Object.keys(conf.headers).length > 0) {
      options.eventSourceInit = {
        headers: conf.headers,
      };
      options.requestInit = {
        headers: conf.headers,
      };
    }
    transport = new SSEClientTransport(new URL(conf.url), options);
  } else if (conf.command && conf.args) {
    // Stdio transport
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...replaceEnvVars(conf.env || {}),
    };
    env['PATH'] = expandEnvVars(process.env.PATH as string) || '';

    const settings = loadSettings();
    // Add UV_DEFAULT_INDEX and npm_config_registry if needed
    if (
      settings.systemConfig?.install?.pythonIndexUrl &&
      (conf.command === 'uvx' || conf.command === 'uv' || conf.command === 'python')
    ) {
      env['UV_DEFAULT_INDEX'] = settings.systemConfig.install.pythonIndexUrl;
    }

    if (
      settings.systemConfig?.install?.npmRegistry &&
      (conf.command === 'npm' ||
        conf.command === 'npx' ||
        conf.command === 'pnpm' ||
        conf.command === 'yarn' ||
        conf.command === 'node')
    ) {
      env['npm_config_registry'] = settings.systemConfig.install.npmRegistry;
    }

    transport = new StdioClientTransport({
      command: conf.command,
      args: replaceEnvVars(conf.args) as string[],
      env: env,
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (data) => {
      console.log(`[${name}] [child] ${data}`);
    });
  } else {
    throw new Error(`Unable to create transport for server: ${name}`);
  }

  return transport;
};

// Helper function to handle client.callTool with reconnection logic
const callToolWithReconnect = async (
  serverInfo: ServerInfo,
  toolParams: any,
  options?: any,
  maxRetries: number = 1,
): Promise<any> => {
  if (!serverInfo.client) {
    throw new Error(`Client not found for server: ${serverInfo.name}`);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await serverInfo.client.callTool(toolParams, undefined, options || {});
      return result;
    } catch (error: any) {
      // Check if error message starts with "Error POSTing to endpoint (HTTP 40"
      const isHttp40xError = error?.message?.startsWith?.('Error POSTing to endpoint (HTTP 40');
      // Only retry for StreamableHTTPClientTransport
      const isStreamableHttp = serverInfo.transport instanceof StreamableHTTPClientTransport;

      if (isHttp40xError && attempt < maxRetries && serverInfo.transport && isStreamableHttp) {
        console.warn(
          `HTTP 40x error detected for StreamableHTTP server ${serverInfo.name}, attempting reconnection (attempt ${attempt + 1}/${maxRetries + 1})`,
        );

        try {
          // Close existing connection
          if (serverInfo.keepAliveIntervalId) {
            clearInterval(serverInfo.keepAliveIntervalId);
            serverInfo.keepAliveIntervalId = undefined;
          }

          serverInfo.client.close();
          serverInfo.transport.close();

          // Get server configuration to recreate transport
          const settings = loadSettings();
          const conf = settings.mcpServers[serverInfo.name];
          if (!conf) {
            throw new Error(`Server configuration not found for: ${serverInfo.name}`);
          }

          // Recreate transport using helper function
          const newTransport = createTransportFromConfig(serverInfo.name, conf);

          // Create new client
          const client = new Client(
            {
              name: `mcp-client-${serverInfo.name}`,
              version: '1.0.0',
            },
            {
              capabilities: {
                prompts: {},
                resources: {},
                tools: {},
              },
            },
          );

          // Reconnect with new transport
          await client.connect(newTransport, serverInfo.options || {});

          // Update server info with new client and transport
          serverInfo.client = client;
          serverInfo.transport = newTransport;
          serverInfo.status = 'connected';

          // Reload tools list after reconnection
          try {
            const tools = await client.listTools({}, serverInfo.options || {});
            serverInfo.tools = tools.tools.map((tool) => ({
              name: `${serverInfo.name}-${tool.name}`,
              description: tool.description || '',
              inputSchema: cleanInputSchema(tool.inputSchema || {}),
            }));

            // Save tools as vector embeddings for search
            saveToolsAsVectorEmbeddings(serverInfo.name, serverInfo.tools);
          } catch (listToolsError) {
            console.warn(
              `Failed to reload tools after reconnection for server ${serverInfo.name}:`,
              listToolsError,
            );
            // Continue anyway, as the connection might still work for the current tool
          }

          console.log(`Successfully reconnected to server: ${serverInfo.name}`);

          // Continue to next attempt
          continue;
        } catch (reconnectError) {
          console.error(`Failed to reconnect to server ${serverInfo.name}:`, reconnectError);
          serverInfo.status = 'disconnected';
          serverInfo.error = `Failed to reconnect: ${reconnectError}`;

          // If this was the last attempt, throw the original error
          if (attempt === maxRetries) {
            throw error;
          }
        }
      } else {
        // Not an HTTP 40x error or no more retries, throw the original error
        throw error;
      }
    }
  }

  // This should not be reached, but just in case
  throw new Error('Unexpected error in callToolWithReconnect');
};

// Initialize MCP server clients
export const initializeClientsFromSettings = async (
  isInit: boolean,
  serverName?: string,
): Promise<ServerInfo[]> => {
  const settings = loadSettings();
  const existingServerInfos = serverInfos;
  serverInfos = [];

  for (const [name, conf] of Object.entries(settings.mcpServers)) {
    // Skip disabled servers
    if (conf.enabled === false) {
      console.log(`Skipping disabled server: ${name}`);
      serverInfos.push({
        name,
        owner: conf.owner,
        status: 'disconnected',
        error: null,
        tools: [],
        createTime: Date.now(),
        enabled: false,
      });
      continue;
    }

    // Check if server is already connected
    const existingServer = existingServerInfos.find(
      (s) => s.name === name && s.status === 'connected',
    );
    if (existingServer && (!serverName || serverName !== name)) {
      serverInfos.push({
        ...existingServer,
        enabled: conf.enabled === undefined ? true : conf.enabled,
      });
      console.log(`Server '${name}' is already connected.`);
      continue;
    }

    let transport;
    let openApiClient;
    if (conf.type === 'openapi') {
      // Handle OpenAPI type servers
      if (!conf.openapi?.url && !conf.openapi?.schema) {
        console.warn(
          `Skipping OpenAPI server '${name}': missing OpenAPI specification URL or schema`,
        );
        serverInfos.push({
          name,
          owner: conf.owner,
          status: 'disconnected',
          error: 'Missing OpenAPI specification URL or schema',
          tools: [],
          createTime: Date.now(),
        });
        continue;
      }

      // Create server info first and keep reference to it
      const serverInfo: ServerInfo = {
        name,
        owner: conf.owner,
        status: 'connecting',
        error: null,
        tools: [],
        createTime: Date.now(),
        enabled: conf.enabled === undefined ? true : conf.enabled,
      };
      serverInfos.push(serverInfo);

      try {
        // Create OpenAPI client instance
        openApiClient = new OpenAPIClient(conf);

        console.log(`Initializing OpenAPI server: ${name}...`);

        // Perform async initialization
        await openApiClient.initialize();

        // Convert OpenAPI tools to MCP tool format
        const openApiTools = openApiClient.getTools();
        const mcpTools: ToolInfo[] = openApiTools.map((tool) => ({
          name: `${name}-${tool.name}`,
          description: tool.description,
          inputSchema: cleanInputSchema(tool.inputSchema),
        }));

        // Update server info with successful initialization
        serverInfo.status = 'connected';
        serverInfo.tools = mcpTools;
        serverInfo.openApiClient = openApiClient;

        console.log(
          `Successfully initialized OpenAPI server: ${name} with ${mcpTools.length} tools`,
        );

        // Save tools as vector embeddings for search
        saveToolsAsVectorEmbeddings(name, mcpTools);
        continue;
      } catch (error) {
        console.error(`Failed to initialize OpenAPI server ${name}:`, error);

        // Update the already pushed server info with error status
        serverInfo.status = 'disconnected';
        serverInfo.error = `Failed to initialize OpenAPI server: ${error}`;
        continue;
      }
    } else {
      transport = createTransportFromConfig(name, conf);
    }

    const client = new Client(
      {
        name: `mcp-client-${name}`,
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      },
    );

    const initRequestOptions = isInit
      ? {
          timeout: Number(config.initTimeout) || 60000,
        }
      : undefined;

    // Get request options from server configuration, with fallbacks
    const serverRequestOptions = conf.options || {};
    const requestOptions = {
      timeout: serverRequestOptions.timeout || 60000,
      resetTimeoutOnProgress: serverRequestOptions.resetTimeoutOnProgress || false,
      maxTotalTimeout: serverRequestOptions.maxTotalTimeout,
    };

    // Create server info first and keep reference to it
    const serverInfo: ServerInfo = {
      name,
      owner: conf.owner,
      status: 'connecting',
      error: null,
      tools: [],
      client,
      transport,
      options: requestOptions,
      createTime: Date.now(),
    };
    serverInfos.push(serverInfo);

    client
      .connect(transport, initRequestOptions || requestOptions)
      .then(() => {
        console.log(`Successfully connected client for server: ${name}`);
        client
          .listTools({}, initRequestOptions || requestOptions)
          .then((tools) => {
            console.log(`Successfully listed ${tools.tools.length} tools for server: ${name}`);

            serverInfo.tools = tools.tools.map((tool) => ({
              name: `${name}-${tool.name}`,
              description: tool.description || '',
              inputSchema: cleanInputSchema(tool.inputSchema || {}),
            }));
            serverInfo.status = 'connected';
            serverInfo.error = null;

            // Set up keep-alive ping for SSE connections
            setupKeepAlive(serverInfo, conf);

            // Save tools as vector embeddings for search
            saveToolsAsVectorEmbeddings(name, serverInfo.tools);
          })
          .catch((error) => {
            console.error(
              `Failed to list tools for server ${name} by error: ${error} with stack: ${error.stack}`,
            );
            serverInfo.status = 'disconnected';
            serverInfo.error = `Failed to list tools: ${error.stack} `;
          });
      })
      .catch((error) => {
        console.error(
          `Failed to connect client for server ${name} by error: ${error} with stack: ${error.stack}`,
        );
        serverInfo.status = 'disconnected';
        serverInfo.error = `Failed to connect: ${error.stack} `;
      });
    console.log(`Initialized client for server: ${name}`);
  }

  return serverInfos;
};

// Register all MCP tools
export const registerAllTools = async (isInit: boolean, serverName?: string): Promise<void> => {
  await initializeClientsFromSettings(isInit, serverName);
};

// Get all server information
export const getServersInfo = (): Omit<ServerInfo, 'client' | 'transport'>[] => {
  const settings = loadSettings();
  const dataService = getDataService();
  const filterServerInfos: ServerInfo[] = dataService.filterData
    ? dataService.filterData(serverInfos)
    : serverInfos;
  const infos = filterServerInfos.map(({ name, status, tools, createTime, error }) => {
    const serverConfig = settings.mcpServers[name];
    const enabled = serverConfig ? serverConfig.enabled !== false : true;

    // Add enabled status and custom description to each tool
    const toolsWithEnabled = tools.map((tool) => {
      const toolConfig = serverConfig?.tools?.[tool.name];
      return {
        ...tool,
        description: toolConfig?.description || tool.description, // Use custom description if available
        enabled: toolConfig?.enabled !== false, // Default to true if not explicitly disabled
      };
    });

    return {
      name,
      status,
      error,
      tools: toolsWithEnabled,
      createTime,
      enabled,
    };
  });
  infos.sort((a, b) => {
    if (a.enabled === b.enabled) return 0;
    return a.enabled ? -1 : 1;
  });
  return infos;
};

// Get server by name
const getServerByName = (name: string): ServerInfo | undefined => {
  return serverInfos.find((serverInfo) => serverInfo.name === name);
};

// Filter tools by server configuration
const filterToolsByConfig = (serverName: string, tools: ToolInfo[]): ToolInfo[] => {
  const settings = loadSettings();
  const serverConfig = settings.mcpServers[serverName];

  if (!serverConfig || !serverConfig.tools) {
    // If no tool configuration exists, all tools are enabled by default
    return tools;
  }

  return tools.filter((tool) => {
    const toolConfig = serverConfig.tools?.[tool.name];
    // If tool is not in config, it's enabled by default
    return toolConfig?.enabled !== false;
  });
};

// Get server by tool name
const getServerByTool = (toolName: string): ServerInfo | undefined => {
  return serverInfos.find((serverInfo) => serverInfo.tools.some((tool) => tool.name === toolName));
};

// Add new server
export const addServer = async (
  name: string,
  config: ServerConfig,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const settings = loadSettings();
    if (settings.mcpServers[name]) {
      return { success: false, message: 'Server name already exists' };
    }

    settings.mcpServers[name] = config;
    if (!saveSettings(settings)) {
      return { success: false, message: 'Failed to save settings' };
    }

    return { success: true, message: 'Server added successfully' };
  } catch (error) {
    console.error(`Failed to add server: ${name}`, error);
    return { success: false, message: 'Failed to add server' };
  }
};

// Remove server
export const removeServer = (name: string): { success: boolean; message?: string } => {
  try {
    const settings = loadSettings();
    if (!settings.mcpServers[name]) {
      return { success: false, message: 'Server not found' };
    }

    delete settings.mcpServers[name];

    if (!saveSettings(settings)) {
      return { success: false, message: 'Failed to save settings' };
    }

    serverInfos = serverInfos.filter((serverInfo) => serverInfo.name !== name);
    return { success: true, message: 'Server removed successfully' };
  } catch (error) {
    console.error(`Failed to remove server: ${name}`, error);
    return { success: false, message: `Failed to remove server: ${error}` };
  }
};

// Update existing server
export const updateMcpServer = async (
  name: string,
  config: ServerConfig,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const settings = loadSettings();
    if (!settings.mcpServers[name]) {
      return { success: false, message: 'Server not found' };
    }

    settings.mcpServers[name] = config;
    if (!saveSettings(settings)) {
      return { success: false, message: 'Failed to save settings' };
    }

    closeServer(name);

    serverInfos = serverInfos.filter((serverInfo) => serverInfo.name !== name);
    return { success: true, message: 'Server updated successfully' };
  } catch (error) {
    console.error(`Failed to update server: ${name}`, error);
    return { success: false, message: 'Failed to update server' };
  }
};

// Add or update server (supports overriding existing servers for DXT)
export const addOrUpdateServer = async (
  name: string,
  config: ServerConfig,
  allowOverride: boolean = false,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const settings = loadSettings();
    const exists = !!settings.mcpServers[name];

    if (exists && !allowOverride) {
      return { success: false, message: 'Server name already exists' };
    }

    // If overriding and this is a DXT server (stdio type with file paths),
    // we might want to clean up old files in the future
    if (exists && config.type === 'stdio') {
      // Close existing server connections
      closeServer(name);
      // Remove from server infos
      serverInfos = serverInfos.filter((serverInfo) => serverInfo.name !== name);
    }

    settings.mcpServers[name] = config;
    if (!saveSettings(settings)) {
      return { success: false, message: 'Failed to save settings' };
    }

    const action = exists ? 'updated' : 'added';
    return { success: true, message: `Server ${action} successfully` };
  } catch (error) {
    console.error(`Failed to add/update server: ${name}`, error);
    return { success: false, message: 'Failed to add/update server' };
  }
};

// Close server client and transport
function closeServer(name: string) {
  const serverInfo = serverInfos.find((serverInfo) => serverInfo.name === name);
  if (serverInfo && serverInfo.client && serverInfo.transport) {
    // Clear keep-alive interval if exists
    if (serverInfo.keepAliveIntervalId) {
      clearInterval(serverInfo.keepAliveIntervalId);
      serverInfo.keepAliveIntervalId = undefined;
      console.log(`Cleared keep-alive interval for server: ${serverInfo.name}`);
    }

    serverInfo.client.close();
    serverInfo.transport.close();
    console.log(`Closed client and transport for server: ${serverInfo.name}`);
    // TODO kill process
  }
}

// Toggle server enabled status
export const toggleServerStatus = async (
  name: string,
  enabled: boolean,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const settings = loadSettings();
    if (!settings.mcpServers[name]) {
      return { success: false, message: 'Server not found' };
    }

    // Update the enabled status in settings
    settings.mcpServers[name].enabled = enabled;

    if (!saveSettings(settings)) {
      return { success: false, message: 'Failed to save settings' };
    }

    // If disabling, disconnect the server and remove from active servers
    if (!enabled) {
      closeServer(name);

      // Update the server info to show as disconnected and disabled
      const index = serverInfos.findIndex((s) => s.name === name);
      if (index !== -1) {
        serverInfos[index] = {
          ...serverInfos[index],
          status: 'disconnected',
          enabled: false,
        };
      }
    }

    return { success: true, message: `Server ${enabled ? 'enabled' : 'disabled'} successfully` };
  } catch (error) {
    console.error(`Failed to toggle server status: ${name}`, error);
    return { success: false, message: 'Failed to toggle server status' };
  }
};

export const handleListToolsRequest = async (_: any, extra: any) => {
  const sessionId = extra.sessionId || '';
  const group = getGroup(sessionId);
  console.log(`Handling ListToolsRequest for group: ${group}`);

  // Special handling for $smart group to return special tools
  if (group === '$smart') {
    return {
      tools: [
        {
          name: 'search_tools',
          description: (() => {
            // Get info about available servers
            const availableServers = serverInfos.filter(
              (server) => server.status === 'connected' && server.enabled !== false,
            );
            // Create simple server information with only server names
            const serversList = availableServers
              .map((server) => {
                return `${server.name}`;
              })
              .join(', ');
            return `STEP 1 of 2: Use this tool FIRST to discover and search for relevant tools across all available servers. This tool and call_tool work together as a two-step process: 1) search_tools to find what you need, 2) call_tool to execute it.

For optimal results, use specific queries matching your exact needs. Call this tool multiple times with different queries for different parts of complex tasks. Example queries: "image generation tools", "code review tools", "data analysis", "translation capabilities", etc. Results are sorted by relevance using vector similarity.

After finding relevant tools, you MUST use the call_tool to actually execute them. The search_tools only finds tools - it doesn't execute them.

Available servers: ${serversList}`;
          })(),
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description:
                  'The search query to find relevant tools. Be specific and descriptive about the task you want to accomplish.',
              },
              limit: {
                type: 'integer',
                description:
                  'Maximum number of results to return. Use higher values (20-30) for broad searches and lower values (5-10) for specific searches.',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'call_tool',
          description:
            "STEP 2 of 2: Use this tool AFTER search_tools to actually execute/invoke any tool you found. This is the execution step - search_tools finds tools, call_tool runs them.\n\nWorkflow: search_tools → examine results → call_tool with the chosen tool name and required arguments.\n\nIMPORTANT: Always check the tool's inputSchema from search_tools results before invoking to ensure you provide the correct arguments. The search results will show you exactly what parameters each tool expects.",
          inputSchema: {
            type: 'object',
            properties: {
              toolName: {
                type: 'string',
                description: 'The exact name of the tool to invoke (from search_tools results)',
              },
              arguments: {
                type: 'object',
                description:
                  'The arguments to pass to the tool based on its inputSchema (optional if tool requires no arguments)',
              },
            },
            required: ['toolName'],
          },
        },
      ],
    };
  }

  const allServerInfos = getDataService()
    .filterData(serverInfos)
    .filter((serverInfo) => {
      if (serverInfo.enabled === false) return false;
      if (!group) return true;
      const serversInGroup = getServersInGroup(group);
      if (!serversInGroup || serversInGroup.length === 0) return serverInfo.name === group;
      return serversInGroup.includes(serverInfo.name);
    });

  const allTools = [];
  for (const serverInfo of allServerInfos) {
    if (serverInfo.tools && serverInfo.tools.length > 0) {
      // Filter tools based on server configuration
      let enabledTools = filterToolsByConfig(serverInfo.name, serverInfo.tools);

      // If this is a group request, apply group-level tool filtering
      if (group) {
        const serverConfig = getServerConfigInGroup(group, serverInfo.name);
        if (serverConfig && serverConfig.tools !== 'all' && Array.isArray(serverConfig.tools)) {
          // Filter tools based on group configuration
          const allowedToolNames = serverConfig.tools.map(
            (toolName) => `${serverInfo.name}-${toolName}`,
          );
          enabledTools = enabledTools.filter((tool) => allowedToolNames.includes(tool.name));
        }
      }

      // Apply custom descriptions from server configuration
      const settings = loadSettings();
      const serverConfig = settings.mcpServers[serverInfo.name];
      const toolsWithCustomDescriptions = enabledTools.map((tool) => {
        const toolConfig = serverConfig?.tools?.[tool.name];
        return {
          ...tool,
          description: toolConfig?.description || tool.description, // Use custom description if available
        };
      });

      allTools.push(...toolsWithCustomDescriptions);
    }
  }

  return {
    tools: allTools,
  };
};

export const handleCallToolRequest = async (request: any, extra: any) => {
  console.log(`Handling CallToolRequest for tool: ${JSON.stringify(request.params)}`);
  try {
    // Special handling for agent group tools
    if (request.params.name === 'search_tools') {
      const { query, limit = 10 } = request.params.arguments || {};

      if (!query || typeof query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
      }

      const limitNum = Math.min(Math.max(parseInt(String(limit)) || 10, 1), 100);

      // Dynamically adjust threshold based on query characteristics
      let thresholdNum = 0.3; // Default threshold

      // For more general queries, use a lower threshold to get more diverse results
      if (query.length < 10 || query.split(' ').length <= 2) {
        thresholdNum = 0.2;
      }

      // For very specific queries, use a higher threshold for more precise results
      if (query.length > 30 || query.includes('specific') || query.includes('exact')) {
        thresholdNum = 0.4;
      }

      console.log(`Using similarity threshold: ${thresholdNum} for query: "${query}"`);
      const servers = undefined; // No server filtering

      const searchResults = await searchToolsByVector(query, limitNum, thresholdNum, servers);
      console.log(`Search results: ${JSON.stringify(searchResults)}`);
      // Find actual tool information from serverInfos by serverName and toolName
      const tools = searchResults
        .map((result) => {
          // Find the server in serverInfos
          const server = serverInfos.find(
            (serverInfo) =>
              serverInfo.name === result.serverName &&
              serverInfo.status === 'connected' &&
              serverInfo.enabled !== false,
          );
          if (server && server.tools && server.tools.length > 0) {
            // Find the tool in server.tools
            const actualTool = server.tools.find((tool) => tool.name === result.toolName);
            if (actualTool) {
              // Check if the tool is enabled in configuration
              const enabledTools = filterToolsByConfig(server.name, [actualTool]);
              if (enabledTools.length > 0) {
                // Apply custom description from configuration
                const settings = loadSettings();
                const serverConfig = settings.mcpServers[server.name];
                const toolConfig = serverConfig?.tools?.[actualTool.name];

                // Return the actual tool info from serverInfos with custom description
                return {
                  ...actualTool,
                  description: toolConfig?.description || actualTool.description,
                };
              }
            }
          }

          // Fallback to search result if server or tool not found or disabled
          return {
            name: result.toolName,
            description: result.description || '',
            inputSchema: cleanInputSchema(result.inputSchema || {}),
          };
        })
        .filter((tool) => {
          // Additional filter to remove tools that are disabled
          if (tool.name) {
            const serverName = searchResults.find((r) => r.toolName === tool.name)?.serverName;
            if (serverName) {
              const enabledTools = filterToolsByConfig(serverName, [tool as ToolInfo]);
              return enabledTools.length > 0;
            }
          }
          return true; // Keep fallback results
        });

      // Add usage guidance to the response
      const response = {
        tools,
        metadata: {
          query: query,
          threshold: thresholdNum,
          totalResults: tools.length,
          guideline:
            tools.length > 0
              ? "Found relevant tools. If these tools don't match exactly what you need, try another search with more specific keywords."
              : 'No tools found. Try broadening your search or using different keywords.',
          nextSteps:
            tools.length > 0
              ? 'To use a tool, call call_tool with the toolName and required arguments.'
              : 'Consider searching for related capabilities or more general terms.',
        },
      };

      // Return in the same format as handleListToolsRequest
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      };
    }

    // Special handling for call_tool
    if (request.params.name === 'call_tool') {
      let { toolName } = request.params.arguments || {};
      if (!toolName) {
        throw new Error('toolName parameter is required');
      }

      const { arguments: toolArgs = {} } = request.params.arguments || {};
      let targetServerInfo: ServerInfo | undefined;
      if (extra && extra.server) {
        targetServerInfo = getServerByName(extra.server);
      } else {
        // Find the first server that has this tool
        targetServerInfo = serverInfos.find(
          (serverInfo) =>
            serverInfo.status === 'connected' &&
            serverInfo.enabled !== false &&
            serverInfo.tools.some((tool) => tool.name === toolName),
        );
      }

      if (!targetServerInfo) {
        throw new Error(`No available servers found with tool: ${toolName}`);
      }

      // Check if the tool exists on the server
      const toolExists = targetServerInfo.tools.some((tool) => tool.name === toolName);
      if (!toolExists) {
        throw new Error(`Tool '${toolName}' not found on server '${targetServerInfo.name}'`);
      }

      // Handle OpenAPI servers differently
      if (targetServerInfo.openApiClient) {
        // For OpenAPI servers, use the OpenAPI client
        const openApiClient = targetServerInfo.openApiClient;

        // Use toolArgs if it has properties, otherwise fallback to request.params.arguments
        const finalArgs =
          toolArgs && Object.keys(toolArgs).length > 0 ? toolArgs : request.params.arguments || {};

        console.log(
          `Invoking OpenAPI tool '${toolName}' on server '${targetServerInfo.name}' with arguments: ${JSON.stringify(finalArgs)}`,
        );

        // Remove server prefix from tool name if present
        const cleanToolName = toolName.startsWith(`${targetServerInfo.name}-`)
          ? toolName.replace(`${targetServerInfo.name}-`, '')
          : toolName;

        const result = await openApiClient.callTool(cleanToolName, finalArgs);

        console.log(`OpenAPI tool invocation result: ${JSON.stringify(result)}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      // Call the tool on the target server (MCP servers)
      const client = targetServerInfo.client;
      if (!client) {
        throw new Error(`Client not found for server: ${targetServerInfo.name}`);
      }

      // Use toolArgs if it has properties, otherwise fallback to request.params.arguments
      const finalArgs =
        toolArgs && Object.keys(toolArgs).length > 0 ? toolArgs : request.params.arguments || {};

      console.log(
        `Invoking tool '${toolName}' on server '${targetServerInfo.name}' with arguments: ${JSON.stringify(finalArgs)}`,
      );

      toolName = toolName.startsWith(`${targetServerInfo.name}-`)
        ? toolName.replace(`${targetServerInfo.name}-`, '')
        : toolName;
      const result = await callToolWithReconnect(
        targetServerInfo,
        {
          name: toolName,
          arguments: finalArgs,
        },
        targetServerInfo.options || {},
      );

      console.log(`Tool invocation result: ${JSON.stringify(result)}`);
      return result;
    }

    // Regular tool handling
    const serverInfo = getServerByTool(request.params.name);
    if (!serverInfo) {
      throw new Error(`Server not found: ${request.params.name}`);
    }

    // Handle OpenAPI servers differently
    if (serverInfo.openApiClient) {
      // For OpenAPI servers, use the OpenAPI client
      const openApiClient = serverInfo.openApiClient;

      // Remove server prefix from tool name if present
      const cleanToolName = request.params.name.startsWith(`${serverInfo.name}-`)
        ? request.params.name.replace(`${serverInfo.name}-`, '')
        : request.params.name;

      console.log(
        `Invoking OpenAPI tool '${cleanToolName}' on server '${serverInfo.name}' with arguments: ${JSON.stringify(request.params.arguments)}`,
      );

      const result = await openApiClient.callTool(cleanToolName, request.params.arguments || {});

      console.log(`OpenAPI tool invocation result: ${JSON.stringify(result)}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }

    // Handle MCP servers
    const client = serverInfo.client;
    if (!client) {
      throw new Error(`Client not found for server: ${serverInfo.name}`);
    }

    request.params.name = request.params.name.startsWith(`${serverInfo.name}-`)
      ? request.params.name.replace(`${serverInfo.name}-`, '')
      : request.params.name;
    const result = await callToolWithReconnect(
      serverInfo,
      request.params,
      serverInfo.options || {},
    );
    console.log(`Tool call result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error(`Error handling CallToolRequest: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error}`,
        },
      ],
      isError: true,
    };
  }
};

// Create McpServer instance
export const createMcpServer = (name: string, version: string, group?: string): Server => {
  // Determine server name based on routing type
  let serverName = name;

  if (group) {
    // Check if it's a group or a single server
    const serversInGroup = getServersInGroup(group);
    if (!serversInGroup || serversInGroup.length === 0) {
      // Single server routing
      serverName = `${name}_${group}`;
    } else {
      // Group routing
      serverName = `${name}_${group}_group`;
    }
  }
  // If no group, use default name (global routing)

  const server = new Server({ name: serverName, version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, handleListToolsRequest);
  server.setRequestHandler(CallToolRequestSchema, handleCallToolRequest);
  return server;
};
