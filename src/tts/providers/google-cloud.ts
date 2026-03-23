/**
 * Google Cloud TTS Provider
 * Sử dụng Google Cloud Text-to-Speech API
 * Free tier: 1 triệu ký tự/tháng
 */

import { TTSProvider, TTSProviderInfo, TTSOptions, TTSResult, VoiceInfo } from '../provider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

interface GoogleVoice {
  name: string;
  ssmlGender: string;
  languageCodes: string[];
}

export class GoogleCloudTTSProvider implements TTSProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://texttospeech.googleapis.com/v1';

  readonly info: TTSProviderInfo = {
    name: 'google',
    description: 'Google Cloud TTS - Đa ngôn ngữ, free tier rộng rãi',
    supportedLanguages: ['vi-VN', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'zh-CN', 'fr-FR'],
    requiresApiKey: true,
    supportsStreaming: false,
  };

  constructor() {
    this.apiKey = env.GOOGLE_CLOUD_TTS_KEY;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  private getLanguageCode(lang: string): string {
    const mapping: Record<string, string> = {
      'vi': 'vi-VN',
      'en': 'en-US',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'es': 'es-ES',
    };
    return mapping[lang] || `${lang}-${lang.toUpperCase()}`;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new Error('Google Cloud TTS API key not configured');
    }

    const startTime = Date.now();
    const languageCode = this.getLanguageCode(options.language || 'vi');

    try {
      const response = await fetch(
        `${this.baseUrl}/text:synthesize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode,
              name: options.voiceId || `${languageCode}-Neural2-A`,
              ssmlGender: 'FEMALE',
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: options.speed ?? 1.0,
              sampleRateHertz: 24000,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google Cloud TTS error ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as { audioContent: string };
      const audioBuffer = Buffer.from(data.audioContent, 'base64');

      return {
        audio: audioBuffer,
        format: 'mp3',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Google Cloud TTS synthesis failed:', error);
      throw error;
    }
  }

  async getVoices(language?: string): Promise<VoiceInfo[]> {
    if (!this.isAvailable()) return [];

    try {
      const langCode = language ? this.getLanguageCode(language) : '';
      const url = langCode
        ? `${this.baseUrl}/voices?languageCode=${langCode}&key=${this.apiKey}`
        : `${this.baseUrl}/voices?key=${this.apiKey}`;

      const response = await fetch(url);
      if (!response.ok) return [];

      const data = (await response.json()) as { voices: GoogleVoice[] };
      return (data.voices || []).map((v) => ({
        id: v.name,
        name: v.name,
        language: v.languageCodes[0] || '',
        gender: v.ssmlGender === 'MALE' ? 'male' as const : 'female' as const,
      }));
    } catch (error) {
      logger.error('Failed to fetch Google Cloud voices:', error);
      return [];
    }
  }
}
