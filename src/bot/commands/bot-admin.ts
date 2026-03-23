/**
 * /bot command - Lệnh bảo trì bot (Admin)
 * /bot status - Thông tin bot
 * /bot cache clear - Xóa cache
 * /bot reconnect - Reconnect voice
 * /bot leave-all - Rời tất cả voice channels
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { TTSManager } from '../../tts/manager.js';
import { VoiceConnectionManager } from '../../voice/connection.js';
import { VoicePlayer } from '../../voice/player.js';

const startTime = Date.now();

export const data = new SlashCommandBuilder()
  .setName('bot')
  .setDescription('Quản lý và bảo trì bot (Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('Xem trạng thái bot')
  )
  .addSubcommand(sub =>
    sub.setName('cache')
      .setDescription('Quản lý TTS cache')
      .addStringOption(opt =>
        opt.setName('action')
          .setDescription('Hành động')
          .setRequired(true)
          .addChoices(
            { name: '📊 Xem thống kê', value: 'stats' },
            { name: '🗑️ Xóa toàn bộ cache', value: 'clear' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('reconnect')
      .setDescription('Reconnect voice channel hiện tại')
  )
  .addSubcommand(sub =>
    sub.setName('leave-all')
      .setDescription('Bot rời tất cả voice channels')
  );

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  ttsManager: TTSManager,
  voiceManager: VoiceConnectionManager,
  voicePlayer: VoicePlayer,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'status': {
      const uptime = Date.now() - startTime;
      const memUsage = process.memoryUsage();
      const cacheStats = ttsManager.getCacheStats();
      const client = interaction.client;

      // Đếm voice connections
      let voiceConnections = 0;
      client.guilds.cache.forEach(guild => {
        if (voiceManager.isConnected(guild.id)) {
          voiceConnections++;
        }
      });

      const providers = ttsManager.getAvailableProviders();

      const embed = new EmbedBuilder()
        .setTitle('🤖 Trạng Thái Bot')
        .setColor(0x57F287)
        .setThumbnail(client.user?.displayAvatarURL() || '')
        .addFields(
          { name: '⏱️ Uptime', value: formatUptime(uptime), inline: true },
          { name: '🏠 Servers', value: `${client.guilds.cache.size}`, inline: true },
          { name: '🔊 Voice Connections', value: `${voiceConnections}`, inline: true },
          { name: '💾 RAM', value: `${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`, inline: true },
          { name: '📦 Cache', value: `${cacheStats.entries} entries (${cacheStats.sizeMB} MB)`, inline: true },
          { name: '🔌 Node.js', value: process.version, inline: true },
          {
            name: '📡 Providers khả dụng',
            value: providers.map(p => `\`${p.name}\``).join(', ') || 'Không có',
          },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      break;
    }

    case 'cache': {
      const action = interaction.options.getString('action', true);

      if (action === 'stats') {
        const stats = ttsManager.getCacheStats();
        await interaction.reply(
          `📊 **Cache Stats:**\n` +
          `• Entries: **${stats.entries}**\n` +
          `• Kích thước: **${stats.sizeMB} MB** / ${stats.maxMB} MB\n` +
          `• Sử dụng: **${stats.maxMB > 0 ? Math.round(stats.sizeMB / stats.maxMB * 100) : 0}%**`
        );
      } else if (action === 'clear') {
        ttsManager.clearCache();
        await interaction.reply('🗑️ Đã xóa toàn bộ TTS cache!');
      }
      break;
    }

    case 'reconnect': {
      const member = interaction.member as GuildMember;
      const voiceChannel = member.voice.channel;

      if (!voiceChannel) {
        await interaction.reply({ content: '❌ Bạn cần vào voice channel trước.', ephemeral: true });
        return;
      }

      const guildId = interaction.guildId!;

      // Ngắt kết nối cũ
      voicePlayer.cleanup(guildId);
      voiceManager.leave(guildId);

      // Kết nối lại
      try {
        await voiceManager.join(voiceChannel);
        await interaction.reply(`🔄 Đã reconnect thành công vào **${voiceChannel.name}**!`);
      } catch (error) {
        await interaction.reply({
          content: `❌ Reconnect thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ephemeral: true,
        });
      }
      break;
    }

    case 'leave-all': {
      const client = interaction.client;
      let count = 0;

      client.guilds.cache.forEach(guild => {
        if (voiceManager.isConnected(guild.id)) {
          voicePlayer.cleanup(guild.id);
          voiceManager.leave(guild.id);
          count++;
        }
      });

      await interaction.reply(`👋 Đã rời **${count}** voice channel(s).`);
      break;
    }
  }
}
