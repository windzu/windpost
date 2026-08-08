import type { RequestUrlParam } from "obsidian";

interface WechatError {
  errcode?: number;
  errmsg?: string;
}

interface TokenResponse extends WechatError {
  access_token?: string;
  expires_in?: number;
}

export interface WechatMultipartFile {
  field: string;
  filename: string;
  contentType: string;
  data: ArrayBuffer;
}

export type WechatRequest = (
  request: RequestUrlParam,
) => Promise<{ status: number; text: string }>;

const API_BASE = "https://api.weixin.qq.com";
const TOKEN_ERROR_CODES = new Set([40014, 42001, 42007]);

export class WechatApiClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly send: WechatRequest,
  ) {
    if (!appId.trim()) throw new Error("请先在 WindPost 设置中填写微信公众号 AppID。");
    if (!appSecret.trim()) throw new Error("请先在 WindPost 设置中配置微信公众号 AppSecret。");
  }

  async getDraftCount(): Promise<number> {
    const response = await this.postJson<WechatError & { total_count?: number }>(
      "/cgi-bin/draft/count",
      {},
    );
    return response.total_count ?? 0;
  }

  async uploadArticleImage(file: WechatMultipartFile): Promise<string> {
    const response = await this.postMultipart<WechatError & { url?: string }>(
      "/cgi-bin/media/uploadimg",
      file,
    );
    if (!response.url) throw new Error("微信未返回正文图片 URL。");
    return response.url;
  }

  async uploadPermanentImage(file: WechatMultipartFile): Promise<string> {
    const response = await this.postMultipart<WechatError & { media_id?: string }>(
      "/cgi-bin/material/add_material",
      file,
      { type: "image" },
    );
    if (!response.media_id) throw new Error("微信未返回封面素材 media_id。");
    return response.media_id;
  }

  async addDraft(article: Record<string, unknown>): Promise<string> {
    const response = await this.postJson<WechatError & { media_id?: string }>(
      "/cgi-bin/draft/add",
      { articles: [article] },
    );
    if (!response.media_id) throw new Error("微信未返回草稿 media_id。");
    return response.media_id;
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && Date.now() < this.token.expiresAt) {
      return this.token.value;
    }

    const response = await this.request({
      url: `${API_BASE}/cgi-bin/stable_token`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: this.appId,
        secret: this.appSecret,
        force_refresh: forceRefresh,
      }),
      throw: false,
    });
    const data = parseJson<TokenResponse>(response.text, "获取 access token");
    throwWechatError(data, response.status);
    if (!data.access_token) throw new Error("微信未返回 access token。");

    const expiresIn = Math.max(300, data.expires_in ?? 7200);
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 300) * 1000,
    };
    return data.access_token;
  }

  private async postJson<T extends WechatError>(
    path: string,
    body: Record<string, unknown>,
    canRetry = true,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await this.request({
      url: apiUrl(path, token),
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify(body),
      throw: false,
    });
    const data = parseJson<T>(response.text, path);
    if (canRetry && data.errcode && TOKEN_ERROR_CODES.has(data.errcode)) {
      this.token = null;
      await this.getAccessToken(true);
      return this.postJson<T>(path, body, false);
    }
    throwWechatError(data, response.status);
    return data;
  }

  private async postMultipart<T extends WechatError>(
    path: string,
    file: WechatMultipartFile,
    query: Record<string, string> = {},
    canRetry = true,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const multipart = buildMultipart(file);
    const response = await this.request({
      url: apiUrl(path, token, query),
      method: "POST",
      contentType: `multipart/form-data; boundary=${multipart.boundary}`,
      body: multipart.body,
      throw: false,
    });
    const data = parseJson<T>(response.text, path);
    if (canRetry && data.errcode && TOKEN_ERROR_CODES.has(data.errcode)) {
      this.token = null;
      await this.getAccessToken(true);
      return this.postMultipart<T>(path, file, query, false);
    }
    throwWechatError(data, response.status);
    return data;
  }

  private async request(request: RequestUrlParam): Promise<{ status: number; text: string }> {
    try {
      return await this.send(request);
    } catch {
      throw new Error("微信接口网络请求失败，请检查网络连接后重试。");
    }
  }
}

function apiUrl(path: string, token: string, query: Record<string, string> = {}): string {
  const params = new URLSearchParams({ access_token: token, ...query });
  return `${API_BASE}${path}?${params.toString()}`;
}

export function buildMultipart(file: WechatMultipartFile): {
  boundary: string;
  body: ArrayBuffer;
} {
  const boundary = `----windpost-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="${safeHeader(file.field)}"; filename="${safeHeader(file.filename)}"\r\n`
    + `Content-Type: ${file.contentType}\r\n\r\n`,
  );
  const footer = encoder.encode(`\r\n--${boundary}--\r\n`);
  const data = new Uint8Array(file.data);
  const result = new Uint8Array(header.length + data.length + footer.length);
  result.set(header, 0);
  result.set(data, header.length);
  result.set(footer, header.length + data.length);
  return { boundary, body: result.buffer };
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n"]/g, "_");
}

function parseJson<T>(value: string, action: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`微信接口「${action}」返回了无法解析的响应。`);
  }
}

function throwWechatError(data: WechatError, status: number): void {
  if ((!data.errcode || data.errcode === 0) && status < 400) return;
  const code = data.errcode ?? status;
  const hints: Record<number, string> = {
    40001: "AppSecret 无效，请检查公众号配置。",
    40125: "AppSecret 无效，请检查公众号配置。",
    40164: "当前网络出口 IP 不在微信公众号接口白名单中。",
    45009: "微信接口调用已达到频率上限。",
    48001: "当前公众号没有草稿接口权限。",
    61004: "微信公众号认证信息无效，请检查 AppID 与 AppSecret。",
    89503: "微信要求管理员确认本次 API 调用，请按微信提示完成确认后重试。",
  };
  const hint = hints[code];
  if (hint) {
    const detail = code === 40164 && data.errmsg ? ` 微信返回：${data.errmsg}` : "";
    throw new Error(`${hint}${detail}`);
  }
  throw new Error(`微信接口失败（${code}）：${data.errmsg || "未知错误"}`);
}
