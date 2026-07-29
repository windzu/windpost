import { normalizePath, type App } from "obsidian";
import YAML from "yaml";
import type {
  XiaohongshuCard,
  XiaohongshuCardBlock,
  XiaohongshuDraft,
  XiaohongshuPost,
} from "./types";

interface PreparedCards {
  cards: XiaohongshuCard[];
  truncated: boolean;
  coverOverflow: boolean;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;
const CARD_PADDING_X = 104;
const CONTENT_TOP = 158;
const CONTENT_BOTTOM = 1168;
const CONTENT_MAX_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;
const COVER_MAX_HEIGHT = 820;
const BLOCK_GAP = 42;
const SUGGESTED_TITLE_LENGTH = 20;
const SUGGESTED_CONTENT_LENGTH = 1000;
const COLOR_INK = "#141413";
const COLOR_PAPER = "#faf9f5";
const COLOR_MUTED = "#8f8d85";
const COLOR_LINE = "#e8e6dc";
const COLOR_ACCENT = "#d97757";
const SANS_FAMILY = "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const SERIF_FAMILY = "Georgia, 'Songti SC', STSong, serif";
const BODY_FONT = `44px ${SERIF_FAMILY}`;
const BODY_LINE_HEIGHT = 72;
const EMPHASIS_FONT = `600 56px ${SANS_FAMILY}`;
const EMPHASIS_LINE_HEIGHT = 76;

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
  if (preparedCards.coverOverflow) {
    warnings.push("封面文案过长，无法在保证可读性的前提下完整排入头图，请精简 cover_text。");
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
    const png = await renderXiaohongshuCard(draft.cards[i], i, draft.cards.length);
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
  const ctx = createMeasureContext();
  const coverLayout = layoutCoverText(ctx, coverText);
  const cards: XiaohongshuCard[] = [{
    kind: "cover",
    text: coverText,
    lines: coverLayout.lines,
    fontSize: coverLayout.fontSize,
  }];
  if (!content || maxImages <= 1) {
    return {
      cards,
      truncated: Boolean(content),
      coverOverflow: coverLayout.overflow,
    };
  }

  const blocks: XiaohongshuCardBlock[] = content
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ kind: "paragraph", text }));
  const fittedBlocks = blocks.flatMap((block) => layoutBlock(ctx, block));
  const pages: XiaohongshuCardBlock[][] = [];
  let current: XiaohongshuCardBlock[] = [];
  let currentHeight = 0;

  for (const block of fittedBlocks) {
    const blockHeight = measureBlockHeight(ctx, block);
    const nextHeight = currentHeight + (current.length > 0 ? BLOCK_GAP : 0) + blockHeight;
    if (nextHeight > CONTENT_MAX_HEIGHT && current.length > 0) {
      pages.push(current);
      current = [block];
      currentHeight = blockHeight;
    } else {
      current.push(block);
      currentHeight = nextHeight;
    }
  }
  if (current.length > 0) pages.push(current);

  const selected = pages.slice(0, maxImages - 1);
  cards.push(...selected.map((page): XiaohongshuCard => ({
    kind: "content",
    text: page.map((block) => block.text).join("\n\n"),
    blocks: page,
  })));
  return {
    cards,
    truncated: pages.length > selected.length,
    coverOverflow: coverLayout.overflow,
  };
}

function layoutCoverText(
  ctx: CanvasRenderingContext2D | null,
  text: string,
): { lines: string[]; fontSize: number; overflow: boolean } {
  const maxWidth = CARD_WIDTH - CARD_PADDING_X * 2;
  const candidates = [88, 80, 72, 64, 56, 48, 40];
  for (const fontSize of candidates) {
    if (ctx) ctx.font = `700 ${fontSize}px ${SANS_FAMILY}`;
    const lines = wrapText(ctx, text, maxWidth, fontSize);
    const lineHeight = Math.round(fontSize * 1.28);
    if (lines.length * lineHeight <= COVER_MAX_HEIGHT) {
      return { lines, fontSize, overflow: false };
    }
  }

  const fontSize = candidates.at(-1)!;
  if (ctx) ctx.font = `700 ${fontSize}px ${SANS_FAMILY}`;
  const lines = wrapText(ctx, text, maxWidth, fontSize);
  return { lines, fontSize, overflow: lines.length * Math.round(fontSize * 1.28) > COVER_MAX_HEIGHT };
}

function createMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  return document.createElement("canvas").getContext("2d");
}

function layoutBlock(
  ctx: CanvasRenderingContext2D | null,
  block: XiaohongshuCardBlock,
): XiaohongshuCardBlock[] {
  setBlockFont(ctx, block.kind);
  const fontSize = block.kind === "emphasis" ? 56 : 44;
  const lineHeight = block.kind === "emphasis" ? EMPHASIS_LINE_HEIGHT : BODY_LINE_HEIGHT;
  const lines = wrapText(ctx, block.text, CARD_WIDTH - CARD_PADDING_X * 2, fontSize);
  if (lines.length * lineHeight <= CONTENT_MAX_HEIGHT) return [{ ...block, lines }];
  const maxLines = Math.max(1, Math.floor(CONTENT_MAX_HEIGHT / lineHeight));
  const chunks: XiaohongshuCardBlock[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const chunkLines = lines.slice(i, i + maxLines);
    chunks.push({ ...block, text: chunkLines.join("\n"), lines: chunkLines });
  }
  return chunks;
}

