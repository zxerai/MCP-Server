import 'reflect-metadata';
import AppServer from './server.js';

const appServer = new AppServer();

async function boot() {
  try {
    // Initialization (including default user setup) runs only at startup
    await appServer.initialize();
  } catch (error) {
    console.error('Failed to initialize application during startup:', error);
    process.exit(1);
  }

  appServer.start();
}

boot();

export default appServer.getApp();
