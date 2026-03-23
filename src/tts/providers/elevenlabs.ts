/**
 * ElevenLabs TTS Provider - Chất lượng cao nhất
 * Hỗ trợ WebSocket streaming, giọng tự nhiên
 */

import { TTSProvider, TTSProviderInfo, TTSOptions, TTSResult, VoiceInfo } from '../provider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
}

export class ElevenLabsProvider implements TTSProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  readonly info: TTSProviderInfo = {
    name: 'elevenlabs',
    description: 'ElevenLabs - Giọng nói cực tự nhiên, chất lượng cao',
    supportedLanguages: ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es'],
    requiresApiKey: true,
    supportsStreaming: true,
  };

  constructor() {
    this.apiKey = env.ELEVENLABS_API_KEY;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const startTime = Date.now();
    const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel - default voice

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_flash_v2_5', // Ultra-low latency ~75ms
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              speed: options.speed ?? 1.0,
            },
            output_format: 'mp3_44100_128',
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ElevenLabs API error ${response.status}: ${errorBody}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      return {
        audio: Buffer.from(arrayBuffer),
        format: 'mp3',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('ElevenLabs synthesis failed:', error);
      throw error;
    }
  }

  async getVoices(_language?: string): Promise<VoiceInfo[]> {
    if (!this.isAvailable()) return [];

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { voices: ElevenLabsVoice[] };
      return data.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        language: 'multi', // ElevenLabs voices are multilingual
        gender: v.labels?.gender as 'male' | 'female' | undefined,
      }));
    } catch (error) {
      logger.error('Failed to fetch ElevenLabs voices:', error);
      return [];
    }
  }
}
