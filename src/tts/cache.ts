/**
 * Audio Cache Layer - LRU Cache cho audio đã synthesis
 * Giảm latency và chi phí API bằng cách cache kết quả
 */

import { createHash } from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface CacheEntry {
  audio: Buffer;
  format: string;
  createdAt: number;
  size: number;
}

export class AudioCache {
  private cache = new Map<string, CacheEntry>();
  private totalSizeBytes = 0;
  private readonly maxSizeBytes: number;
  private readonly ttlMs: number;

  constructor() {
    this.maxSizeBytes = env.CACHE_MAX_SIZE_MB * 1024 * 1024;
    this.ttlMs = env.CACHE_TTL_MINUTES * 60 * 1000;

    // Dọn cache hết hạn mỗi 5 phút
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /** Tạo cache key từ text + provider + voice + speed */
  static createKey(text: string, provider: string, voiceId: string, speed: number): string {
    const raw = `${provider}:${voiceId}:${speed}:${text}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Lấy audio từ cache */
  get(key: string): { audio: Buffer; format: string } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Kiểm tra hết hạn
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.delete(key);
      return null;
    }

    logger.debug(`Cache hit: ${key.substring(0, 8)}...`);
    return { audio: entry.audio, format: entry.format };
  }

  /** Lưu audio vào cache */
  set(key: string, audio: Buffer, format: string): void {
    const size = audio.byteLength;

    // Giải phóng bộ nhớ nếu cache đầy
    while (this.totalSizeBytes + size > this.maxSizeBytes && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.delete(oldestKey);
    }

    // Nếu audio quá lớn, không cache
    if (size > this.maxSizeBytes * 0.5) {
      logger.debug(`Audio too large to cache: ${(size / 1024).toFixed(1)}KB`);
      return;
    }

    this.cache.set(key, { audio, format, createdAt: Date.now(), size });
    this.totalSizeBytes += size;

    logger.debug(`Cached: ${key.substring(0, 8)}... (${(size / 1024).toFixed(1)}KB, total: ${(this.totalSizeBytes / 1024 / 1024).toFixed(1)}MB)`);
  }

  private delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSizeBytes -= entry.size;
      this.cache.delete(key);
    }
  }

  /** Dọn dẹp entries hết hạn */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /** Thống kê cache */
  getStats(): { entries: number; sizeMB: number; maxMB: number } {
    return {
      entries: this.cache.size,
      sizeMB: Math.round(this.totalSizeBytes / 1024 / 1024 * 100) / 100,
      maxMB: env.CACHE_MAX_SIZE_MB,
    };
  }

  /** Xóa toàn bộ cache */
  clear(): void {
    this.cache.clear();
    this.totalSizeBytes = 0;
    logger.info('Cache cleared');
  }
}
