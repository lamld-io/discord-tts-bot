/**
 * /join & /leave commands - Quản lý kết nối voice channel
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { VoiceConnectionManager } from '../../voice/connection.js';
import { VoicePlayer } from '../../voice/player.js';

// --- /join ---

export const joinData = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Bot tham gia kênh thoại của bạn');

export async function joinExecute(
  interaction: ChatInputCommandInteraction,
  voiceManager: VoiceConnectionManager,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ Bạn cần vào một kênh thoại trước!',
      ephemeral: true,
    });
    return;
  }

  try {
    await voiceManager.join(voiceChannel);
    await interaction.reply(`✅ Đã tham gia kênh thoại **${voiceChannel.name}**!`);
  } catch (error) {
    await interaction.reply({
      content: `❌ ${error instanceof Error ? error.message : 'Không thể kết nối'}`,
      ephemeral: true,
    });
  }
}

// --- /leave ---

export const leaveData = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Bot rời kênh thoại');

export async function leaveExecute(
  interaction: ChatInputCommandInteraction,
  voiceManager: VoiceConnectionManager,
  voicePlayer: VoicePlayer,
): Promise<void> {
  const guildId = interaction.guildId!;

  if (!voiceManager.isConnected(guildId)) {
    await interaction.reply({
      content: '❌ Bot không ở trong kênh thoại nào!',
      ephemeral: true,
    });
    return;
  }

  voicePlayer.cleanup(guildId);
  voiceManager.leave(guildId);
  await interaction.reply('👋 Đã rời kênh thoại!');
}
