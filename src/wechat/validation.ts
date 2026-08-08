const CONTENT_HTML_LIMIT = 1024 * 1024;
const CONTENT_TEXT_LIMIT = 20_000;

export function countWechatContentCharacters(content: string): number {
  const visibleText = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|ensp|emsp);/gi, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/gi, "x")
    .replace(/&#(?:x[0-9a-f]+|\d+);/gi, "x");
  return Array.from(visibleText).length;
}

export function validateWechatContent(content: string): void {
  const characters = countWechatContentCharacters(content);
  if (characters >= CONTENT_TEXT_LIMIT) {
    throw new Error(`公众号正文可见文字为 ${characters} 字符，达到 20,000 字符上限。`);
  }
  const bytes = new TextEncoder().encode(content).byteLength;
  if (bytes >= CONTENT_HTML_LIMIT) {
    throw new Error(`公众号正文 HTML 为 ${bytes} 字节，达到 1 MB 上限。`);
  }
}
