import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { equipmentRouter } from './modules/equipment/equipment.routes.js';
import {
  cleaningRecordsRouter,
  equipmentCleaningRecordsRouter,
} from './modules/cleaning-records/cleaning-records.routes.js';
import './modules/auth/auth.types.js';

/**
 * The app is built by a factory (rather than created at import time) so integration
 * tests can mount it with supertest without opening a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/equipment', equipmentRouter);
  app.use('/api/equipment/:equipmentId/cleaning-records', equipmentCleaningRecordsRouter);
  app.use('/api/cleaning-records', cleaningRecordsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
