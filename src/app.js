import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import adminRoutes from './modules/admin/admin.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import bookingRoutes from './modules/bookings/booking.routes.js';
import driverRoutes from './modules/drivers/driver.routes.js';
import locationRoutes from './modules/locations/location.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import roadsideSignalRoutes from './modules/roadsideSignals/roadsideSignal.routes.js';
import userRoutes from './modules/users/user.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const requestId = req.headers['x-request-id'] || randomUUID();
        res.setHeader('x-request-id', requestId);
        return requestId;
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: env.SERVICE_NAME, timestamp: new Date().toISOString() }),
  );
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/drivers', driverRoutes);
  app.use('/api/v1/locations', locationRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/roadside-signals', roadsideSignalRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();

