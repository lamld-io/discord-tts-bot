/**
 * TTS Manager - Quản lý providers, fallback, và caching
 * Đây là lớp trung gian giữa commands và TTS providers
 */

import { TTSProvider, TTSOptions, TTSResult, VoiceInfo } from './provider.js';
import { GTTSProvider } from './providers/gtts.js';
import { ElevenLabsProvider } from './providers/elevenlabs.js';
import { GoogleCloudTTSProvider } from './providers/google-cloud.js';
import { OpenAITTSProvider } from './providers/openai.js';
import { EdgeTTSProvider } from './providers/edge-tts.js';
import { AudioCache } from './cache.js';
import { logger } from '../utils/logger.js';

export class TTSManager {
  private providers: Map<string, TTSProvider> = new Map();
  private cache: AudioCache;
  private fallbackOrder: string[];

  constructor() {
    this.cache = new AudioCache();

    // Đăng ký tất cả providers
    const gtts = new GTTSProvider();
    const elevenlabs = new ElevenLabsProvider();
    const google = new GoogleCloudTTSProvider();
    const openai = new OpenAITTSProvider();
    const edge = new EdgeTTSProvider();

    this.providers.set('gtts', gtts);
    this.providers.set('elevenlabs', elevenlabs);
    this.providers.set('google', google);
    this.providers.set('openai', openai);
    this.providers.set('edge', edge);

    // Thứ tự fallback: elevenlabs → google → openai → edge → gtts
    this.fallbackOrder = ['elevenlabs', 'google', 'openai', 'edge', 'gtts'];

    // Log providers sẵn sàng
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        logger.info(`TTS Provider sẵn sàng: ${name} - ${provider.info.description}`);
      } else {
        logger.debug(`TTS Provider không khả dụng: ${name} (thiếu API key)`);
      }
    }
  }

  /** Lấy provider theo tên */
  getProvider(name: string): TTSProvider | undefined {
    return this.providers.get(name);
  }

  /** Lấy danh sách providers khả dụng */
  getAvailableProviders(): { name: string; description: string }[] {
    const available: { name: string; description: string }[] = [];
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        available.push({ name, description: provider.info.description });
      }
    }
    return available;
  }

  /** Synthesis với caching và fallback */
  async synthesize(
    text: string,
    providerName: string,
    options: TTSOptions
  ): Promise<TTSResult> {
    // Kiểm tra cache
    const cacheKey = AudioCache.createKey(
      text,
      providerName,
      options.voiceId || 'default',
      options.speed || 1.0
    );

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        audio: cached.audio,
        format: cached.format as TTSResult['format'],
        latencyMs: 0, // Cache hit = instant
      };
    }

    // Thử provider được chọn
    const provider = this.providers.get(providerName);
    if (provider && provider.isAvailable()) {
      try {
        const result = await provider.synthesize(text, options);
        this.cache.set(cacheKey, result.audio, result.format);
        logger.info(`TTS [${providerName}]: "${text.substring(0, 50)}..." (${result.latencyMs}ms)`);
        return result;
      } catch (error) {
        logger.warn(`Provider ${providerName} failed, trying fallback...`, error);
      }
    }

    // Fallback: thử các provider khác
    for (const fallbackName of this.fallbackOrder) {
      if (fallbackName === providerName) continue;

      const fallbackProvider = this.providers.get(fallbackName);
      if (!fallbackProvider || !fallbackProvider.isAvailable()) continue;

      try {
        const result = await fallbackProvider.synthesize(text, options);
        this.cache.set(cacheKey, result.audio, result.format);
        logger.info(`TTS fallback [${fallbackName}]: "${text.substring(0, 50)}..." (${result.latencyMs}ms)`);
        return result;
      } catch (error) {
        logger.warn(`Fallback provider ${fallbackName} also failed:`, error);
      }
    }

    throw new Error('Tất cả TTS providers đều thất bại. Vui lòng kiểm tra cấu hình.');
  }

  /** Lấy danh sách giọng đọc của một provider */
  async getVoices(providerName: string, language?: string): Promise<VoiceInfo[]> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.isAvailable()) return [];
    return provider.getVoices(language);
  }

  /** Lấy thống kê cache */
  getCacheStats() {
    return this.cache.getStats();
  }

  /** Xóa cache */
  clearCache(): void {
    this.cache.clear();
  }
}
