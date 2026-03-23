/**
 * Database module - SQLite cho lưu user/guild settings
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'bot.db');

let db: Database.Database;

export function initDatabase(): void {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Hiệu suất ghi tốt hơn
  db.pragma('foreign_keys = ON');

  // Tạo bảng user settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      provider TEXT DEFAULT 'gtts',
      voice_id TEXT DEFAULT '',
      language TEXT DEFAULT 'vi',
      speed REAL DEFAULT 1.0,
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Tạo bảng guild settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      default_provider TEXT DEFAULT 'gtts',
      default_language TEXT DEFAULT 'vi',
      text_limit INTEGER DEFAULT 500,
      permission_mode TEXT DEFAULT 'open',
      dj_role_id TEXT DEFAULT '',
      auto_read_enabled INTEGER DEFAULT 0,
      auto_read_channel_id TEXT DEFAULT '',
      auto_read_ignore_prefix TEXT DEFAULT '!,/',
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Tạo bảng allowlist (user/role được phép dùng bot)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_allowlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('user', 'role')),
      added_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(guild_id, target_id)
    )
  `);

  // Migration: thêm cột mới nếu bảng đã tồn tại
  try { db.exec(`ALTER TABLE guild_settings ADD COLUMN permission_mode TEXT DEFAULT 'open'`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE guild_settings ADD COLUMN dj_role_id TEXT DEFAULT ''`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE guild_settings ADD COLUMN auto_read_enabled INTEGER DEFAULT 0`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE guild_settings ADD COLUMN auto_read_channel_id TEXT DEFAULT ''`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE guild_settings ADD COLUMN auto_read_ignore_prefix TEXT DEFAULT '!,/'`); } catch { /* exists */ }

  // Migration v2: Reset user_settings provider/language thành NULL
  // Cho phép user tự động theo guild defaults (thay vì snapshot giá trị cũ)
  // Chỉ chạy 1 lần: kiểm tra xem có row nào provider = 'gtts' (default cũ) không
  try {
    const migrated = db.prepare(
      `SELECT 1 FROM user_settings WHERE provider IS NOT NULL LIMIT 1`
    ).get();
    if (migrated) {
      db.exec(`UPDATE user_settings SET provider = NULL, language = NULL WHERE provider IS NOT NULL OR language IS NOT NULL`);
      logger.info('Migration v2: Reset user_settings provider/language to follow guild defaults');
    }
  } catch { /* migration error, safe to ignore */ }

  logger.info(`Database initialized: ${DB_PATH}`);
}

// --- User Settings ---

export interface UserSettings {
  user_id: string;
  guild_id: string;
  provider: string;
  voice_id: string;
  language: string;
  speed: number;
}

interface UserSettingsRow {
  user_id: string;
  guild_id: string;
  provider: string | null;
  voice_id: string | null;
  language: string | null;
  speed: number | null;
}

