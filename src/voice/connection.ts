/**
 * Voice Connection Manager
 * Quản lý kết nối voice channel với hỗ trợ DAVE E2EE
 */

import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import { logger } from '../utils/logger.js';

// Import DAVE E2EE support
// @snazzah/davey patches @discordjs/voice to support DAVE E2EE
// It must be imported before any voice connections are made
try {
  await import('@snazzah/davey');
  logger.info('DAVE E2EE protocol initialized successfully');
} catch {
  logger.warn('DAVE E2EE (@snazzah/davey) not available - voice connections may fail on Discord 2026');
}

export class VoiceConnectionManager {
  private connections = new Map<string, VoiceConnection>();

  /** Join một voice channel */
  async join(channel: VoiceBasedChannel): Promise<VoiceConnection> {
    const guildId = channel.guild.id;

    // Kiểm tra kết nối hiện tại
    const existing = this.connections.get(guildId) || getVoiceConnection(guildId);
    if (existing) {
      if (existing.joinConfig.channelId === channel.id) {
        return existing; // Đã ở trong channel này
      }
      // Chuyển sang channel khác
      existing.destroy();
      this.connections.delete(guildId);
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // Chờ kết nối sẵn sàng
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      logger.info(`Joined voice channel: ${channel.name} (${guildId})`);
    } catch (error) {
      connection.destroy();
      throw new Error(`Không thể kết nối voice channel: ${error}`);
    }

    // Xử lý disconnect
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Thử reconnect
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Đang reconnect, ok
      } catch {
        // Không thể reconnect, cleanup
        connection.destroy();
        this.connections.delete(guildId);
        logger.info(`Disconnected from voice channel (${guildId})`);
      }
    });

    connection.on('error', (error) => {
      logger.error(`Voice connection error (${guildId}):`, error);
    });

    this.connections.set(guildId, connection);
    return connection;
  }

  /** Rời voice channel */
  leave(guildId: string): boolean {
    const connection = this.connections.get(guildId) || getVoiceConnection(guildId);
    if (connection) {
      connection.destroy();
      this.connections.delete(guildId);
      logger.info(`Left voice channel (${guildId})`);
      return true;
    }
    return false;
  }

  /** Lấy connection hiện tại */
  get(guildId: string): VoiceConnection | undefined {
    return this.connections.get(guildId) || getVoiceConnection(guildId) || undefined;
  }

  /** Kiểm tra bot có đang ở voice channel nào không */
  isConnected(guildId: string): boolean {
    const conn = this.get(guildId);
    return conn?.state.status === VoiceConnectionStatus.Ready;
  }

  /** Lấy số lượng voice connections đang hoạt động */
  getActiveConnections(): number {
    return this.connections.size;
  }
}
