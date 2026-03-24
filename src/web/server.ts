/**
 * Web Dashboard Server
 * Express server phục vụ API và static files
 */

import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { generalLimiter, corsConfig, securityHeaders } from './middleware.js';
import authRouter from './routes/auth.js';
import { createGuildRouter } from './routes/guilds.js';
import { createBotStatusRouter } from './routes/bot-status.js';
import type { Bot } from '../bot/client.js';

export function startWebServer(bot: Bot): void {
  const app = express();

  // --- Global Middleware ---
  app.use(securityHeaders);
  app.use(corsConfig);
  app.use(generalLimiter);
  app.use(express.json());
  app.use(cookieParser());

  // --- Health Check (không cần auth, dùng cho Docker healthcheck) ---
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // --- API Routes ---
  app.use('/api/auth', authRouter);
  app.use('/api/guilds', createGuildRouter(bot.client));
  app.use('/api/bot', createBotStatusRouter(bot.client, bot.ttsManager, bot.voiceManager));

  // --- Serve Frontend (Production) ---
  const frontendPath = path.join(process.cwd(), 'web', 'dist');
  app.use(express.static(frontendPath));

  // SPA fallback: mọi route khác trả về index.html
  app.get('{*path}', (_req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(404).json({ error: 'Frontend chưa được build.' });
      }
    });
  });

  // --- Start Server ---
  app.listen(env.WEB_PORT, () => {
    logger.info(`🌐 Web Dashboard: http://localhost:${env.WEB_PORT}`);
  });
}
