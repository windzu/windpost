import * as path from "path";
import { normalizePath, type App, type TFile } from "obsidian";
import YAML from "yaml";

export interface BlogFile {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
}

export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  category: string | null;
  previewMarkdown: string;
  files: BlogFile[];
}

interface AssetRef {
  match: string;
  linkpath: string;
  alt: string;
}

export async function prepareBlogPost({
  app,
  sourcePath,
  markdown,
}: {
  app: App;
  sourcePath: string;
  markdown: string;
}): Promise<BlogPost> {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const title = text(frontmatter.title) || firstHeading(body) || basename(sourcePath);
  const slug = slugify(text(frontmatter.slug) || basename(sourcePath));
  const date = normalizeDate(frontmatter.date) || new Date().toISOString().slice(0, 10);
  const summary = text(frontmatter.summary);
  const tags = normalizeTags(frontmatter.tags);
  const category = text(frontmatter.category) || null;
  const remoteReplacements = new Map<string, string>();
  const previewReplacements = new Map<string, string>();
  const copied = new Map<string, { name: string; file: TFile }>();

  for (const asset of findAssets(body)) {
    const file = app.metadataCache.getFirstLinkpathDest(asset.linkpath, sourcePath);
    if (!file) continue;

    let stored = copied.get(file.path);
    if (!stored) {
      stored = {
        name: `${String(copied.size + 1).padStart(2, "0")}-${safeFileName(file.name)}`,
        file,
      };
      copied.set(file.path, stored);
    }

    const alt = asset.alt || file.basename;
    remoteReplacements.set(
      asset.match,
      `![${alt}](/windpost-assets/${slug}/${encodeURIComponent(stored.name)})`,
    );
    previewReplacements.set(asset.match, `![${alt}](${app.vault.getResourcePath(file)})`);
  }

  const outputBody = replace(body, remoteReplacements);
  const previewMarkdown = replace(body, previewReplacements);
  const metadata: Record<string, unknown> = {
    ...frontmatter,
    title,
    date,
    summary,
    tags,
    category,
    icon: text(frontmatter.icon) || null,
    coverUrl: text(frontmatter.coverUrl) || null,
    readingMinutes: readingMinutes(outputBody),
  };
  delete metadata.slug;

  const article = `---\n${YAML.stringify(metadata).trimEnd()}\n---\n\n${outputBody.trim()}\n`;
  const files: BlogFile[] = [{
    path: `src/content/posts/${slug}.md`,
    content: article,
    encoding: "utf-8",
  }];

  for (const { name, file } of copied.values()) {
    const data = await app.vault.readBinary(file);
    files.push({
      path: `public/windpost-assets/${slug}/${name}`,
      content: Buffer.from(data).toString("base64"),
      encoding: "base64",
    });
  }

  return { slug, title, summary, date, tags, category, previewMarkdown, files };
}

function splitFrontmatter(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {} as Record<string, unknown>, body: markdown };
  try {
    const value = YAML.parse(match[1]);
    return {
      frontmatter: value && typeof value === "object" ? value as Record<string, unknown> : {},
      body: markdown.slice(match[0].length),
    };
  } catch {
    return { frontmatter: {} as Record<string, unknown>, body: markdown };
  }
}

function findAssets(markdown: string): AssetRef[] {
  const refs: AssetRef[] = [];
  for (const match of markdown.matchAll(/!\[\[([^\]\n]+)\]\]/g)) {
    const [linkpath, modifier = ""] = match[1].split("|").map((part) => part.trim());
    if (isImage(linkpath)) {
      refs.push({ match: match[0], linkpath, alt: /^\d+(?:x\d+)?$/.test(modifier) ? "" : modifier });
    }
  }
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const linkpath = safeDecode(match[2]);
    if (!/^(?:https?:|data:|app:)/.test(linkpath) && isImage(linkpath)) {
      refs.push({ match: match[0], linkpath, alt: match[1] });
    }
  }
  return refs;
}

function replace(value: string, replacements: Map<string, string>): string {
  let result = value;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result;
}

function isImage(value: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(value);
}

function normalizeTags(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s]+/) : [];
  return items.map((item) => String(item).replace(/^#/, "").trim()).filter(Boolean);
}

function readingMinutes(markdown: string): number {
  const plain = markdown.replace(/```[\s\S]*?```/g, " ").replace(/[#*`>!\-_~\[\]()]/g, " ");
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (plain.replace(/[\u4e00-\u9fa5]/g, " ").match(/\S+/g) || []).length;
  return Math.max(1, Math.round(cjk / 450 + words / 220));
}

function firstHeading(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return text(value);
}

function basename(value: string): string {
  return path.posix.basename(normalizePath(value), path.posix.extname(value));
}

function slugify(value: string): string {
  return value.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled";
}

function safeFileName(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "-");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
