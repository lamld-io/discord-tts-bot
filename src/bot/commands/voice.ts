/**
 * /voice command - Cấu hình giọng đọc TTS
 * /voice provider <name> - Chọn provider
 * /voice list - Xem giọng đọc
 * /voice set <voice_id> - Đặt giọng đọc
 * /voice speed <value> - Tốc độ đọc
 * /voice info - Xem cấu hình hiện tại
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { TTSManager } from '../../tts/manager.js';
import { getUserSettings, updateUserSettings } from '../../database/index.js';

export const data = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Cấu hình giọng đọc TTS')
  .addSubcommand(sub =>
    sub.setName('provider')
      .setDescription('Chọn TTS provider')
      .addStringOption(opt =>
        opt.setName('name')
          .setDescription('Tên provider')
          .setRequired(true)
          .addChoices(
            { name: '🔷 Edge TTS (Miễn phí, chất lượng cao)', value: 'edge' },
            { name: '🆓 gTTS (Miễn phí)', value: 'gtts' },
            { name: '🌟 ElevenLabs (Cao cấp)', value: 'elevenlabs' },
            { name: '☁️ Google Cloud', value: 'google' },
            { name: '🤖 OpenAI', value: 'openai' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('Xem danh sách giọng đọc có sẵn')
  )
  .addSubcommand(sub =>
    sub.setName('set')
      .setDescription('Đặt giọng đọc')
      .addStringOption(opt =>
        opt.setName('voice_id')
          .setDescription('ID giọng đọc')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('speed')
      .setDescription('Điều chỉnh tốc độ đọc')
      .addNumberOption(opt =>
        opt.setName('value')
          .setDescription('Tốc độ (0.5 - 2.0, mặc định 1.0)')
          .setRequired(true)
          .setMinValue(0.5)
          .setMaxValue(2.0)
      )
  )
  .addSubcommand(sub =>
    sub.setName('language')
      .setDescription('Đặt ngôn ngữ')
      .addStringOption(opt =>
        opt.setName('lang')
          .setDescription('Mã ngôn ngữ')
          .setRequired(true)
          .addChoices(
            { name: '🇻🇳 Tiếng Việt', value: 'vi' },
            { name: '🇺🇸 English', value: 'en' },
            { name: '🇯🇵 日本語', value: 'ja' },
            { name: '🇰🇷 한국어', value: 'ko' },
            { name: '🇨🇳 中文', value: 'zh' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Xem cấu hình hiện tại')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  ttsManager: TTSManager,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'provider': {
      const name = interaction.options.getString('name', true);
      const provider = ttsManager.getProvider(name);

      if (!provider) {
        await interaction.reply({ content: `❌ Provider \`${name}\` không tồn tại.`, ephemeral: true });
        return;
      }

      if (!provider.isAvailable()) {
        await interaction.reply({
          content: `⚠️ Provider \`${name}\` chưa được cấu hình (thiếu API key). Liên hệ admin.`,
          ephemeral: true,
        });
        return;
      }

      updateUserSettings(member.id, guildId, { provider: name });
      await interaction.reply(`✅ Đã chuyển sang provider **${provider.info.description}**`);
      break;
    }

    case 'list': {
      const settings = getUserSettings(member.id, guildId);
      const provider = ttsManager.getProvider(settings.provider);

      if (!provider) {
        await interaction.reply({ content: '❌ Provider hiện tại không hợp lệ.', ephemeral: true });
        return;
      }

      await interaction.deferReply();
      const voices = await ttsManager.getVoices(settings.provider, settings.language);

      if (voices.length === 0) {
        await interaction.editReply('📋 Không có giọng đọc bổ sung cho provider này.');
        return;
      }

      const voiceList = voices
        .slice(0, 25)
        .map(v => `\`${v.id}\` - ${v.name} (${v.gender || '?'})`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🎤 Giọng đọc - ${provider.info.name}`)
        .setDescription(voiceList)
        .setColor(0x5865F2)
        .setFooter({ text: `Dùng /voice set <id> để chọn giọng` });

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case 'set': {
      const voiceId = interaction.options.getString('voice_id', true);
      updateUserSettings(member.id, guildId, { voice_id: voiceId });
      await interaction.reply(`✅ Đã đặt giọng đọc: \`${voiceId}\``);
      break;
    }

    case 'speed': {
      const speed = interaction.options.getNumber('value', true);
      updateUserSettings(member.id, guildId, { speed });
      await interaction.reply(`✅ Tốc độ đọc: **${speed}x**`);
      break;
    }

    case 'language': {
      const lang = interaction.options.getString('lang', true);
      updateUserSettings(member.id, guildId, { language: lang });
      const langNames: Record<string, string> = {
        vi: '🇻🇳 Tiếng Việt',
        en: '🇺🇸 English',
        ja: '🇯🇵 日本語',
        ko: '🇰🇷 한국어',
        zh: '🇨🇳 中文',
      };
      await interaction.reply(`✅ Ngôn ngữ: **${langNames[lang] || lang}**`);
      break;
    }

    case 'info': {
      const settings = getUserSettings(member.id, guildId);
      const availableProviders = ttsManager.getAvailableProviders();
      const cacheStats = ttsManager.getCacheStats();

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Cấu hình TTS của bạn')
        .setColor(0x5865F2)
        .addFields(
          { name: '📡 Provider', value: `\`${settings.provider}\``, inline: true },
          { name: '🎤 Giọng đọc', value: settings.voice_id || 'Mặc định', inline: true },
          { name: '🌐 Ngôn ngữ', value: `\`${settings.language}\``, inline: true },
          { name: '⚡ Tốc độ', value: `${settings.speed}x`, inline: true },
          { name: '📦 Cache', value: `${cacheStats.entries} entries / ${cacheStats.sizeMB}MB`, inline: true },
          {
            name: '🔌 Providers khả dụng',
            value: availableProviders.map(p => `\`${p.name}\``).join(', ') || 'Không có',
            inline: false,
          },
        );

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
