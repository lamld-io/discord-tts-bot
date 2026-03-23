/**
 * Entry point - Khởi tạo và chạy bot
 */

import { validateEnv, env } from './config/env.js';
import { initDatabase } from './database/index.js';
import { Bot } from './bot/client.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('🚀 Discord TTS Bot starting...');

  // Validate environment
  try {
    validateEnv();
  } catch (error) {
    logger.error('Environment validation failed:', error);
    logger.error('Hãy copy .env.example thành .env và điền thông tin cần thiết.');
    process.exit(1);
  }

  // Initialize database
  initDatabase();

  // Create and start bot
  const bot = new Bot();

  // Register commands on first run
  try {
    await bot.registerCommands();
  } catch (error) {
    logger.error('Failed to register commands:', error);
  }

  // Start bot
  await bot.start();

  // Start web dashboard nếu được bật
  if (env.WEB_ENABLED) {
    const { startWebServer } = await import('./web/server.js');
    startWebServer(bot);
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error);
  });
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
