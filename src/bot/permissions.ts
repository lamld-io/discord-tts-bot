/**
 * Permission middleware
 * Kiểm tra quyền user trước khi thực thi command
 */

import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { getGuildSettings, isInAllowlist } from '../database/index.js';

export type PermissionLevel = 'everyone' | 'dj' | 'admin';

/** Mapping command → permission level cần thiết */
const COMMAND_PERMISSIONS: Record<string, PermissionLevel> = {
  'tts': 'dj',        // Cần ít nhất quyền DJ (hoặc open mode)
  'join': 'dj',
  'leave': 'dj',
  'voice': 'everyone', // Mọi người xem/chỉnh cấu hình cá nhân
  'config': 'admin',   // Chỉ admin
  'setup': 'admin',    // Chỉ admin
  'bot': 'admin',      // Chỉ admin
  'autotts': 'admin',  // Chỉ admin
};

/**
 * Kiểm tra quyền sử dụng command
 * Trả về null nếu được phép, hoặc chuỗi lỗi nếu bị chặn
 */
export function checkPermission(
  interaction: ChatInputCommandInteraction,
): string | null {
  const commandName = interaction.commandName;
  const requiredLevel = COMMAND_PERMISSIONS[commandName] || 'everyone';
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;

  // Admin Discord luôn bypass
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.id === interaction.guild?.ownerId
  ) {
    return null; // Cho phép
  }

  // Lệnh admin → chặn ngay
  if (requiredLevel === 'admin') {
    return '🔒 Lệnh này chỉ dành cho **Administrator**.';
  }

  // Lệnh everyone → cho phép tất cả
  if (requiredLevel === 'everyone') {
    return null;
  }

  // Lệnh DJ → kiểm tra theo permission_mode
  const settings = getGuildSettings(guildId);

  switch (settings.permission_mode) {
    case 'open':
      // Ai cũng dùng được
      return null;

    case 'role': {
      // Cần có role DJ
      if (!settings.dj_role_id) {
        return null; // Chưa cấu hình role → cho phép tất cả
      }
      if (member.roles.cache.has(settings.dj_role_id)) {
        return null; // Có role DJ
      }
      return `🔒 Bạn cần có role <@&${settings.dj_role_id}> để sử dụng lệnh này.`;
    }

    case 'allowlist': {
      // Kiểm tra allowlist
      const roleIds = member.roles.cache.map(r => r.id);
      if (isInAllowlist(guildId, member.id, roleIds)) {
        return null;
      }
      return '🔒 Bạn không có trong danh sách được phép sử dụng bot.';
    }

    default:
      return null;
  }
}
