export interface User {
  id: string;
  username: string;
  avatar: string | null;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

export interface GuildSettings {
  guild_id: string;
  default_provider: string;
  default_language: string;
  text_limit: number;
  permission_mode: 'open' | 'role' | 'allowlist';
  dj_role_id: string;
  auto_read_enabled: number;
  auto_read_channel_id: string;
  auto_read_ignore_prefix: string;
}

export interface AllowlistEntry {
  id: number;
  guild_id: string;
  target_id: string;
  target_type: 'user' | 'role';
}

export interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

export interface AuthResponse {
  user: User;
}

export interface BotStatus {
  uptime: { seconds: number; formatted: string };
  memory: { heapUsed: string; heapTotal: string; rss: string };
  bot: { guilds: number; users: number; voiceConnections: number; ping: number };
  cache: Record<string, unknown>;
}
