/**
 * Edge TTS Provider - Microsoft Edge Neural Voices (miễn phí)
 * Sử dụng edge-tts-universal package (Communicate class)
 * Chất lượng cao hơn gTTS đáng kể, không cần API key
 */

import { Communicate } from 'edge-tts-universal';
import { TTSProvider, TTSProviderInfo, TTSOptions, TTSResult, VoiceInfo } from '../provider.js';
import { logger } from '../../utils/logger.js';

// Mapping ngôn ngữ → voice mặc định
const DEFAULT_VOICES: Record<string, { female: string; male: string }> = {
  'vi': { female: 'vi-VN-HoaiMyNeural', male: 'vi-VN-NamMinhNeural' },
  'en': { female: 'en-US-JennyNeural', male: 'en-US-GuyNeural' },
  'ja': { female: 'ja-JP-NanamiNeural', male: 'ja-JP-KeitaNeural' },
  'ko': { female: 'ko-KR-SunHiNeural', male: 'ko-KR-InJoonNeural' },
  'zh': { female: 'zh-CN-XiaoxiaoNeural', male: 'zh-CN-YunxiNeural' },
  'fr': { female: 'fr-FR-DeniseNeural', male: 'fr-FR-HenriNeural' },
  'de': { female: 'de-DE-KatjaNeural', male: 'de-DE-ConradNeural' },
  'es': { female: 'es-ES-ElviraNeural', male: 'es-ES-AlvaroNeural' },
  'th': { female: 'th-TH-PremwadeeNeural', male: 'th-TH-NiwatNeural' },
};

export class EdgeTTSProvider implements TTSProvider {
  readonly info: TTSProviderInfo = {
    name: 'edge',
    description: 'Edge TTS - Microsoft Neural Voices (miễn phí, chất lượng cao)',
    supportedLanguages: Object.keys(DEFAULT_VOICES),
    requiresApiKey: false,
    supportsStreaming: true,
  };

  isAvailable(): boolean {
    return true; // Luôn sẵn sàng, không cần API key
  }

  private getDefaultVoice(language: string): string {
    const voices = DEFAULT_VOICES[language] || DEFAULT_VOICES['vi'];
    return voices.female; // Mặc định dùng giọng nữ
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();
    const voice = options.voiceId || this.getDefaultVoice(options.language || 'vi');
    const speed = options.speed ?? 1.0;

    try {
      // Tính rate percentage: 1.0 = "+0%", 1.5 = "+50%", 0.5 = "-50%"
      const ratePercent = Math.round((speed - 1.0) * 100);
      const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

      const communicate = new Communicate(text, {
        voice,
        rate: rateString,
      });

      // Thu thập audio chunks từ async generator
      const audioChunks: Buffer[] = [];

      for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          audioChunks.push(Buffer.from(chunk.data));
        }
      }

      if (audioChunks.length === 0) {
        throw new Error('No audio data received from Edge TTS');
      }

      return {
        audio: Buffer.concat(audioChunks),
        format: 'mp3',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Edge TTS synthesis failed:', error);
      throw error;
    }
  }

  async getVoices(language?: string): Promise<VoiceInfo[]> {
    // Trả về danh sách voices từ mapping đã biết
    const voices: VoiceInfo[] = [];

    const langs = language ? { [language]: DEFAULT_VOICES[language] } : DEFAULT_VOICES;

    for (const [lang, voicePair] of Object.entries(langs)) {
      if (!voicePair) continue;
      voices.push({
        id: voicePair.female,
        name: voicePair.female.replace('Neural', '').replace(/-/g, ' '),
        language: lang,
        gender: 'female',
      });
      voices.push({
        id: voicePair.male,
        name: voicePair.male.replace('Neural', '').replace(/-/g, ' '),
        language: lang,
        gender: 'male',
      });
    }

    return voices;
  }
}
