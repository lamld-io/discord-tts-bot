/**
 * Discord OAuth2 Auth Routes
 * Login, Callback, Me, Logout
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { authLimiter, requireAuth, type AuthRequest } from '../middleware.js';

const router = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const OAUTH2_AUTHORIZE = 'https://discord.com/api/oauth2/authorize';
const OAUTH2_TOKEN = 'https://discord.com/api/oauth2/token';

/** GET /api/auth/login - Redirect đến Discord OAuth2 */
router.get('/login', authLimiter, (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });

  res.redirect(`${OAUTH2_AUTHORIZE}?${params.toString()}`);
});

/** GET /api/auth/callback - Nhận authorization code, đổi lấy access token */
router.get('/callback', authLimiter, async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Thiếu authorization code.' });
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(OAUTH2_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_OAUTH_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_OAUTH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      logger.error('OAuth2 token exchange failed:', await tokenResponse.text());
      res.status(400).json({ error: 'Đổi token thất bại.' });
      return;
    }

    const tokenData = await tokenResponse.json() as { access_token: string; token_type: string };

    // Get user info
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      res.status(400).json({ error: 'Lấy thông tin user thất bại.' });
      return;
    }

    const userData = await userResponse.json() as {
      id: string;
      username: string;
      avatar: string | null;
      global_name: string | null;
    };

    // Create JWT
    const jwtPayload = {
      id: userData.id,
      username: userData.global_name || userData.username,
      avatar: userData.avatar,
      accessToken: tokenData.access_token,
    };

    const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend
    res.redirect(env.WEB_FRONTEND_URL);
  } catch (error) {
    logger.error('OAuth2 callback error:', error);
    res.status(500).json({ error: 'Lỗi xác thực.' });
  }
});

/** GET /api/auth/me - Trả về user info (từ JWT, không gọi Discord API) */
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    user: { id: user.id, username: user.username, avatar: user.avatar },
  });
});

/** POST /api/auth/logout - Xóa session */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
