import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { addRoutes } from './routes.js';
import { errorHandler } from './utils/errors.js';
import { con } from './repository/connection.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.origins, allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use("/uploads", express.static("uploads"));
  app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/health', async (req, res) => { await con.query('SELECT 1'); res.json({ status: 'ok', api: 'Sobraê' }); });
  addRoutes(app);
  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
  app.use(errorHandler);
  return app;
}