function measureBlockHeight(
  ctx: CanvasRenderingContext2D | null,
  block: XiaohongshuCardBlock,
): number {
  setBlockFont(ctx, block.kind);
  const lineHeight = block.kind === "emphasis" ? EMPHASIS_LINE_HEIGHT : BODY_LINE_HEIGHT;
  if (block.lines) return block.lines.length * lineHeight;
  const fontSize = block.kind === "emphasis" ? 56 : 44;
  return wrapText(ctx, block.text, CARD_WIDTH - CARD_PADDING_X * 2, fontSize).length * lineHeight;
}

function setBlockFont(ctx: CanvasRenderingContext2D | null, kind: XiaohongshuCardBlock["kind"]) {
  if (ctx) ctx.font = kind === "emphasis" ? EMPHASIS_FONT : BODY_FONT;
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

export async function renderXiaohongshuCard(
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
  if (card.kind === "cover") drawCover(ctx, card);
  else drawContentCard(ctx, card.blocks || [{ kind: "paragraph", text: card.text }]);
  drawFooter(ctx, index, total);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("PNG 导出失败。"));
    }, "image/png");
  });
  return await blob.arrayBuffer();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_PAPER;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawTopMark(ctx);
}

function drawTopMark(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_ACCENT;
  ctx.fillRect(CARD_PADDING_X, 108, 54, 7);
  ctx.fillStyle = COLOR_INK;
  ctx.font = `600 28px ${SANS_FAMILY}`;
  ctx.fillText("wind", CARD_PADDING_X + 74, 124);
}

function drawCover(ctx: CanvasRenderingContext2D, card: XiaohongshuCard) {
  const layout = card.lines && card.fontSize
    ? { lines: card.lines, fontSize: card.fontSize, overflow: false }
    : layoutCoverText(ctx, card.text);
  if (layout.overflow) {
    throw new Error("封面文案过长，无法完整渲染，请精简 cover_text。");
  }
  const { lines, fontSize } = layout;
  ctx.font = `700 ${fontSize}px ${SANS_FAMILY}`;
  const lineHeight = Math.round(fontSize * 1.28);
  const titleHeight = lines.length * lineHeight;
  const startY = Math.max(390, Math.round((CARD_HEIGHT - titleHeight) / 2) + fontSize);
  ctx.fillStyle = COLOR_INK;
  drawLines(ctx, lines, CARD_PADDING_X, startY, lineHeight);
}

function drawContentCard(ctx: CanvasRenderingContext2D, blocks: XiaohongshuCardBlock[]) {
  let y = CONTENT_TOP;
  const maxWidth = CARD_WIDTH - CARD_PADDING_X * 2;

  for (const block of blocks) {
    const emphasis = block.kind === "emphasis";
    const fontSize = emphasis ? 56 : 44;
    const lineHeight = emphasis ? EMPHASIS_LINE_HEIGHT : BODY_LINE_HEIGHT;
    ctx.font = emphasis ? EMPHASIS_FONT : BODY_FONT;
    ctx.fillStyle = COLOR_INK;
    const lines = block.lines || wrapText(ctx, block.text, maxWidth, fontSize);
    drawLines(ctx, lines, CARD_PADDING_X, y + fontSize, lineHeight);
    y += lines.length * lineHeight + BLOCK_GAP;
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, index: number, total: number) {
  const ruleY = 1288;
  ctx.fillStyle = COLOR_LINE;
  ctx.fillRect(CARD_PADDING_X, ruleY, CARD_WIDTH - CARD_PADDING_X * 2, 2);
  ctx.font = `500 27px ${SANS_FAMILY}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.textAlign = "right";
  ctx.fillText(
    `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    CARD_WIDTH - CARD_PADDING_X,
    1350,
  );
  ctx.textAlign = "left";
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const tokens = paragraph.match(/[A-Za-z0-9]+(?:[._+/@:-][A-Za-z0-9]+)*|[ \t]+|./gu) || [];
    let line = "";
    let pendingSpace = "";

    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        if (line) pendingSpace = " ";
        continue;
      }
      const candidate = `${line}${pendingSpace}${token}`;
      if (measureTextWidth(ctx, candidate, fontSize) <= maxWidth || !line) {
        line = candidate;
        pendingSpace = "";
        if (measureTextWidth(ctx, line, fontSize) > maxWidth) {
          const split = splitWideToken(ctx, line, maxWidth, fontSize);
          lines.push(...split.slice(0, -1));
          line = split.at(-1) || "";
        }
      } else if (isClosingPunctuation(token)) {
        line += token;
        pendingSpace = "";
      } else {
        let carry = "";
        const lastChar = Array.from(line).at(-1) || "";
        if (isOpeningPunctuation(lastChar)) {
          line = line.slice(0, -lastChar.length);
          carry = lastChar;
        }
        if (line.trim()) lines.push(line.trimEnd());
        line = `${carry}${token}`;
        pendingSpace = "";
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
}

function splitWideToken(
  ctx: CanvasRenderingContext2D | null,
  value: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of Array.from(value)) {
    const candidate = line + char;
    if (line && measureTextWidth(ctx, candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D | null,
  value: string,
  fontSize: number,
): number {
  if (ctx) return ctx.measureText(value).width;
  return Array.from(value).reduce((width, char) => {
    if (/\s/.test(char)) return width + fontSize * 0.28;
    if (/[\x00-\xff]/.test(char)) return width + fontSize * 0.56;
    return width + fontSize;
  }, 0);
}

function isClosingPunctuation(value: string): boolean {
  return /^[，。！？；：、）》】」』’”％,.!?;:%)\]}]$/.test(value);
}

function isOpeningPunctuation(value: string): boolean {
  return /^[（《【「『‘“([{]$/.test(value);
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
