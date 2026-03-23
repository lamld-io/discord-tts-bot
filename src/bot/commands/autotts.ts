/**
 * /autotts command - Quản lý tự động đọc tin nhắn (Admin)
 * /autotts on - Bật auto-read
 * /autotts off - Tắt auto-read
 * /autotts channel #channel - Đọc từ kênh cụ thể
 * /autotts ignore-prefix <prefix> - Prefix bỏ qua
 * /autotts status - Xem trạng thái
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../../database/index.js';

export const data = new SlashCommandBuilder()
  .setName('autotts')
  .setDescription('Tự động đọc tin nhắn trong kênh text (Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('on')
      .setDescription('Bật tự động đọc tin nhắn')
  )
  .addSubcommand(sub =>
    sub.setName('off')
      .setDescription('Tắt tự động đọc tin nhắn')
  )
  .addSubcommand(sub =>
    sub.setName('channel')
      .setDescription('Chỉ đọc tin nhắn từ kênh cụ thể')
      .addChannelOption(opt =>
        opt.setName('text_channel')
          .setDescription('Kênh text để đọc (để trống = đọc tất cả kênh)')
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(sub =>
    sub.setName('ignore-prefix')
      .setDescription('Đặt prefix bỏ qua (tin nhắn bắt đầu bằng prefix sẽ không được đọc)')
      .addStringOption(opt =>
        opt.setName('prefixes')
          .setDescription('Danh sách prefix, phân cách bằng dấu phẩy (ví dụ: !,/,?)')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('Xem trạng thái auto-read')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'on': {
      updateGuildSettings(guildId, { auto_read_enabled: 1 });
      const settings = getGuildSettings(guildId);
      const channelInfo = settings.auto_read_channel_id
        ? `kênh <#${settings.auto_read_channel_id}>`
        : 'tất cả kênh text';
      await interaction.reply(
        `✅ **Auto-Read đã bật!**\n` +
        `Bot sẽ tự động đọc tin nhắn từ ${channelInfo}.\n` +
        `💡 Chỉ đọc tin nhắn từ user đang ở cùng voice channel.`
      );
      break;
    }

    case 'off': {
      updateGuildSettings(guildId, { auto_read_enabled: 0 });
      await interaction.reply('⏹️ **Auto-Read đã tắt.**');
      break;
    }

    case 'channel': {
      const channel = interaction.options.getChannel('text_channel');

      if (channel) {
        updateGuildSettings(guildId, { auto_read_channel_id: channel.id });
        await interaction.reply(`✅ Auto-Read sẽ chỉ đọc tin nhắn từ <#${channel.id}>.`);
      } else {
        updateGuildSettings(guildId, { auto_read_channel_id: '' });
        await interaction.reply('✅ Auto-Read sẽ đọc tin nhắn từ **tất cả kênh text**.');
      }
      break;
    }

    case 'ignore-prefix': {
      const prefixes = interaction.options.getString('prefixes', true);
      updateGuildSettings(guildId, { auto_read_ignore_prefix: prefixes });
      const prefixList = prefixes.split(',').map(p => `\`${p.trim()}\``).join(', ');
      await interaction.reply(`✅ Prefix bỏ qua: ${prefixList}\nTin nhắn bắt đầu bằng các prefix này sẽ không được đọc.`);
      break;
    }

    case 'status': {
      const settings = getGuildSettings(guildId);

      const embed = new EmbedBuilder()
        .setTitle('📖 Auto-Read Status')
        .setColor(settings.auto_read_enabled ? 0x57F287 : 0xED4245)
        .addFields(
          {
            name: '📡 Trạng thái',
            value: settings.auto_read_enabled ? '🟢 Đang bật' : '🔴 Đã tắt',
            inline: true,
          },
          {
            name: '📺 Kênh text',
            value: settings.auto_read_channel_id
              ? `<#${settings.auto_read_channel_id}>`
              : 'Tất cả kênh',
            inline: true,
          },
          {
            name: '🚫 Prefix bỏ qua',
            value: settings.auto_read_ignore_prefix
              .split(',')
              .map(p => `\`${p.trim()}\``)
              .join(', ') || 'Không có',
            inline: true,
          },
        )
        .setFooter({ text: 'Dùng /autotts on|off để bật/tắt' });

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
