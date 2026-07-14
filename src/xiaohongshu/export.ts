import { normalizePath, type App } from "obsidian";
import YAML from "yaml";
import type {
  XiaohongshuCard,
  XiaohongshuDraft,
  XiaohongshuPost,
} from "./types";

interface PreparedCards {
  cards: XiaohongshuCard[];
  truncated: boolean;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;
const CARD_PADDING_X = 92;
const CARD_PADDING_Y = 110;
const CARD_TEXT_LIMIT = 210;
const SUGGESTED_TITLE_LENGTH = 20;
const SUGGESTED_CONTENT_LENGTH = 1000;
const BODY_FONT = "42px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans CJK SC', sans-serif";
const TITLE_FONT = "700 72px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans CJK SC', sans-serif";

export function prepareXiaohongshuDraft({
  markdown,
  path,
  maxImages,
}: {
  markdown: string;
  path: string;
  maxImages: number;
}): XiaohongshuDraft {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const titleFromHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  const title = readString(frontmatter.title) || titleFromHeading || basename(path);
  const coverText = readString(frontmatter.cover_text) || title;
  const content = markdownToPlainText(bodyWithoutTitle(body));
  const tags = readTags(frontmatter.tags);
  const preparedCards = buildCards(content, coverText, clampImages(maxImages));
  const warnings: string[] = [];
  const channels = readTags(frontmatter.channels);

  if (frontmatter.type && frontmatter.type !== "shortform") {
    warnings.push("当前笔记不是 shortform，建议先拆成独立短内容。");
  }
  if (channels.length > 0 && !channels.includes("xiaohongshu")) {
    warnings.push("channels 未包含 xiaohongshu。");
  }
  if (countText(title) > SUGGESTED_TITLE_LENGTH) {
    warnings.push(`标题较长（${countText(title)} 字符），建议控制在 ${SUGGESTED_TITLE_LENGTH} 字以内。`);
  }
  if (!title.includes("我")) {
    warnings.push("标题里没有「我」，请确认是否体现了个人判断。");
  }
  if (!content) warnings.push("小红书正文为空。");
  if (countText(content) > SUGGESTED_CONTENT_LENGTH) {
    warnings.push(`正文较长（${countText(content)} 字符），建议发布前再精简。`);
  }
  if (tags.length === 0) warnings.push("尚未填写小红书标签。");
  if (preparedCards.truncated) {
    warnings.push(`正文超出 ${preparedCards.cards.length} 张卡片的容量，部分内容只会保留在正文中。`);
  }

  return {
    title,
    coverText,
    content,
    tags,
    cards: preparedCards.cards,
    warnings,
  };
}

export async function exportXiaohongshuPost({
  app,
  draft,
  path,
}: {
  app: App;
  draft: XiaohongshuDraft;
  path: string;
}): Promise<XiaohongshuPost> {
  const outputDir = await createOutputDir(app, path);
  const imagePaths: string[] = [];

  for (let i = 0; i < draft.cards.length; i += 1) {
    const png = await renderCard(draft.cards[i], i, draft.cards.length);
    const fileName = `${String(i + 1).padStart(2, "0")}.png`;
    const vaultPath = normalizePath(`${outputDir.vaultPath}/${fileName}`);
    await app.vault.adapter.writeBinary(vaultPath, png);
    imagePaths.push(`${outputDir.absolutePath}/${fileName}`);
  }

  return {
    ...draft,
    imagePaths,
    outputDir: outputDir.absolutePath,
  };
}

function splitFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: markdown };
  try {
    const parsed = YAML.parse(match[1]);
    return {
      frontmatter: parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {},
      body: markdown.slice(match[0].length),
    };
  } catch {
    return { frontmatter: {}, body: markdown.slice(match[0].length) };
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return unique(values.flatMap((item) => parseTags(String(item))));
}

