import { config } from 'dotenv';
config();

export const env = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ?? '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? '',

  // TTS Providers
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? '',
  GOOGLE_CLOUD_TTS_KEY: process.env.GOOGLE_CLOUD_TTS_KEY ?? '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',

  // Default TTS settings
  DEFAULT_TTS_PROVIDER: process.env.DEFAULT_TTS_PROVIDER ?? 'gtts',
  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE ?? 'vi',
  DEFAULT_TEXT_LIMIT: parseInt(process.env.DEFAULT_TEXT_LIMIT ?? '500', 10),

  // Cache
  CACHE_MAX_SIZE_MB: parseInt(process.env.CACHE_MAX_SIZE_MB ?? '100', 10),
  CACHE_TTL_MINUTES: parseInt(process.env.CACHE_TTL_MINUTES ?? '60', 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',

  // Web Dashboard
  WEB_ENABLED: process.env.WEB_ENABLED === 'true',
  WEB_PORT: parseInt(process.env.WEB_PORT ?? '3000', 10),
  WEB_FRONTEND_URL: process.env.WEB_FRONTEND_URL ?? 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  DISCORD_OAUTH_CLIENT_SECRET: process.env.DISCORD_OAUTH_CLIENT_SECRET ?? '',
  DISCORD_OAUTH_REDIRECT_URI: process.env.DISCORD_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/auth/callback',
  BOT_OWNER_ID: process.env.BOT_OWNER_ID ?? '',
} as const;

export function validateEnv(): void {
  if (!env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is required');
  }
  if (!env.DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID is required');
  }
}
