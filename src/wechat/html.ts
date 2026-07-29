const IMAGE_SRC_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/giu;

export function extractImageSources(html: string): string[] {
  const sources: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(IMAGE_SRC_RE)) {
    const source = decodeHtmlAttribute(match[3]);
    if (!source || seen.has(source)) continue;
    seen.add(source);
    sources.push(source);
  }
  return sources;
}

export function replaceImageSources(
  html: string,
  replacements: ReadonlyMap<string, string>,
): string {
  return html.replace(IMAGE_SRC_RE, (match, prefix: string, quote: string, encodedSource: string) => {
    const source = decodeHtmlAttribute(encodedSource);
    const replacement = replacements.get(source);
    if (!replacement) return match;
    return `${prefix}${quote}${escapeHtmlAttribute(replacement)}${quote}`;
  });
}

export function sourceToAsset(source: string) {
  if (source.startsWith("attachment://vault/")) {
    return {
      kind: "vault" as const,
      path: decodeURIComponent(source.slice("attachment://vault/".length)),
    };
  }
  if (source.startsWith("data:")) {
    return { kind: "data" as const, dataUrl: source };
  }
  if (/^https?:\/\//i.test(source)) {
    return { kind: "url" as const, url: source };
  }
  return null;
}

export function isWechatHostedImage(source: string): boolean {
  try {
    const hostname = new URL(source).hostname.toLowerCase();
    return hostname === "mmbiz.qpic.cn" || hostname.endsWith(".mmbiz.qpic.cn");
  } catch {
    return false;
  }
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

