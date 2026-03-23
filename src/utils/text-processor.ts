/**
 * Text processor: sanitization, chunking, validation
 * Xử lý văn bản trước khi gửi TTS
 */

/** Loại bỏ các ký tự không phù hợp cho TTS */
export function sanitizeText(text: string): string {
  return text
    // Loại bỏ Discord mentions (<@123>, <@!123>, <@&123>)
    .replace(/<@[!&]?\d+>/g, '')
    // Loại bỏ channel mentions (<#123>)
    .replace(/<#\d+>/g, '')
    // Loại bỏ custom emoji (<:name:123>, <a:name:123>)
    .replace(/<a?:\w+:\d+>/g, '')
    // Loại bỏ markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Loại bỏ markdown strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Loại bỏ markdown underline
    .replace(/__([^_]+)__/g, '$1')
    // Loại bỏ code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Loại bỏ spoiler tags
    .replace(/\|\|([^|]+)\|\|/g, '$1')
    // Loại bỏ URLs
    .replace(/https?:\/\/\S+/g, '')
    // Loại bỏ newlines thừa, thay bằng dấu chấm
    .replace(/\n+/g, '. ')
    // Loại bỏ khoảng trắng thừa
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chia text thành các chunk nhỏ hơn tại ranh giới câu */
export function chunkText(text: string, maxLength: number = 500): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Tìm vị trí cắt tốt nhất (tại dấu câu)
    let cutIndex = -1;

    // Ưu tiên cắt tại dấu chấm cuối câu
    const sentenceEnd = remaining.lastIndexOf('. ', maxLength);
    if (sentenceEnd > maxLength * 0.3) {
      cutIndex = sentenceEnd + 1;
    }

    // Thử cắt tại dấu chấm hỏi
    if (cutIndex === -1) {
      const questionEnd = remaining.lastIndexOf('? ', maxLength);
      if (questionEnd > maxLength * 0.3) {
        cutIndex = questionEnd + 1;
      }
    }

    // Thử cắt tại dấu chấm than
    if (cutIndex === -1) {
      const exclamEnd = remaining.lastIndexOf('! ', maxLength);
      if (exclamEnd > maxLength * 0.3) {
        cutIndex = exclamEnd + 1;
      }
    }

    // Thử cắt tại dấu phẩy
    if (cutIndex === -1) {
      const commaEnd = remaining.lastIndexOf(', ', maxLength);
      if (commaEnd > maxLength * 0.3) {
        cutIndex = commaEnd + 1;
      }
    }

    // Fallback: cắt tại khoảng trắng gần nhất
    if (cutIndex === -1) {
      const spaceEnd = remaining.lastIndexOf(' ', maxLength);
      cutIndex = spaceEnd > 0 ? spaceEnd : maxLength;
    }

    chunks.push(remaining.substring(0, cutIndex).trim());
    remaining = remaining.substring(cutIndex).trim();
  }

  return chunks.filter(c => c.length > 0);
}

/** Validate text trước khi xử lý TTS */
export function validateText(text: string, maxLength: number): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Văn bản không được để trống.' };
  }

  const sanitized = sanitizeText(text);
  if (sanitized.length === 0) {
    return { valid: false, error: 'Văn bản không có nội dung hợp lệ sau khi xử lý.' };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `Văn bản vượt quá giới hạn ${maxLength} ký tự (hiện tại: ${sanitized.length}).` };
  }

  return { valid: true };
}
