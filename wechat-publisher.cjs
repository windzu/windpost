#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const READY = "__WINDPOST_WECHAT_READY__";
const LOGIN = "__WINDPOST_WECHAT_LOGIN__";
const CONNECTED = "__WINDPOST_WECHAT_CONNECTED__";
const MP_BASE = "https://mp.weixin.qq.com";

if (require.main === module) {
  main().catch((error) => {
    console.error(`[WindPost WeChat] ${sanitizeError(error && error.stack ? error.stack : String(error))}`);
    process.exit(1);
  });
}

async function main() {
  const payloadPath = process.argv[2];
  if (payloadPath === "--login") {
    await loginOnly(process.argv[3]);
    return;
  }
  if (!payloadPath) throw new Error("缺少 payload JSON 路径。");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  validatePayload(payload);

  let chromium;
  try {
    chromium = require("playwright").chromium;
  } catch {
    throw new Error("未找到 playwright。请在插件目录执行 pnpm install。");
  }

  fs.mkdirSync(payload.userDataDir, { recursive: true });
  const context = await launchBrowser(chromium, payload.userDataDir);
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);

  console.log("[WindPost WeChat] 正在打开微信公众号后台…");
  const token = await ensureLoggedIn(page);
  console.log("[WindPost WeChat] 正在读取草稿编辑会话…");
  const session = await extractEditorSession(page, token);

  const replacements = new Map();
  for (let index = 0; index < payload.images.length; index += 1) {
    const image = payload.images[index];
    console.log(`[WindPost WeChat] 正在上传正文图片 ${index + 1}/${payload.images.length}…`);
    const cdnUrl = await uploadImage(context, session, image.path);
    replacements.set(image.source, cdnUrl);
  }

  console.log("[WindPost WeChat] 正在上传封面…");
  const coverCdnUrl = await uploadImage(context, session, payload.coverPath);
  const replacedHtml = replaceImageSources(payload.contentHtml, replacements);
  const content = await sanitizeWechatHtml(page, replacedHtml);

  console.log("[WindPost WeChat] 正在创建草稿…");
  const appMsgId = await createDraft(context, session, payload, content, coverCdnUrl);
  const editUrl = `${MP_BASE}/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=0&type=10&appmsgid=${encodeURIComponent(appMsgId)}&token=${encodeURIComponent(token)}&lang=zh_CN`;
  await page.goto(editUrl, { waitUntil: "domcontentloaded" });
  console.log(`${READY} ${appMsgId} ${payload.images.length}`);
  console.log("[WindPost WeChat] 草稿已创建，请在浏览器中检查。");
  await waitUntilClosed(context);
}

async function loginOnly(userDataDir) {
  if (!userDataDir) throw new Error("缺少公众号浏览器数据目录。");
  let chromium;
  try {
    chromium = require("playwright").chromium;
  } catch {
    throw new Error("未找到 playwright。请在插件目录执行 pnpm install。");
  }
  fs.mkdirSync(userDataDir, { recursive: true });
  const context = await launchBrowser(chromium, userDataDir);
  const page = context.pages()[0] || await context.newPage();
  const token = await ensureLoggedIn(page);
  await extractEditorSession(page, token);
  console.log(`${CONNECTED} 公众号登录会话有效。`);
  await context.close();
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("payload 无效。");
  if (!payload.title) throw new Error("缺少公众号标题。");
  if (!payload.contentHtml) throw new Error("缺少公众号正文。");
  if (!payload.coverPath || !fs.existsSync(payload.coverPath)) throw new Error("公众号封面文件不存在。");
  if (!payload.userDataDir) throw new Error("缺少公众号浏览器数据目录。");
  if (!Array.isArray(payload.images)) throw new Error("公众号正文图片列表无效。");
  for (const image of payload.images) {
    if (!image.source || !image.path || !fs.existsSync(image.path)) {
      throw new Error(`公众号正文图片不存在：${image.path || "(空)"}`);
    }
  }
}

async function launchBrowser(chromium, userDataDir) {
  const options = {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: ["--disable-blink-features=AutomationControlled"],
  };
  try {
    return await chromium.launchPersistentContext(userDataDir, {
      ...options,
      channel: "chrome",
    });
  } catch {
    return await chromium.launchPersistentContext(userDataDir, options);
  }
}

async function ensureLoggedIn(page) {
  await page.goto(MP_BASE, { waitUntil: "domcontentloaded" });
  let token = extractTokenFromUrl(page.url());
  if (token) return token;

  console.log(`${LOGIN} 请扫码登录微信公众号后台。`);
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    token = extractTokenFromUrl(page.url());
    if (token) return token;
  }
  throw new Error("公众号扫码登录等待超时。");
}

function extractTokenFromUrl(value) {
  try {
    return new URL(value).searchParams.get("token") || "";
  } catch {
    return "";
  }
}

