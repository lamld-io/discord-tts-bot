/**
 * TTSProvider interface - Giao diện chung cho tất cả TTS engines
 * Mỗi provider phải implement interface này
 */

export interface TTSOptions {
  /** Mã ngôn ngữ, ví dụ: 'vi', 'en' */
  language: string;
  /** Tốc độ đọc (0.5 - 2.0, mặc định 1.0) */
  speed?: number;
  /** ID giọng đọc (tùy provider) */
  voiceId?: string;
}

export interface TTSResult {
  /** Audio data dạng Buffer */
  audio: Buffer;
  /** Định dạng audio (mp3, opus, pcm...) */
  format: 'mp3' | 'opus' | 'ogg' | 'pcm' | 'wav';
  /** Thời gian xử lý (ms) */
  latencyMs: number;
}

export interface TTSProviderInfo {
  /** Tên provider */
  name: string;
  /** Mô tả */
  description: string;
  /** Các ngôn ngữ hỗ trợ */
  supportedLanguages: string[];
  /** Có cần API key không */
  requiresApiKey: boolean;
  /** Có hỗ trợ streaming không */
  supportsStreaming: boolean;
}

export interface TTSProvider {
  /** Thông tin provider */
  readonly info: TTSProviderInfo;

  /** Kiểm tra provider có sẵn sàng không (API key hợp lệ, etc.) */
  isAvailable(): boolean;

  /** Chuyển text thành audio */
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;

  /** Lấy danh sách giọng đọc có sẵn */
  getVoices(language?: string): Promise<VoiceInfo[]>;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}
