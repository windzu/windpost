import type { App as ObsidianApp } from "obsidian";

/**
 * Obsidian wikilink 嵌入图片预处理。
 *
 * 支持语法:
 *   ![[image.png]]
 *   ![[image.png|alt text]]
 *   ![[image.png|400]]
 *   ![[image.png|400x300]]
 *   ![[folder/sub/image.png|描述]]
 *
 * 解析不到的链接保留原样，让用户看到坏链。
 * 非图片扩展名（笔记 embed、pdf、视频等）暂不处理，留给后续 issue。
 */

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface Parsed {
  alt: string;
  width?: number;
  height?: number;
}

function parseModifier(modifier: string): Parsed {
  if (!modifier) return { alt: "" };
  const sizeMatch = modifier.match(/^(\d+)(?:x(\d+))?$/);
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1], 10);
    const height = sizeMatch[2] ? parseInt(sizeMatch[2], 10) : undefined;
    return { alt: "", width, height };
  }
  return { alt: modifier };
}

function getExtension(linkpath: string): string {
  const idx = linkpath.lastIndexOf(".");
  if (idx < 0) return "";
  return linkpath.slice(idx + 1).toLowerCase();
}

export function preprocessObsidianWikilinks(
  markdown: string,
  app: ObsidianApp,
  sourcePath: string,
): string {
  // 匹配 ![[...]], 内容里不能含换行和 ]
  return markdown.replace(/!\[\[([^\]\n]+)\]\]/g, (match, inner: string) => {
    const parts = inner.split("|").map((s) => s.trim());
    const linkpath = parts[0];
    if (!linkpath) return match;

    const ext = getExtension(linkpath);
    if (!IMAGE_EXTENSIONS.has(ext)) return match;

    const file = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    if (!file) return match;

    const url = app.vault.getResourcePath(file);
    const { alt, width, height } = parseModifier(parts[1] ?? "");
    const altText = alt || file.basename;

    // 有尺寸修饰符走原生 HTML（标准 markdown image 不支持宽高）
    if (width || height) {
      const w = width ? ` width="${width}"` : "";
      const h = height ? ` height="${height}"` : "";
      return `<img src="${url}"${w}${h} alt="${escapeAttr(altText)}" />`;
    }

    return `![${altText}](${url})`;
  });
}