async function extractEditorSession(page, token) {
  const url = `${MP_BASE}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${encodeURIComponent(token)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const runtime = await page.evaluate(() => {
    const candidates = [
      globalThis.wx && globalThis.wx.cgiData,
      globalThis.cgiData,
      globalThis.appmsg_data,
    ].filter(Boolean);
    for (const value of candidates) {
      const ticket = value.ticket || value.ticket_id;
      const userName = value.user_name || value.userName;
      if (ticket && userName) return { ticket: String(ticket), userName: String(userName) };
    }
    return null;
  }).catch(() => null);
  if (runtime) return { token, ...runtime };

  const html = await page.content();
  const ticket = firstMatch(html, [
    /ticket\s*[:=]\s*["']([^"']+)["']/,
    /["']ticket["']\s*:\s*["']([^"']+)["']/,
  ]);
  const userName = firstMatch(html, [
    /user_name\s*[:=]\s*["']([^"']+)["']/,
    /["']user_name["']\s*:\s*["']([^"']+)["']/,
  ]);
  if (!ticket || !userName) {
    throw new Error("无法读取公众号编辑会话，微信后台页面结构可能已变化。");
  }
  return { token, ticket: decodeHtml(ticket), userName: decodeHtml(userName) };
}

function firstMatch(value, patterns) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return "";
}

async function uploadImage(context, session, imagePath) {
  const svrTime = Math.floor(Date.now() / 1000);
  const url = `${MP_BASE}/cgi-bin/filetransfer?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${encodeURIComponent(session.userName)}&ticket=${encodeURIComponent(session.ticket)}&svr_time=${svrTime}&seq=1&token=${encodeURIComponent(session.token)}`;
  const response = await context.request.post(url, {
    headers: {
      Referer: `${MP_BASE}/`,
      "X-Requested-With": "XMLHttpRequest",
    },
    multipart: {
      file: {
        name: path.basename(imagePath),
        mimeType: mimeFromName(imagePath),
        buffer: fs.readFileSync(imagePath),
      },
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok() || !data.cdn_url) {
    throw new Error(data.base_resp && data.base_resp.err_msg
      ? `图片上传失败：${data.base_resp.err_msg}`
      : `图片上传失败（HTTP ${response.status()}）。`);
  }
  return data.cdn_url;
}

async function createDraft(context, session, payload, content, coverCdnUrl) {
  const url = `${MP_BASE}/cgi-bin/operate_appmsg?t=ajax-response&sub=create&type=10&token=${encodeURIComponent(session.token)}`;
  const form = {
    token: session.token,
    f: "json",
    ajax: "1",
    random: String(Math.random()),
    count: "1",
    title0: payload.title,
    author0: payload.author || "",
    content0: content,
    digest0: payload.digest || "",
    cdn_url0: coverCdnUrl,
    sourceurl0: payload.contentSourceUrl || "",
    show_cover_pic0: "0",
    need_open_comment0: payload.needOpenComment ? "1" : "0",
    only_fans_can_comment0: payload.onlyFansCanComment ? "1" : "0",
    music_id0: "",
    video_id0: "",
    shortvideofileid0: "",
    copyright_type0: "0",
    fee0: "0",
    voteid0: "",
    voteismlt0: "",
    ad_id0: "",
  };
  const response = await context.request.post(url, {
    headers: {
      Referer: `${MP_BASE}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${encodeURIComponent(session.token)}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok() || !data.base_resp || data.base_resp.ret !== 0) {
    throw new Error(data.base_resp && data.base_resp.err_msg
      ? `创建草稿失败：${data.base_resp.err_msg}`
      : `创建草稿失败（HTTP ${response.status()}）。`);
  }
  if (!data.appMsgId) throw new Error("创建草稿成功，但微信未返回 appMsgId。");
  return String(data.appMsgId);
}

function replaceImageSources(html, replacements) {
  return html.replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/giu, (match, prefix, quote, rawSource) => {
    const source = decodeHtml(rawSource);
    const replacement = replacements.get(source);
    return replacement ? `${prefix}${quote}${escapeHtml(replacement)}${quote}` : match;
  });
}

async function sanitizeWechatHtml(page, html) {
  return page.evaluate((value) => {
    const documentValue = new DOMParser().parseFromString(value, "text/html");
    const blockTags = new Set([
      "DIV", "P", "SECTION", "BLOCKQUOTE", "PRE", "UL", "OL", "LI",
      "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
      "H1", "H2", "H3", "H4", "H5", "H6", "HR", "FIGURE", "FIGCAPTION",
    ]);
    const removeWhitespace = (node) => {
      for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
        const child = node.childNodes[index];
        if (child.nodeType === Node.ELEMENT_NODE) {
          removeWhitespace(child);
        } else if (child.nodeType === Node.TEXT_NODE && child.textContent && /^\s+$/.test(child.textContent)) {
          const previous = child.previousSibling;
          const next = child.nextSibling;
          const parentIsBlock = node.nodeType === Node.ELEMENT_NODE && blockTags.has(node.tagName);
          const previousIsBlock = !previous
            || (previous.nodeType === Node.ELEMENT_NODE && blockTags.has(previous.tagName));
          const nextIsBlock = !next
            || (next.nodeType === Node.ELEMENT_NODE && blockTags.has(next.tagName));
          if (parentIsBlock && (previousIsBlock || nextIsBlock)) node.removeChild(child);
        }
      }
    };
    removeWhitespace(documentValue.body);
    return documentValue.body.innerHTML;
  }, html);
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mimeFromName(value) {
  const extension = path.extname(value).toLowerCase();
  if (extension === ".png") return "image/png";
  return "image/jpeg";
}

function sanitizeError(value) {
  return String(value)
    .replace(/([?&]token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/([?&]ticket=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/([?&]ticket_id=)[^&\s)]+/gi, "$1[redacted]");
}

async function waitUntilClosed(context) {
  await new Promise((resolve) => context.once("close", resolve));
}

module.exports = {
  extractTokenFromUrl,
  replaceImageSources,
  sanitizeError,
  validatePayload,
};
