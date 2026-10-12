import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import shiftRoutes from './routes/shifts.js';
import swapRoutes from './routes/swaps.js';
import notificationRoutes from './routes/notifications.js';
import absenceRoutes from './routes/absences.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', requireAuth, userRoutes);
  app.use('/api/shifts', requireAuth, shiftRoutes);
  app.use('/api/swaps', requireAuth, swapRoutes);
  app.use('/api/notifications', requireAuth, notificationRoutes);
  app.use('/api/absences', requireAuth, absenceRoutes);

  app.use('/api', (req, res, next) => next(notFound('Ruta no encontrada')));
  app.use(errorHandler);
  return app;
}
