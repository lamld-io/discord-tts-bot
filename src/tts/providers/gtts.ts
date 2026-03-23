/**
 * gTTS Provider - Google Translate TTS (miễn phí)
 * Sử dụng google-tts-api package
 * Đây là provider fallback mặc định
 */

import googleTTS from 'google-tts-api';
import { TTSProvider, TTSProviderInfo, TTSOptions, TTSResult, VoiceInfo } from '../provider.js';
import { logger } from '../../utils/logger.js';

export class GTTSProvider implements TTSProvider {
  readonly info: TTSProviderInfo = {
    name: 'gtts',
    description: 'Google Translate TTS - Miễn phí, đơn giản',
    supportedLanguages: ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es', 'th'],
    requiresApiKey: false,
    supportsStreaming: false,
  };

  isAvailable(): boolean {
    return true; // Luôn sẵn sàng, không cần API key
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();
    const lang = options.language || 'vi';
    const speed = options.speed ?? 1.0;

    try {
      // google-tts-api giới hạn 200 ký tự mỗi request
      // Tự động chia nhỏ cho text dài
      if (text.length > 200) {
        const results = await googleTTS.getAllAudioUrls(text, {
          lang,
          slow: speed < 0.8,
          host: 'https://translate.google.com',
        });

        // Tải tất cả audio chunks
        const audioChunks: Buffer[] = [];
        for (const result of results) {
          const response = await fetch(result.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          audioChunks.push(Buffer.from(arrayBuffer));
        }

        return {
          audio: Buffer.concat(audioChunks),
          format: 'mp3',
          latencyMs: Date.now() - startTime,
        };
      }

      // Text ngắn: lấy một URL duy nhất
      const url = await googleTTS.getAudioUrl(text, {
        lang,
        slow: speed < 0.8,
        host: 'https://translate.google.com',
      });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      return {
        audio: Buffer.from(arrayBuffer),
        format: 'mp3',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('gTTS synthesis failed:', error);
      throw error;
    }
  }

  async getVoices(_language?: string): Promise<VoiceInfo[]> {
    // gTTS không hỗ trợ chọn giọng, chỉ có 1 giọng mặc định cho mỗi ngôn ngữ
    return [
      { id: 'vi-default', name: 'Tiếng Việt (Mặc định)', language: 'vi', gender: 'female' },
      { id: 'en-default', name: 'English (Default)', language: 'en', gender: 'female' },
    ];
  }
}