function parseTags(value: string): string[] {
  return unique(value
    .split(/[,，、\s]+/)
    .map((tag) => tag.replace(/^#+|#+$/g, "").trim())
    .filter(Boolean))
    .slice(0, 12);
}

function bodyWithoutTitle(body: string): string {
  return body.replace(/^(?:\s*\r?\n)*#\s+.+(?:\r?\n|$)/, "").trim();
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?(?:\[![^\]]+\]\s*)?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildCards(content: string, coverText: string, maxImages: number): PreparedCards {
  const cards: XiaohongshuCard[] = [{ kind: "cover", text: coverText }];
  if (!content || maxImages <= 1) return { cards, truncated: Boolean(content) };

  const units = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => chunkText(block, CARD_TEXT_LIMIT));
  const pages: string[] = [];
  let current = "";

  for (const unit of units) {
    const next = current ? `${current}\n\n${unit}` : unit;
    if (countText(next) > CARD_TEXT_LIMIT && current) {
      pages.push(current);
      current = unit;
    } else {
      current = next;
    }
  }
  if (current) pages.push(current);

  const selected = pages.slice(0, maxImages - 1);
  cards.push(...selected.map((text): XiaohongshuCard => ({ kind: "content", text })));
  return { cards, truncated: pages.length > selected.length };
}

function chunkText(value: string, max: number): string[] {
  const chars = Array.from(value);
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += max) {
    chunks.push(chars.slice(i, i + max).join(""));
  }
  return chunks.length > 0 ? chunks : [value];
}

function clampImages(value: number): number {
  if (!Number.isFinite(value)) return 9;
  return Math.max(1, Math.min(18, Math.round(value)));
}

async function createOutputDir(app: App, sourcePath: string) {
  const slug = slugify(sourcePath.replace(/\.md$/i, ""));
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "");
  const vaultPath = normalizePath(`.windpost/xiaohongshu/${slug}-${stamp}`);
  await ensureFolder(app, ".windpost");
  await ensureFolder(app, ".windpost/xiaohongshu");
  await ensureFolder(app, vaultPath);

  const adapter = app.vault.adapter as typeof app.vault.adapter & {
    getBasePath?: () => string;
  };
  const basePath = adapter.getBasePath?.();
  if (!basePath) throw new Error("当前 vault adapter 不支持本地路径。");

  return {
    vaultPath,
    absolutePath: `${basePath}/${vaultPath}`,
  };
}

async function ensureFolder(app: App, path: string) {
  if (!(await app.vault.adapter.exists(path))) {
    await app.vault.createFolder(path);
  }
}

async function renderCard(
  card: XiaohongshuCard,
  index: number,
  total: number,
): Promise<ArrayBuffer> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 初始化失败。");

  drawBackground(ctx);
  if (card.kind === "cover") drawCover(ctx, card.text);
  else drawContentCard(ctx, card.text);
  drawPageNumber(ctx, index, total);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("PNG 导出失败。"));
    }, "image/png");
  });
  return await blob.arrayBuffer();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = "#e94b5f";
  ctx.fillRect(0, 0, 22, CARD_HEIGHT);
  ctx.fillStyle = "#111827";
  ctx.fillRect(22, 0, 6, CARD_HEIGHT);
}

function drawCover(ctx: CanvasRenderingContext2D, coverText: string) {
  ctx.fillStyle = "#111827";
  ctx.font = TITLE_FONT;
  drawWrappedText(ctx, coverText, CARD_PADDING_X, 360, CARD_WIDTH - CARD_PADDING_X * 2, 94, 8);
}

function drawContentCard(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = BODY_FONT;
  ctx.fillStyle = "#1f2937";
  drawWrappedText(
    ctx,
    text,
    CARD_PADDING_X,
    CARD_PADDING_Y + 34,
    CARD_WIDTH - CARD_PADDING_X * 2,
    68,
    16,
  );
}

function drawPageNumber(ctx: CanvasRenderingContext2D, index: number, total: number) {
  ctx.font = "500 30px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = "#9ca3af";
  ctx.textAlign = "right";
  ctx.fillText(`${index + 1}/${total}`, CARD_WIDTH - CARD_PADDING_X, CARD_HEIGHT - 88);
  ctx.textAlign = "left";
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines = wrapText(ctx, text, maxWidth);
  for (const line of lines.slice(0, maxLines)) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    else lines.push("");
  }
  return lines;
}

function countText(text: string): number {
  return Array.from(text).length;
}

function basename(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") || "未命名笔记";
}

function slugify(value: string): string {
  return value
    .split("/")
    .pop()!
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "note";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
