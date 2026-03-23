/**
 * Bot Status API Routes
 * Trạng thái bot: uptime, memory, cache, guilds
 */

import { Router, Response } from 'express';
import { Client } from 'discord.js';
import { requireAuth, type AuthRequest } from '../middleware.js';
import { env } from '../../config/env.js';
import type { TTSManager } from '../../tts/manager.js';
import type { VoiceConnectionManager } from '../../voice/connection.js';

export function createBotStatusRouter(
  botClient: Client,
  ttsManager: TTSManager,
  voiceManager: VoiceConnectionManager,
): Router {
  const router = Router();

  router.use(requireAuth);

  /** GET /api/bot/status - Trạng thái bot (chỉ bot owner) */
  router.get('/status', (req: AuthRequest, res: Response) => {
    if (req.user!.id !== env.BOT_OWNER_ID) {
      res.status(403).json({ error: 'Chỉ bot owner mới có quyền xem.' });
      return;
    }

    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime),
      },
      memory: {
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        rss: formatBytes(memUsage.rss),
      },
      bot: {
        guilds: botClient.guilds.cache.size,
        users: botClient.users.cache.size,
        voiceConnections: voiceManager.getActiveConnections(),
        ping: botClient.ws.ping,
      },
      cache: ttsManager.getCacheStats(),
    });
  });

  return router;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
