import { normalizePath, TFile, type App } from "obsidian";
import YAML from "yaml";
import { normalizeWechatCoverReference } from "./html";
import { normalizeWechatMetadataText } from "./metadata";
import type { WechatAssetSource, WechatPost } from "./types";

interface PreparedWechatContent extends Omit<WechatPost, "contentHtml"> {
  markdown: string;
  layoutDate: string;
}

interface ImageRef {
  match: string;
  linkpath: string;
  alt: string;
  title: string;
  remote: boolean;
}

export function prepareWechatContent({
  app,
  sourcePath,
  markdown,
  defaultAuthor = "",
}: {
  app: App;
  sourcePath: string;
  markdown: string;
  defaultAuthor?: string;
}): PreparedWechatContent {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const title = metadataText(frontmatter.title)
    || normalizeWechatMetadataText(firstHeading(body))
    || normalizeWechatMetadataText(basename(sourcePath));
  const author = metadataText(frontmatter.wechat_author)
    || metadataText(frontmatter.author)
    || normalizeWechatMetadataText(defaultAuthor);
  const digest = metadataText(frontmatter.wechat_digest)
    || metadataText(frontmatter.summary)
    || metadataText(frontmatter.description);
  const layoutDate = text(frontmatter.date) || sourceCreatedDate(app, sourcePath);
  validateMetadata(title, author, digest);
  const contentSourceUrl = text(frontmatter.wechat_source_url)
    || text(frontmatter.source_url)
    || text(frontmatter.canonical_url);
  validateSourceUrl(contentSourceUrl);

  const replacements = new Map<string, string>();
  const resolvedImages: WechatAssetSource[] = [];

  for (const image of findImages(body)) {
    if (image.remote) {
      resolvedImages.push({ kind: "url", url: image.linkpath });
      continue;
    }
    const file = app.metadataCache.getFirstLinkpathDest(image.linkpath, sourcePath);
    if (!file) {
      throw new Error(`找不到公众号正文图片：${image.linkpath}`);
    }
    const source = vaultAsset(file);
    resolvedImages.push(source);
    replacements.set(
      image.match,
      `![${escapeMarkdownAlt(image.alt || file.basename)}](${assetUrl(source)}${image.title ? ` "${escapeMarkdownTitle(image.title)}"` : ""})`,
    );
  }

  const explicitCover = text(frontmatter.wechat_cover) || text(frontmatter.coverUrl);
  const coverSource = explicitCover
    ? resolveCover(app, sourcePath, explicitCover)
    : resolvedImages[0] || null;

  return {
    title,
    author,
    digest,
    layoutDate,
    markdown: replaceAll(body, replacements),
    contentSourceUrl,
    coverSource,
    needOpenComment: booleanFlag(frontmatter.wechat_open_comment),
    onlyFansCanComment: booleanFlag(frontmatter.wechat_fans_only_comment),
  };
}

function splitFrontmatter(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {} as Record<string, unknown>, body: markdown };
  try {
    const value: unknown = YAML.parse(match[1]);
    return {
      frontmatter: isRecord(value) ? value : {},
      body: markdown.slice(match[0].length),
    };
  } catch (error) {
    throw new Error(`frontmatter 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findImages(markdown: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const match of markdown.matchAll(/!\[\[([^\]\n]+)\]\]/g)) {
    const [linkpath, modifier = ""] = match[1].split("|").map((part) => part.trim());
    if (isImage(linkpath)) {
      refs.push({
        match: match[0],
        linkpath,
        alt: /^\d+(?:x\d+)?$/.test(modifier) ? "" : modifier,
        title: "",
        remote: false,
      });
    }
  }
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g)) {
    const linkpath = safeDecode(match[2]);
    if (isRemoteImage(linkpath)) {
      refs.push({ match: match[0], linkpath, alt: match[1], title: match[3] || "", remote: true });
    } else if (!linkpath.startsWith("data:") && isImage(linkpath)) {
      refs.push({ match: match[0], linkpath, alt: match[1], title: match[3] || "", remote: false });
    }
  }
  return refs;
}

function resolveCover(app: App, sourcePath: string, value: string): WechatAssetSource {
  const normalized = normalizeWechatCoverReference(value);
  if (/^https?:\/\//i.test(normalized)) return { kind: "url", url: normalized };
  if (normalized.startsWith("data:")) return { kind: "data", dataUrl: normalized };
  const file = app.metadataCache.getFirstLinkpathDest(safeDecode(normalized), sourcePath);
  if (!file) throw new Error(`找不到公众号封面：${normalized}`);
  return vaultAsset(file);
}

function vaultAsset(file: TFile): WechatAssetSource {
  return { kind: "vault", path: normalizePath(file.path) };
}

function assetUrl(source: WechatAssetSource): string {
  if (source.kind !== "vault") {
    return source.kind === "url" ? source.url : source.dataUrl;
  }
  return `attachment://vault/${encodeURIComponent(source.path)}`;
}

function validateMetadata(title: string, author: string, digest: string): void {
  if (countText(title) > 32) throw new Error("公众号标题不能超过 32 个字。");
  if (countText(author) > 16) throw new Error("公众号作者不能超过 16 个字。");
  if (countText(digest) > 120) throw new Error("公众号摘要不能超过 120 个字。");
}

function validateSourceUrl(value: string): void {
  if (!value) return;
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("wechat_source_url 必须是 http(s) 地址。");
  }
  if (new TextEncoder().encode(value).byteLength > 1024) {
    throw new Error("wechat_source_url 不能超过 1 KB。");
  }
}

function replaceAll(value: string, replacements: ReadonlyMap<string, string>): string {
  let result = value;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result;
}

function booleanFlag(value: unknown): 0 | 1 {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function isRemoteImage(value: string): boolean {
  return /^https?:\/\/.+/i.test(value);
}

function isImage(value: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(value);
}

function firstHeading(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function metadataText(value: unknown): string {
  return typeof value === "string" ? normalizeWechatMetadataText(value) : "";
}

function countText(value: string): number {
  return Array.from(value).length;
}

function basename(value: string): string {
  const name = normalizePath(value).split("/").pop() || "";
  const extensionStart = name.lastIndexOf(".");
  return extensionStart > 0 ? name.slice(0, extensionStart) : name;
}

function sourceCreatedDate(app: App, sourcePath: string): string {
  const file = app.vault.getAbstractFileByPath(normalizePath(sourcePath));
  if (!(file instanceof TFile) || typeof file.stat.ctime !== "number") return "";
  const date = new Date(file.stat.ctime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/[[\]\\]/g, "\\$&");
}

function escapeMarkdownTitle(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
