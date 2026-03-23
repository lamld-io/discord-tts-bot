/**
 * OpenAI TTS Provider
 * Sử dụng OpenAI Audio API (TTS-1 / TTS-1-HD)
 */

import { TTSProvider, TTSProviderInfo, TTSOptions, TTSResult, VoiceInfo } from '../provider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', gender: 'neutral' as const },
  { id: 'echo', name: 'Echo', gender: 'male' as const },
  { id: 'fable', name: 'Fable', gender: 'male' as const },
  { id: 'onyx', name: 'Onyx', gender: 'male' as const },
  { id: 'nova', name: 'Nova', gender: 'female' as const },
  { id: 'shimmer', name: 'Shimmer', gender: 'female' as const },
  { id: 'ash', name: 'Ash', gender: 'male' as const },
  { id: 'coral', name: 'Coral', gender: 'female' as const },
  { id: 'sage', name: 'Sage', gender: 'neutral' as const },
];

export class OpenAITTSProvider implements TTSProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';

  readonly info: TTSProviderInfo = {
    name: 'openai',
    description: 'OpenAI TTS - Giọng tự nhiên, hỗ trợ điều khiển cảm xúc',
    supportedLanguages: ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es'],
    requiresApiKey: true,
    supportsStreaming: true,
  };

  constructor() {
    this.apiKey = env.OPENAI_API_KEY;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: options.voiceId || 'nova',
          response_format: 'mp3',
          speed: options.speed ?? 1.0,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI TTS error ${response.status}: ${errorBody}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      return {
        audio: Buffer.from(arrayBuffer),
        format: 'mp3',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('OpenAI TTS synthesis failed:', error);
      throw error;
    }
  }

  async getVoices(_language?: string): Promise<VoiceInfo[]> {
    // OpenAI voices are multilingual, same set for all languages
    return OPENAI_VOICES.map((v) => ({
      id: v.id,
      name: v.name,
      language: 'multi',
      gender: v.gender,
    }));
  }
}
