import express from 'express';
import request from 'supertest';
import { initMiddlewares, errorHandler } from '../src/middlewares/index.js';

describe('Global error handler', () => {
  it('should return unified error response when route throws', async () => {
    const app = express();
    initMiddlewares(app);
    app.get('/error', () => {
      throw new Error('boom');
    });
    app.use(errorHandler);

    const res = await request(app).get('/error');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal server error' });
  });
});
