/**
 * Audio Player - Phát audio trong voice channel với queue system
 */

import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnection,
  StreamType,
} from '@discordjs/voice';
import { Readable } from 'stream';
import { logger } from '../utils/logger.js';

interface QueueItem {
  audio: Buffer;
  format: string;
  text: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class VoicePlayer {
  private players = new Map<string, AudioPlayer>();
  private queues = new Map<string, QueueItem[]>();
  private isPlaying = new Map<string, boolean>();

  /** Lấy hoặc tạo player cho guild */
  private getPlayer(guildId: string): AudioPlayer {
    let player = this.players.get(guildId);
    if (!player) {
      player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      player.on('error', (error) => {
        logger.error(`Audio player error (${guildId}):`, error);
        this.isPlaying.set(guildId, false);
        this.processQueue(guildId);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        this.isPlaying.set(guildId, false);
        this.processQueue(guildId);
      });

      this.players.set(guildId, player);
    }
    return player;
  }

  /** Thêm audio vào queue và phát */
  enqueue(
    guildId: string,
    connection: VoiceConnection,
    audio: Buffer,
    format: string,
    text: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Đảm bảo player được subscribe vào connection
      const player = this.getPlayer(guildId);
      connection.subscribe(player);

      // Thêm vào queue
      if (!this.queues.has(guildId)) {
        this.queues.set(guildId, []);
      }

      this.queues.get(guildId)!.push({ audio, format, text, resolve, reject });
      logger.debug(`Queued audio (${guildId}): "${text.substring(0, 30)}..."`);

      // Xử lý queue nếu chưa đang phát
      if (!this.isPlaying.get(guildId)) {
        this.processQueue(guildId);
      }
    });
  }

  /** Xử lý queue - phát audio tiếp theo */
  private processQueue(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) return;

    const player = this.getPlayer(guildId);
    const item = queue.shift()!;

    try {
      this.isPlaying.set(guildId, true);

      // Tạo readable stream từ buffer
      const stream = Readable.from(item.audio);

      // Tạo audio resource
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });

      // Set volume
      resource.volume?.setVolume(1.0);

      // Phát
      player.play(resource);

      logger.debug(`Playing audio (${guildId}): "${item.text.substring(0, 30)}..."`);

      // Resolve khi phát xong
      const onIdle = () => {
        player.off(AudioPlayerStatus.Idle, onIdle);
        player.off('error', onError);
        item.resolve();
      };

      const onError = (error: Error) => {
        player.off(AudioPlayerStatus.Idle, onIdle);
        player.off('error', onError);
        item.reject(error);
      };

      player.once(AudioPlayerStatus.Idle, onIdle);
      player.once('error', onError);
    } catch (error) {
      this.isPlaying.set(guildId, false);
      item.reject(error instanceof Error ? error : new Error(String(error)));
      this.processQueue(guildId); // Thử item tiếp theo
    }
  }

  /** Bỏ qua audio đang phát */
  skip(guildId: string): boolean {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      return true;
    }
    return false;
  }

  /** Xóa toàn bộ queue */
  clearQueue(guildId: string): number {
    const queue = this.queues.get(guildId);
    if (!queue) return 0;

    const count = queue.length;
    queue.forEach(item => item.resolve());
    queue.length = 0;
    return count;
  }

  /** Lấy số lượng items trong queue */
  getQueueSize(guildId: string): number {
    return this.queues.get(guildId)?.length || 0;
  }

  /** Dọn dẹp player khi bot rời channel */
  cleanup(guildId: string): void {
    this.clearQueue(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      this.players.delete(guildId);
    }
    this.isPlaying.delete(guildId);
    this.queues.delete(guildId);
  }
}
