import request from 'supertest';

// Mocks for service functions
const mockHandleSseConnection = jest.fn().mockRejectedValue(new Error('sse'));
const mockHandleSseMessage = jest.fn().mockRejectedValue(new Error('message'));
const mockHandleMcpPostRequest = jest.fn().mockRejectedValue(new Error('mcp-post'));
const mockHandleMcpOtherRequest = jest.fn().mockRejectedValue(new Error('mcp-other'));

jest.mock('../src/services/sseService.js', () => ({
  handleSseConnection: mockHandleSseConnection,
  handleSseMessage: mockHandleSseMessage,
  handleMcpPostRequest: mockHandleMcpPostRequest,
  handleMcpOtherRequest: mockHandleMcpOtherRequest,
}));

jest.mock('../src/services/mcpService.js', () => ({
  initUpstreamServers: jest.fn().mockResolvedValue(undefined),
  connected: jest.fn().mockReturnValue(true),
}));

jest.mock('../src/utils/i18n.js', () => ({
  initI18n: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/models/User.js', () => ({
  initializeDefaultUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/routes/index.js', () => ({
  initRoutes: jest.fn(),
}));

jest.mock('../src/middlewares/index.js', () => {
  const actual = jest.requireActual('../src/middlewares/index.js');
  return {
    ...actual,
    initMiddlewares: (app: any) => {
      app.use(actual.errorHandler);
    },
  };
});

import { AppServer } from '../src/server.js';

describe('async route error handling', () => {
  let app: any;

  beforeAll(async () => {
    const server = new AppServer();
    await server.initialize();
    await new Promise((resolve) => setTimeout(resolve, 0));
    app = server.getApp();
  });

  test('sse connection propagates errors', async () => {
    const res = await request(app).get('/sse');
    expect(res.status).toBe(500);
    expect(mockHandleSseConnection).toHaveBeenCalled();
  });

  test('sse message propagates errors', async () => {
    const res = await request(app).post('/messages');
    expect(res.status).toBe(500);
    expect(mockHandleSseMessage).toHaveBeenCalled();
  });

  test('mcp post propagates errors', async () => {
    const res = await request(app).post('/mcp');
    expect(res.status).toBe(500);
    expect(mockHandleMcpPostRequest).toHaveBeenCalled();
  });

  test('mcp get propagates errors', async () => {
    const res = await request(app).get('/mcp');
    expect(res.status).toBe(500);
    expect(mockHandleMcpOtherRequest).toHaveBeenCalled();
  });

  test('mcp delete propagates errors', async () => {
    const res = await request(app).delete('/mcp');
    expect(res.status).toBe(500);
    expect(mockHandleMcpOtherRequest).toHaveBeenCalled();
  });
});
