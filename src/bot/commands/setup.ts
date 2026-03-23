/**
 * /setup command - Cấu hình phân quyền sử dụng bot (Admin)
 * /setup mode <open|role|allowlist>
 * /setup dj-role <role>
 * /setup allow <user|role>
 * /setup deny <user|role>
 * /setup list
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Role,
  User,
} from 'discord.js';
import {
  getGuildSettings,
  updateGuildSettings,
  addAllowlist,
  removeAllowlist,
  getAllowlist,
} from '../../database/index.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Cấu hình phân quyền bot (Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('mode')
      .setDescription('Đặt chế độ phân quyền')
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Chế độ phân quyền')
          .setRequired(true)
          .addChoices(
            { name: '🌐 Open - Mọi người đều dùng được', value: 'open' },
            { name: '🎵 Role - Chỉ role DJ được dùng', value: 'role' },
            { name: '📋 Allowlist - Chỉ user/role trong danh sách', value: 'allowlist' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('dj-role')
      .setDescription('Đặt role DJ (có quyền dùng TTS)')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role sẽ có quyền dùng bot')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('allow')
      .setDescription('Thêm user hoặc role vào danh sách cho phép')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User cần thêm')
      )
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role cần thêm')
      )
  )
  .addSubcommand(sub =>
    sub.setName('deny')
      .setDescription('Xóa user hoặc role khỏi danh sách cho phép')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User cần xóa')
      )
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role cần xóa')
      )
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('Xem cấu hình phân quyền hiện tại')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'mode': {
      const mode = interaction.options.getString('type', true) as 'open' | 'role' | 'allowlist';
      updateGuildSettings(guildId, { permission_mode: mode });

      const modeNames: Record<string, string> = {
        open: '🌐 **Open** - Mọi người đều dùng được',
        role: '🎵 **Role** - Chỉ role DJ được dùng',
        allowlist: '📋 **Allowlist** - Chỉ user/role trong danh sách',
      };
      await interaction.reply(`✅ Chế độ phân quyền: ${modeNames[mode]}`);
      break;
    }

    case 'dj-role': {
      const role = interaction.options.getRole('role', true) as Role;
      updateGuildSettings(guildId, { dj_role_id: role.id });
      await interaction.reply(`✅ Role DJ: **${role.name}** - Thành viên có role này sẽ được dùng bot.`);
      break;
    }

    case 'allow': {
      const user = interaction.options.getUser('user') as User | null;
      const role = interaction.options.getRole('role') as Role | null;

      if (!user && !role) {
        await interaction.reply({ content: '❌ Cần chọn ít nhất một user hoặc role.', ephemeral: true });
        return;
      }

      const added: string[] = [];

      if (user) {
        addAllowlist(guildId, user.id, 'user');
        added.push(`👤 ${user.username}`);
      }
      if (role) {
        addAllowlist(guildId, role.id, 'role');
        added.push(`🏷️ ${role.name}`);
      }

      await interaction.reply(`✅ Đã thêm vào danh sách cho phép:\n${added.join('\n')}`);
      break;
    }

    case 'deny': {
      const user = interaction.options.getUser('user') as User | null;
      const role = interaction.options.getRole('role') as Role | null;

      if (!user && !role) {
        await interaction.reply({ content: '❌ Cần chọn ít nhất một user hoặc role.', ephemeral: true });
        return;
      }

      const removed: string[] = [];

      if (user) {
        removeAllowlist(guildId, user.id);
        removed.push(`👤 ${user.username}`);
      }
      if (role) {
        removeAllowlist(guildId, role.id);
        removed.push(`🏷️ ${role.name}`);
      }

      await interaction.reply(`✅ Đã xóa khỏi danh sách cho phép:\n${removed.join('\n')}`);
      break;
    }

    case 'list': {
      const settings = getGuildSettings(guildId);
      const allowlist = getAllowlist(guildId);

      const modeNames: Record<string, string> = {
        open: '🌐 Open (Mọi người)',
        role: '🎵 Role (Cần role DJ)',
        allowlist: '📋 Allowlist (Danh sách)',
      };

      const embed = new EmbedBuilder()
        .setTitle('🔐 Cấu Hình Phân Quyền')
        .setColor(0x5865F2)
        .addFields(
          {
            name: '📋 Chế độ',
            value: modeNames[settings.permission_mode] || settings.permission_mode,
            inline: true,
          },
          {
            name: '🎵 Role DJ',
            value: settings.dj_role_id ? `<@&${settings.dj_role_id}>` : 'Chưa đặt',
            inline: true,
          },
        );

      if (allowlist.length > 0) {
        const listStr = allowlist.map(entry => {
          if (entry.target_type === 'user') return `👤 <@${entry.target_id}>`;
          return `🏷️ <@&${entry.target_id}>`;
        }).join('\n');

        embed.addFields({
          name: `📋 Allowlist (${allowlist.length})`,
          value: listStr.substring(0, 1024),
        });
      } else {
        embed.addFields({
          name: '📋 Allowlist',
          value: 'Trống',
        });
      }

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
