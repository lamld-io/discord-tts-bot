/**
 * /config command - Cấu hình server (admin only)
 * /config limit <number> - Giới hạn ký tự
 * /config provider <name> - Provider mặc định cho server
 * /config language <lang> - Ngôn ngữ mặc định
 * /config info - Xem cấu hình server
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../../database/index.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Cấu hình bot cho server (Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('limit')
      .setDescription('Giới hạn ký tự cho mỗi lệnh /tts')
      .addIntegerOption(opt =>
        opt.setName('chars')
          .setDescription('Số ký tự tối đa (100 - 5000)')
          .setRequired(true)
          .setMinValue(100)
          .setMaxValue(5000)
      )
  )
  .addSubcommand(sub =>
    sub.setName('provider')
      .setDescription('Provider mặc định cho server')
      .addStringOption(opt =>
        opt.setName('name')
          .setDescription('Tên provider')
          .setRequired(true)
          .addChoices(
            { name: '🔷 Edge TTS (Miễn phí, chất lượng cao)', value: 'edge' },
            { name: '🆓 gTTS (Miễn phí)', value: 'gtts' },
            { name: '🌟 ElevenLabs', value: 'elevenlabs' },
            { name: '☁️ Google Cloud', value: 'google' },
            { name: '🤖 OpenAI', value: 'openai' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('language')
      .setDescription('Ngôn ngữ mặc định cho server')
      .addStringOption(opt =>
        opt.setName('lang')
          .setDescription('Mã ngôn ngữ')
          .setRequired(true)
          .addChoices(
            { name: '🇻🇳 Tiếng Việt', value: 'vi' },
            { name: '🇺🇸 English', value: 'en' },
            { name: '🇯🇵 日本語', value: 'ja' },
            { name: '🇰🇷 한국어', value: 'ko' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Xem cấu hình server hiện tại')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'limit': {
      const chars = interaction.options.getInteger('chars', true);
      updateGuildSettings(guildId, { text_limit: chars });
      await interaction.reply(`✅ Giới hạn ký tự cho \`/tts\`: **${chars}** ký tự`);
      break;
    }

    case 'provider': {
      const name = interaction.options.getString('name', true);
      updateGuildSettings(guildId, { default_provider: name });
      await interaction.reply(`✅ Provider mặc định cho server: **${name}**`);
      break;
    }

    case 'language': {
      const lang = interaction.options.getString('lang', true);
      updateGuildSettings(guildId, { default_language: lang });
      const langNames: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', ja: '日本語', ko: '한국어' };
      await interaction.reply(`✅ Ngôn ngữ mặc định: **${langNames[lang] || lang}**`);
      break;
    }

    case 'info': {
      const settings = getGuildSettings(guildId);
      const embed = new EmbedBuilder()
        .setTitle('🛠️ Cấu hình Server')
        .setColor(0xED4245)
        .addFields(
          { name: '📡 Provider mặc định', value: `\`${settings.default_provider}\``, inline: true },
          { name: '🌐 Ngôn ngữ mặc định', value: `\`${settings.default_language}\``, inline: true },
          { name: '📝 Giới hạn ký tự', value: `${settings.text_limit}`, inline: true },
        );

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
