import express from 'express';
import config from './config/index.js';
import path from 'path';
import fs from 'fs';
import { initUpstreamServers, connected } from './services/mcpService.js';
import { initMiddlewares } from './middlewares/index.js';
import { initRoutes } from './routes/index.js';
import { initI18n } from './utils/i18n.js';
import {
  handleSseConnection,
  handleSseMessage,
  handleMcpPostRequest,
  handleMcpOtherRequest,
} from './services/sseService.js';
import { initializeDefaultUser } from './models/User.js';
import { sseUserContextMiddleware } from './middlewares/userContext.js';

// Get the current working directory (will be project root in most cases)
const currentFileDir = process.cwd() + '/src';

export class AppServer {
  private app: express.Application;
  private port: number | string;
  private frontendPath: string | null = null;
  private basePath: string;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.basePath = config.basePath;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize i18n before other components
      await initI18n();
      console.log('i18n initialized successfully');

      // Initialize default admin user if no users exist
      await initializeDefaultUser();

      initMiddlewares(this.app);
      initRoutes(this.app);
      console.log('Server initialized successfully');

      initUpstreamServers()
        .then(() => {
          console.log('MCP server initialized successfully');

          // Original routes (global and group-based)
          this.app.get(`${this.basePath}/sse/:group?`, sseUserContextMiddleware, (req, res) =>
            handleSseConnection(req, res),
          );
          this.app.post(`${this.basePath}/messages`, sseUserContextMiddleware, handleSseMessage);
          this.app.post(
            `${this.basePath}/mcp/:group?`,
            sseUserContextMiddleware,
            handleMcpPostRequest,
          );
          this.app.get(
            `${this.basePath}/mcp/:group?`,
            sseUserContextMiddleware,
            handleMcpOtherRequest,
          );
          this.app.delete(
            `${this.basePath}/mcp/:group?`,
            sseUserContextMiddleware,
            handleMcpOtherRequest,
          );

          // User-scoped routes with user context middleware
          this.app.get(`${this.basePath}/:user/sse/:group?`, sseUserContextMiddleware, (req, res) =>
            handleSseConnection(req, res),
          );
          this.app.post(
            `${this.basePath}/:user/messages`,
            sseUserContextMiddleware,
            handleSseMessage,
          );
          this.app.post(
            `${this.basePath}/:user/mcp/:group?`,
            sseUserContextMiddleware,
            handleMcpPostRequest,
          );
          this.app.get(
            `${this.basePath}/:user/mcp/:group?`,
            sseUserContextMiddleware,
            handleMcpOtherRequest,
          );
          this.app.delete(
            `${this.basePath}/:user/mcp/:group?`,
            sseUserContextMiddleware,
            handleMcpOtherRequest,
          );
        })
        .catch((error) => {
          console.error('Error initializing MCP server:', error);
          throw error;
        })
        .finally(() => {
          // Find and serve frontend
          this.findAndServeFrontend();
        });
    } catch (error) {
      console.error('Error initializing server:', error);
      throw error;
    }
  }

  private findAndServeFrontend(): void {
    // Find frontend path
    this.frontendPath = this.findFrontendDistPath();

    if (this.frontendPath) {
      console.log(`Serving frontend from: ${this.frontendPath}`);
      // Serve static files with base path
      this.app.use(this.basePath, express.static(this.frontendPath));

      // Add the wildcard route for SPA with base path
      if (fs.existsSync(path.join(this.frontendPath, 'index.html'))) {
        this.app.get(`${this.basePath}/*`, (_req, res) => {
          res.sendFile(path.join(this.frontendPath!, 'index.html'));
        });

        // Also handle root redirect if base path is set
        if (this.basePath) {
          this.app.get('/', (_req, res) => {
            res.redirect(this.basePath);
          });
        }
      }
    } else {
      console.warn('Frontend dist directory not found. Server will run without frontend.');
      const rootPath = this.basePath || '/';
      this.app.get(rootPath, (_req, res) => {
        res
          .status(404)
          .send('Frontend not found. MCPHub API is running, but the UI is not available.');
      });
    }
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`Server is running on port ${this.port}`);
      if (this.frontendPath) {
        console.log(`Open http://localhost:${this.port} in your browser to access MCPHub UI`);
      } else {
        console.log(
          `MCPHub API is running on http://localhost:${this.port}, but the UI is not available`,
        );
      }
    });
  }

  connected(): boolean {
    return connected();
  }

  getApp(): express.Application {
    return this.app;
  }

  // Helper method to find frontend dist path in different environments
  private findFrontendDistPath(): string | null {
    // Debug flag for detailed logging
    const debug = process.env.DEBUG === 'true';

    if (debug) {
      console.log('DEBUG: Current directory:', process.cwd());
      console.log('DEBUG: Script directory:', currentFileDir);
    }

    // First, find the package root directory
    const packageRoot = this.findPackageRoot();

    if (debug) {
      console.log('DEBUG: Using package root:', packageRoot);
    }

    if (!packageRoot) {
      console.warn('Could not determine package root directory');
      return null;
    }

    // Check for frontend dist in the standard location
    const frontendDistPath = path.join(packageRoot, 'frontend', 'dist');

    if (debug) {
      console.log(`DEBUG: Checking frontend at: ${frontendDistPath}`);
    }

    if (
      fs.existsSync(frontendDistPath) &&
      fs.existsSync(path.join(frontendDistPath, 'index.html'))
    ) {
      return frontendDistPath;
    }

    console.warn('Frontend distribution not found at', frontendDistPath);
    return null;
  }

  // Helper method to find the package root (where package.json is located)
  private findPackageRoot(): string | null {
    const debug = process.env.DEBUG === 'true';

    // Possible locations for package.json
    const possibleRoots = [
      // Standard npm package location
      path.resolve(currentFileDir, '..', '..'),
      // Current working directory
      process.cwd(),
      // When running from dist directory
      path.resolve(currentFileDir, '..'),
      // When installed via npx
      path.resolve(currentFileDir, '..', '..', '..'),
    ];

    // Special handling for npx
    if (process.argv[1] && process.argv[1].includes('_npx')) {
      const npxDir = path.dirname(process.argv[1]);
      possibleRoots.unshift(path.resolve(npxDir, '..'));
    }

    if (debug) {
      console.log('DEBUG: Checking for package.json in:', possibleRoots);
    }

    for (const root of possibleRoots) {
      const packageJsonPath = path.join(root, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (pkg.name === 'mcphub' || pkg.name === '@samanhappy/mcphub') {
            if (debug) {
              console.log(`DEBUG: Found package.json at ${packageJsonPath}`);
            }
            return root;
          }
        } catch (e) {
          if (debug) {
            console.error(`DEBUG: Failed to parse package.json at ${packageJsonPath}:`, e);
          }
          // Continue to the next potential root
        }
      }
    }

    return null;
  }
}

export default AppServer;
