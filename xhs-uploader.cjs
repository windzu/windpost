#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const READY = "__WINDPOST_XHS_READY__";
const LOGIN = "__WINDPOST_XHS_LOGIN__";

main().catch((error) => {
  console.error(`[WindPost XHS] ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});

async function main() {
  const payloadPath = process.argv[2];
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

  console.log("[WindPost XHS] 正在打开创作服务平台…");
  await page.goto(payload.publishUrl, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page, payload.publishUrl);
  console.log("[WindPost XHS] 正在选择图文发布…");
  await chooseImageNote(page);
  console.log(`[WindPost XHS] 正在上传 ${payload.imagePaths.length} 张图片…`);
  await uploadImages(page, payload.imagePaths);
  console.log("[WindPost XHS] 正在填写标题和正文…");
  await fillTitle(page, payload.title);
  await fillContent(page, composeContent(payload.content, payload.tags));

  if (payload.autoSubmit) {
    await clickPublish(page);
    console.log("[WindPost XHS] 已点击发布。");
    await page.waitForTimeout(3000);
    await context.close();
    return;
  }

  console.log(`${READY} 已完成上传和内容填写，请在浏览器中检查并发布。`);
  await waitUntilClosed(context);
}

async function ensureLoggedIn(page, publishUrl) {
  // 发布页会在 domcontentloaded 之后再异步跳转到登录页。
  await page.waitForTimeout(1500);
  if (!isLoginPage(page)) return;
  console.log(`${LOGIN} 小红书登录已失效，请在浏览器中完成登录。`);
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 300000 });
  if (!page.url().includes("/publish/")) {
    await page.goto(publishUrl, { waitUntil: "domcontentloaded" });
  }
}

function isLoginPage(page) {
  return page.url().includes("/login");
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("payload 无效。");
  if (!payload.title) throw new Error("缺少标题。");
  if (!payload.content) throw new Error("缺少正文。");
  if (!payload.publishUrl) throw new Error("缺少小红书发布页地址。");
  if (!Array.isArray(payload.imagePaths) || payload.imagePaths.length === 0) {
    throw new Error("缺少图片。");
  }
  for (const imagePath of payload.imagePaths) {
    if (!fs.existsSync(imagePath)) throw new Error(`图片不存在：${imagePath}`);
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

async function chooseImageNote(page) {
  await clickByText(page, ["上传图文", "发布图文", "图文"], 5000).catch(() => {});
}

async function uploadImages(page, imagePaths) {
  const input = page
    .locator('input[type="file"][accept*=".jpg"], input[type="file"][accept*=".png"], input[type="file"][multiple]')
    .first();
  await input.waitFor({ state: "attached", timeout: 120000 });
  await input.setInputFiles(imagePaths);
  await page.waitForTimeout(2500);
}

async function fillTitle(page, title) {
  const locators = [
    page.getByPlaceholder(/标题|请输入标题|填写标题|添加标题/).first(),
    page.locator('input[maxlength], input[type="text"]').first(),
    page.locator('[contenteditable="true"]').first(),
  ];
  await fillFirst(locators, title, "标题");
}

async function fillContent(page, content) {
  const locators = [
    page.locator('.tiptap.ProseMirror[contenteditable="true"]').first(),
    page.getByPlaceholder(/正文|描述|请输入正文|填写正文|添加正文/).first(),
    page.locator("textarea").first(),
    page.locator('[contenteditable="true"]').first(),
  ];
  await fillFirst(locators, content, "正文");
}

function composeContent(content, tags) {
  const normalizedTags = Array.isArray(tags)
    ? tags.map((tag) => String(tag).replace(/^#+|#+$/g, "").trim()).filter(Boolean)
    : [];
  const tagLine = normalizedTags.map((tag) => `#${tag}`).join(" ");
  return [content.trim(), tagLine].filter(Boolean).join("\n\n");
}

async function fillFirst(locators, value, label) {
  let lastError;
  for (const locator of locators) {
    try {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await locator.click();
      await locator.fill(value);
      return;
    } catch (error) {
      lastError = error;
      try {
        await locator.evaluate((el, text) => {
          if ("value" in el) {
            el.value = text;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            el.textContent = text;
            el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
          }
        }, value);
        return;
      } catch (innerError) {
        lastError = innerError;
      }
    }
  }
  throw new Error(`无法填写${label}：${lastError && lastError.message ? lastError.message : lastError}`);
}

async function clickPublish(page) {
  await clickByText(page, ["发布", "立即发布"], 30000);
}

async function clickByText(page, texts, timeout) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    for (const text of texts) {
      try {
        const locator = page.getByText(text, { exact: false }).last();
        await locator.waitFor({ state: "visible", timeout: 1000 });
        await locator.click();
        return;
      } catch (error) {
        lastError = error;
      }
    }
    await page.waitForTimeout(500);
  }
  throw lastError || new Error(`未找到按钮：${texts.join("/")}`);
}

async function waitUntilClosed(context) {
  await new Promise((resolve) => context.once("close", resolve));
}