export function getUserSettings(userId: string, guildId: string): UserSettings {
  const row = db.prepare(
    'SELECT * FROM user_settings WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId) as UserSettingsRow | undefined;

  // Luôn lấy guild defaults để merge
  const guild = getGuildSettings(guildId);

  if (!row) {
    return {
      user_id: userId,
      guild_id: guildId,
      provider: guild.default_provider,
      voice_id: '',
      language: guild.default_language,
      speed: 1.0,
    };
  }

  // Merge: user row override, fallback to guild defaults khi NULL
  return {
    user_id: row.user_id,
    guild_id: row.guild_id,
    provider: row.provider ?? guild.default_provider,
    voice_id: row.voice_id ?? '',
    language: row.language ?? guild.default_language,
    speed: row.speed ?? 1.0,
  };
}

export function updateUserSettings(
  userId: string,
  guildId: string,
  updates: Partial<Pick<UserSettings, 'provider' | 'voice_id' | 'language' | 'speed'>>
): void {
  // Lấy row hiện tại (raw, không merge)
  const current = db.prepare(
    'SELECT * FROM user_settings WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId) as UserSettingsRow | undefined;

  db.prepare(`
    INSERT INTO user_settings (user_id, guild_id, provider, voice_id, language, speed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      guild_id = excluded.guild_id,
      provider = excluded.provider,
      voice_id = excluded.voice_id,
      language = excluded.language,
      speed = excluded.speed,
      updated_at = excluded.updated_at
  `).run(
    userId,
    guildId,
    'provider' in updates ? updates.provider! : (current?.provider ?? null),
    'voice_id' in updates ? updates.voice_id! : (current?.voice_id ?? null),
    'language' in updates ? updates.language! : (current?.language ?? null),
    'speed' in updates ? updates.speed! : (current?.speed ?? null),
  );
}

// --- Guild Settings ---

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

export function getGuildSettings(guildId: string): GuildSettings {
  const row = db.prepare(
    'SELECT * FROM guild_settings WHERE guild_id = ?'
  ).get(guildId) as GuildSettings | undefined;

  return row || {
    guild_id: guildId,
    default_provider: 'gtts',
    default_language: 'vi',
    text_limit: 500,
    permission_mode: 'open',
    dj_role_id: '',
    auto_read_enabled: 0,
    auto_read_channel_id: '',
    auto_read_ignore_prefix: '!,/',
  };
}

export function updateGuildSettings(
  guildId: string,
  updates: Partial<Pick<GuildSettings, 'default_provider' | 'default_language' | 'text_limit' | 'permission_mode' | 'dj_role_id' | 'auto_read_enabled' | 'auto_read_channel_id' | 'auto_read_ignore_prefix'>>
): void {
  const current = getGuildSettings(guildId);

  db.prepare(`
    INSERT INTO guild_settings (guild_id, default_provider, default_language, text_limit, permission_mode, dj_role_id, auto_read_enabled, auto_read_channel_id, auto_read_ignore_prefix, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      default_provider = excluded.default_provider,
      default_language = excluded.default_language,
      text_limit = excluded.text_limit,
      permission_mode = excluded.permission_mode,
      dj_role_id = excluded.dj_role_id,
      auto_read_enabled = excluded.auto_read_enabled,
      auto_read_channel_id = excluded.auto_read_channel_id,
      auto_read_ignore_prefix = excluded.auto_read_ignore_prefix,
      updated_at = excluded.updated_at
  `).run(
    guildId,
    updates.default_provider ?? current.default_provider,
    updates.default_language ?? current.default_language,
    updates.text_limit ?? current.text_limit,
    updates.permission_mode ?? current.permission_mode,
    updates.dj_role_id ?? current.dj_role_id,
    updates.auto_read_enabled ?? current.auto_read_enabled,
    updates.auto_read_channel_id ?? current.auto_read_channel_id,
    updates.auto_read_ignore_prefix ?? current.auto_read_ignore_prefix,
  );
}

// --- Allowlist ---

export interface AllowlistEntry {
  id: number;
  guild_id: string;
  target_id: string;
  target_type: 'user' | 'role';
}

export function addAllowlist(guildId: string, targetId: string, targetType: 'user' | 'role'): boolean {
  try {
    db.prepare(
      'INSERT OR IGNORE INTO guild_allowlist (guild_id, target_id, target_type) VALUES (?, ?, ?)'
    ).run(guildId, targetId, targetType);
    return true;
  } catch {
    return false;
  }
}

export function removeAllowlist(guildId: string, targetId: string): boolean {
  const result = db.prepare(
    'DELETE FROM guild_allowlist WHERE guild_id = ? AND target_id = ?'
  ).run(guildId, targetId);
  return result.changes > 0;
}

export function getAllowlist(guildId: string): AllowlistEntry[] {
  return db.prepare(
    'SELECT * FROM guild_allowlist WHERE guild_id = ?'
  ).all(guildId) as AllowlistEntry[];
}

export function isInAllowlist(guildId: string, userId: string, roleIds: string[]): boolean {
  // Kiểm tra user trực tiếp
  const userMatch = db.prepare(
    'SELECT 1 FROM guild_allowlist WHERE guild_id = ? AND target_id = ? AND target_type = ?'
  ).get(guildId, userId, 'user');
  if (userMatch) return true;

  // Kiểm tra role
  if (roleIds.length > 0) {
    const placeholders = roleIds.map(() => '?').join(',');
    const roleMatch = db.prepare(
      `SELECT 1 FROM guild_allowlist WHERE guild_id = ? AND target_type = 'role' AND target_id IN (${placeholders})`
    ).get(guildId, ...roleIds);
    if (roleMatch) return true;
  }

  return false;
}
