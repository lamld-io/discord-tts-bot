/**
 * Web Dashboard Middleware
 * Bảo mật: Rate Limiting, CORS, Security Headers, JWT Auth
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// --- Types ---

export interface AuthUser {
  id: string;
  username: string;
  avatar: string | null;
  accessToken: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// --- Rate Limiting ---

/** General rate limiter: 100 requests / phút / IP */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều request, vui lòng thử lại sau.' },
});

/** Auth rate limiter: 10 requests / phút / IP */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều request đăng nhập, vui lòng thử lại sau.' },
});

// --- CORS ---

export const corsConfig = cors({
  origin: env.WEB_FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// --- Security Headers ---

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// --- JWT Auth Middleware ---

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Chưa đăng nhập.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

// --- Guild Admin Check ---

export function requireGuildAdmin(botClient: import('discord.js').Client) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const guildId = (req.params.guildId || req.params.id) as string;
    const user = req.user;

    if (!user || !guildId) {
      res.status(400).json({ error: 'Thiếu thông tin guild hoặc user.' });
      return;
    }

    try {
      // Kiểm tra bot có trong guild không
      const guild = botClient.guilds.cache.get(guildId as string);
      if (!guild) {
        res.status(404).json({ error: 'Bot không ở trong server này.' });
        return;
      }

      // Bot owner bypass
      if (user.id === env.BOT_OWNER_ID) {
        next();
        return;
      }

      // Kiểm tra user có trong guild và có quyền admin
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        res.status(403).json({ error: 'Bạn không phải thành viên của server này.' });
        return;
      }

      const isAdmin = member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
      if (!isAdmin) {
        res.status(403).json({ error: 'Bạn cần quyền Administrator hoặc Manage Server.' });
        return;
      }

      next();
    } catch (error) {
      logger.error('Guild admin check error:', error);
      res.status(500).json({ error: 'Lỗi kiểm tra quyền.' });
    }
  };
}
