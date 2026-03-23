/**
 * /tts command - Chuyển text thành giọng nói và phát trong voice channel
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { TTSManager } from '../../tts/manager.js';
import { VoiceConnectionManager } from '../../voice/connection.js';
import { VoicePlayer } from '../../voice/player.js';
import { getUserSettings, getGuildSettings } from '../../database/index.js';
import { sanitizeText, validateText, chunkText } from '../../utils/text-processor.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('tts')
  .setDescription('Chuyển văn bản thành giọng nói và phát trong kênh thoại')
  .addStringOption(option =>
    option
      .setName('text')
      .setDescription('Văn bản cần đọc')
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  ttsManager: TTSManager,
  voiceManager: VoiceConnectionManager,
  voicePlayer: VoicePlayer,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;

  // Kiểm tra user có trong voice channel không
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ Bạn cần vào một kênh thoại trước!',
      ephemeral: true,
    });
    return;
  }

  const rawText = interaction.options.getString('text', true);
  const guildSettings = getGuildSettings(guildId);
  const userSettings = getUserSettings(member.id, guildId);

  // Validate text
  const sanitized = sanitizeText(rawText);
  const validation = validateText(sanitized, guildSettings.text_limit);
  if (!validation.valid) {
    await interaction.reply({ content: `❌ ${validation.error}`, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    // Kết nối voice channel (nếu chưa)
    let connection = voiceManager.get(guildId);
    if (!connection) {
      connection = await voiceManager.join(voiceChannel);
    }

    // Chia text thành chunks nếu cần
    const chunks = chunkText(sanitized, 500);

    for (const chunk of chunks) {
      // Synthesis
      const result = await ttsManager.synthesize(chunk, userSettings.provider, {
        language: userSettings.language,
        speed: userSettings.speed,
        voiceId: userSettings.voice_id || undefined,
      });

      // Phát audio
      await voicePlayer.enqueue(guildId, connection, result.audio, result.format, chunk);
    }

    // Thông báo thành công
    const providerInfo = ttsManager.getProvider(userSettings.provider);
    await interaction.editReply({
      content: `🔊 **Đã phát:** ${rawText.substring(0, 100)}${rawText.length > 100 ? '...' : ''}\n` +
        `📡 Provider: \`${providerInfo?.info.name || userSettings.provider}\` | ` +
        `🌐 Ngôn ngữ: \`${userSettings.language}\``,
    });
  } catch (error) {
    logger.error('TTS command error:', error);
    await interaction.editReply({
      content: `❌ Lỗi: ${error instanceof Error ? error.message : 'Không thể tạo giọng nói'}`,
    });
  }
}
