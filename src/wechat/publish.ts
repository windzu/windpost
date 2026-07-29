import { requestUrl, TFile, type App } from "obsidian";
import { extractImageSources, isWechatHostedImage, replaceImageSources, sourceToAsset } from "./html";
import { WechatApiClient } from "./api";
import type { WechatAssetSource, WechatDraftResult, WechatPost } from "./types";

interface LoadedImage {
  data: ArrayBuffer;
  contentType: string;
  filename: string;
}

const ARTICLE_IMAGE_LIMIT = 1024 * 1024;

export async function publishWechatDraft({
  app,
  client,
  post,
}: {
  app: App;
  client: WechatApiClient;
  post: WechatPost;
}): Promise<WechatDraftResult> {
  const sources = extractImageSources(post.contentHtml);
  const replacements = new Map<string, string>();
  let uploadedImages = 0;

  for (const source of sources) {
    if (isWechatHostedImage(source)) continue;
    const asset = sourceToAsset(source);
    if (!asset) throw new Error(`公众号正文包含无法上传的图片地址：${source}`);
    const image = await normalizeArticleImage(await loadImage(app, asset));
    const url = await client.uploadArticleImage({
      field: "media",
      filename: image.filename,
      contentType: image.contentType,
      data: image.data,
    });
    replacements.set(source, url);
    uploadedImages += 1;
  }

  const content = replaceImageSources(post.contentHtml, replacements);
  validateContent(content);
  const coverSource = post.coverSource || sourceToAsset(sources[0] || "");
  if (!coverSource) {
    throw new Error("公众号草稿需要封面。请设置 frontmatter 的 wechat_cover，或在正文中加入图片。");
  }
  const cover = await normalizeArticleImage(await loadImage(app, coverSource));
  const thumbMediaId = await client.uploadPermanentImage({
    field: "media",
    filename: cover.filename,
    contentType: cover.contentType,
    data: cover.data,
  });

  const article: Record<string, unknown> = {
    article_type: "news",
    title: post.title,
    content,
    thumb_media_id: thumbMediaId,
    need_open_comment: post.needOpenComment,
    only_fans_can_comment: post.onlyFansCanComment,
  };
  if (post.author) article.author = post.author;
  if (post.digest) article.digest = post.digest;
  if (post.contentSourceUrl) article.content_source_url = post.contentSourceUrl;

  const mediaId = await client.addDraft(article);
  return { mediaId, uploadedImages };
}

async function loadImage(app: App, source: WechatAssetSource): Promise<LoadedImage> {
  if (source.kind === "vault") {
    const file = app.vault.getAbstractFileByPath(source.path);
    if (!(file instanceof TFile)) throw new Error(`找不到图片文件：${source.path}`);
    return {
      data: await app.vault.readBinary(file),
      contentType: mimeFromName(file.name),
      filename: file.name,
    };
  }
  if (source.kind === "data") return decodeDataUrl(source.dataUrl);

  const response = await requestUrl({ url: source.url, throw: false });
  if (response.status >= 400) {
    throw new Error(`下载公众号图片失败（HTTP ${response.status}）：${source.url}`);
  }
  const contentType = responseHeader(response.headers, "content-type")?.split(";")[0]
    || mimeFromName(source.url);
  return {
    data: response.arrayBuffer,
    contentType,
    filename: filenameFromUrl(source.url, contentType),
  };
}

async function normalizeArticleImage(image: LoadedImage): Promise<LoadedImage> {
  if (
    (image.contentType === "image/jpeg" || image.contentType === "image/png")
    && image.data.byteLength < ARTICLE_IMAGE_LIMIT
  ) {
    return image;
  }

  const bitmap = await createImageBitmap(new Blob([image.data], { type: image.contentType }));
  let width = bitmap.width;
  let height = bitmap.height;
  const maxDimension = 2400;
  if (Math.max(width, height) > maxDimension) {
    const ratio = maxDimension / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片转换失败：Canvas 初始化失败。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const quality = Math.max(0.55, 0.9 - attempt * 0.08);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size < ARTICLE_IMAGE_LIMIT) {
      bitmap.close();
      return {
        data: await blob.arrayBuffer(),
        contentType: "image/jpeg",
        filename: replaceExtension(image.filename, "jpg"),
      };
    }
    width = Math.max(320, Math.round(width * 0.82));
    height = Math.max(320, Math.round(height * 0.82));
  }
  bitmap.close();
  throw new Error(`图片压缩后仍超过 1 MB：${image.filename}`);
}

function validateContent(content: string): void {
  if (Array.from(content).length >= 20_000) {
    throw new Error("公众号正文超过 20,000 字符，无法创建草稿。");
  }
  if (new TextEncoder().encode(content).byteLength >= 1024 * 1024) {
    throw new Error("公众号正文 HTML 超过 1 MB，无法创建草稿。");
  }
}

function decodeDataUrl(value: string): LoadedImage {
  const match = value.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) throw new Error("正文包含无效的 data URL 图片。");
  const contentType = match[1] || "application/octet-stream";
  const bytes = match[2]
    ? Uint8Array.from(atob(match[3]), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(match[3]));
  return {
    data: bytes.buffer,
    contentType,
    filename: `inline.${extensionFromMime(contentType)}`,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片转换失败。"));
    }, type, quality);
  });
}

function mimeFromName(value: string): string {
  const clean = value.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".bmp")) return "image/bmp";
  if (clean.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

function filenameFromUrl(value: string, contentType: string): string {
  try {
    const name = decodeURIComponent(new URL(value).pathname.split("/").pop() || "");
    if (/\.[a-z0-9]+$/i.test(name)) return name;
  } catch {
    // Fall through to a generated file name.
  }
  return `remote.${extensionFromMime(contentType)}`;
}

function extensionFromMime(contentType: string): string {
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/avif": "avif",
  };
  return extensions[contentType] || "bin";
}

function replaceExtension(value: string, extension: string): string {
  return value.replace(/\.[^.]+$/, "") + `.${extension}`;
}

function responseHeader(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}
