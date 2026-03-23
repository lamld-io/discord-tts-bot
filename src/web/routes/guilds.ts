/**
 * Guild Management API Routes
 * Settings, Allowlist, Users, Roles, Channels
 */

import { Router, Response } from 'express';
import { Client, ChannelType } from 'discord.js';
import { requireAuth, requireGuildAdmin, type AuthRequest } from '../middleware.js';
import {
  getGuildSettings,
  updateGuildSettings,
  getAllowlist,
  addAllowlist,
  removeAllowlist,
} from '../../database/index.js';
import { logger } from '../../utils/logger.js';

export function createGuildRouter(botClient: Client): Router {
  const router = Router();
  const adminMiddleware = requireGuildAdmin(botClient);

  // Tất cả routes yêu cầu auth
  router.use(requireAuth);

  /** GET /api/guilds - Danh sách guilds mà user là admin VÀ bot đang ở */
  router.get('/', async (req: AuthRequest, res: Response) => {
    const user = req.user!;

    try {
      // Lấy guilds của user từ Discord API (có retry khi bị rate limit)
      let guildsResponse: globalThis.Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });

        if (guildsResponse.status === 429) {
          const retryData = await guildsResponse.json() as { retry_after?: number };
          const waitMs = ((retryData.retry_after ?? 1) + 0.1) * 1000;
          logger.warn(`Discord rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        break;
      }

      if (!guildsResponse || !guildsResponse.ok) {
        const errBody = guildsResponse ? await guildsResponse.text() : 'No response';
        logger.error(`Discord guilds API failed [${guildsResponse?.status}]: ${errBody}`);
        res.status(502).json({ error: 'Không thể lấy danh sách servers.' });
        return;
      }

      const userGuilds = await guildsResponse.json() as Array<{
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
      }>;

      // Lọc guilds: user là admin VÀ bot đang ở trong
      const botGuildIds = new Set(botClient.guilds.cache.map(g => g.id));

      const guilds = userGuilds
        .filter(g => {
          const perms = BigInt(g.permissions);
          const isAdmin = g.owner || (perms & 0x8n) !== 0n || (perms & 0x20n) !== 0n;
          return isAdmin && botGuildIds.has(g.id);
        })
        .map(g => {
          const botGuild = botClient.guilds.cache.get(g.id);
          return {
            id: g.id,
            name: g.name,
            icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null,
            memberCount: botGuild?.memberCount ?? 0,
          };
        });

      res.json(guilds);
    } catch (error) {
      logger.error('Get guilds error:', error);
      res.status(500).json({ error: 'Lỗi lấy danh sách servers.' });
    }
  });

  /** GET /api/guilds/:id/settings - Lấy guild settings */
  router.get('/:id/settings', adminMiddleware, (req: AuthRequest, res: Response) => {
    const settings = getGuildSettings(req.params.id as string);
    res.json(settings);
  });

  /** PATCH /api/guilds/:id/settings - Cập nhật guild settings */
  router.patch('/:id/settings', adminMiddleware, (req: AuthRequest, res: Response) => {
    const guildId = req.params.id as string;
    const updates = req.body;

    // Validate inputs
    const allowedFields = [
      'default_provider', 'default_language', 'text_limit',
      'permission_mode', 'dj_role_id',
      'auto_read_enabled', 'auto_read_channel_id', 'auto_read_ignore_prefix',
    ];

    const validUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        validUpdates[key] = updates[key];
      }
    }

    // Validate specific fields
    if ('text_limit' in validUpdates) {
      const limit = Number(validUpdates.text_limit);
      if (isNaN(limit) || limit < 100 || limit > 5000) {
        res.status(400).json({ error: 'text_limit phải từ 100 đến 5000.' });
        return;
      }
      validUpdates.text_limit = limit;
    }

    if ('permission_mode' in validUpdates) {
      if (!['open', 'role', 'allowlist'].includes(validUpdates.permission_mode as string)) {
        res.status(400).json({ error: 'permission_mode phải là open, role, hoặc allowlist.' });
        return;
      }
    }

    if ('default_provider' in validUpdates) {
      if (!['edge', 'gtts', 'elevenlabs', 'google', 'openai'].includes(validUpdates.default_provider as string)) {
        res.status(400).json({ error: 'Provider không hợp lệ.' });
        return;
      }
    }

    if ('auto_read_enabled' in validUpdates) {
      validUpdates.auto_read_enabled = validUpdates.auto_read_enabled ? 1 : 0;
    }

    if (Object.keys(validUpdates).length === 0) {
      res.status(400).json({ error: 'Không có trường nào hợp lệ để cập nhật.' });
      return;
    }

    updateGuildSettings(guildId, validUpdates as any);
    const updated = getGuildSettings(guildId);
    res.json(updated);
  });

  /** GET /api/guilds/:id/allowlist - Lấy allowlist */
  router.get('/:id/allowlist', adminMiddleware, (req: AuthRequest, res: Response) => {
    const list = getAllowlist(req.params.id as string);
    res.json(list);
  });

  /** POST /api/guilds/:id/allowlist - Thêm vào allowlist */
  router.post('/:id/allowlist', adminMiddleware, (req: AuthRequest, res: Response) => {
    const { target_id, target_type } = req.body;

    if (!target_id || !target_type) {
      res.status(400).json({ error: 'Thiếu target_id hoặc target_type.' });
      return;
    }

    if (!['user', 'role'].includes(target_type)) {
      res.status(400).json({ error: 'target_type phải là user hoặc role.' });
      return;
    }

    const success = addAllowlist(req.params.id as string, target_id, target_type);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Không thể thêm vào allowlist.' });
    }
  });

  /** DELETE /api/guilds/:id/allowlist/:targetId - Xóa khỏi allowlist */
  router.delete('/:id/allowlist/:targetId', adminMiddleware, (req: AuthRequest, res: Response) => {
    const success = removeAllowlist(req.params.id as string, req.params.targetId as string);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Không tìm thấy trong allowlist.' });
    }
  });

  /** GET /api/guilds/:id/roles - Danh sách roles của guild */
  router.get('/:id/roles', adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const guild = botClient.guilds.cache.get(req.params.id as string);
      if (!guild) {
        res.status(404).json({ error: 'Không tìm thấy server.' });
        return;
      }

      const roles = guild.roles.cache
        .filter(r => r.id !== guild.id) // Exclude @everyone
        .sort((a, b) => b.position - a.position)
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
          position: r.position,
        }));

      res.json(roles);
    } catch (error) {
      logger.error('Get roles error:', error);
      res.status(500).json({ error: 'Lỗi lấy roles.' });
    }
  });

  /** GET /api/guilds/:id/channels - Danh sách channels */
  router.get('/:id/channels', adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const guild = botClient.guilds.cache.get(req.params.id as string);
      if (!guild) {
        res.status(404).json({ error: 'Không tìm thấy server.' });
        return;
      }

      const channels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(c => ({
          id: c.id,
          name: c.name,
          type: c.type === ChannelType.GuildText ? 'text' : 'voice',
        }));

      res.json(channels);
    } catch (error) {
      logger.error('Get channels error:', error);
      res.status(500).json({ error: 'Lỗi lấy channels.' });
    }
  });

  return router;
}
