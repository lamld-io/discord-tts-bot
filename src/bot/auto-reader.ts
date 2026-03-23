/**
 * Auto-Reader - Tự động đọc tin nhắn mới trong kênh text
 * Chỉ đọc tin nhắn từ user đang ở cùng voice channel với bot
 */

import { Client, Events, Message, GuildMember } from 'discord.js';
import { TTSManager } from '../tts/manager.js';
import { VoiceConnectionManager } from '../voice/connection.js';
import { VoicePlayer } from '../voice/player.js';
import { getGuildSettings, getUserSettings } from '../database/index.js';
import { sanitizeText } from '../utils/text-processor.js';
import { logger } from '../utils/logger.js';

/** Rate limiter: guild_id → last message timestamp */
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 1 message / 2 giây / guild

export function setupAutoReader(
  client: Client,
  ttsManager: TTSManager,
  voiceManager: VoiceConnectionManager,
  voicePlayer: VoicePlayer,
): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      await handleMessage(message, ttsManager, voiceManager, voicePlayer);
    } catch (error) {
      logger.error('Auto-read error:', error);
    }
  });

  logger.info('Auto-Reader module initialized');
}

async function handleMessage(
  message: Message,
  ttsManager: TTSManager,
  voiceManager: VoiceConnectionManager,
  voicePlayer: VoicePlayer,
): Promise<void> {
  // --- Bộ lọc cơ bản ---

  // Bỏ qua: bot messages, DM, system messages
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content || message.content.trim().length === 0) return;

  const guildId = message.guild.id;

  // Kiểm tra auto-read có bật không
  const settings = getGuildSettings(guildId);
  if (!settings.auto_read_enabled) return;

  // Kiểm tra kênh text (nếu đã cấu hình kênh cụ thể)
  if (settings.auto_read_channel_id && settings.auto_read_channel_id !== message.channel.id) {
    return;
  }

  // Bot có đang ở voice channel không
  if (!voiceManager.isConnected(guildId)) return;

  // User có đang ở cùng voice channel với bot không
  const member = message.member as GuildMember | null;
  if (!member?.voice.channel) return;

  const botConnection = voiceManager.get(guildId);
  if (!botConnection) return;

  if (member.voice.channel.id !== botConnection.joinConfig.channelId) return;

  // --- Bộ lọc nội dung ---

  const text = message.content.trim();

  // Bỏ qua: prefix bỏ qua (lệnh)
  const ignorePrefixes = settings.auto_read_ignore_prefix
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  for (const prefix of ignorePrefixes) {
    if (text.startsWith(prefix)) return;
  }

  // Bỏ qua: chỉ có emoji, sticker, hoặc attachment mà không có text
  if (/^(<a?:\w+:\d+>\s*)+$/.test(text)) return; // Chỉ custom emoji
  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(text) && text.length <= 8) return;

  // Sanitize text
  let sanitized = sanitizeText(text);
  if (sanitized.length === 0) return;

  // Giới hạn độ dài
  if (sanitized.length > settings.text_limit) {
    sanitized = sanitized.substring(0, settings.text_limit);
  }

  // --- Rate limiting ---
  const now = Date.now();
  const lastTime = rateLimitMap.get(guildId) || 0;
  if (now - lastTime < RATE_LIMIT_MS) return;
  rateLimitMap.set(guildId, now);

  // --- Tạo TTS ---

  // Prepend tên user để phân biệt
  const displayName = member.displayName || message.author.displayName;
  const fullText = `${displayName} nói: ${sanitized}`;

  // Lấy cấu hình user
  const userSettings = getUserSettings(member.id, guildId);

  try {
    const result = await ttsManager.synthesize(fullText, userSettings.provider, {
      language: userSettings.language,
      speed: userSettings.speed,
      voiceId: userSettings.voice_id || undefined,
    });

    // Phát audio
    const connection = voiceManager.get(guildId);
    if (connection) {
      await voicePlayer.enqueue(guildId, connection, result.audio, result.format, sanitized);
    }

    logger.debug(`Auto-read [${guildId}]: "${displayName}: ${sanitized.substring(0, 40)}..." (${result.latencyMs}ms)`);
  } catch (error) {
    logger.error(`Auto-read TTS failed [${guildId}]:`, error);
  }
}
