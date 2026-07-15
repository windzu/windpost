#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const READY = "__WINDPOST_XHS_READY__";
const LOGIN = "__WINDPOST_XHS_LOGIN__";

if (require.main === module) {
  main().catch((error) => {
    console.error(`[WindPost XHS] ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
}

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
  console.log("[WindPost XHS] 正在填写标题、正文和话题…");
  await fillTitle(page, payload.title);
  const contentEditor = await fillContent(page, payload.content);
  await fillTopics(page, contentEditor, payload.tags);

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
  return fillFirst(locators, content, "正文");
}

async function fillTopics(page, editor, tags) {
  const normalizedTags = normalizeTags(tags);
  if (normalizedTags.length === 0) return;

  await placeCursorAtEnd(editor);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  for (const tag of normalizedTags) {
    await page.keyboard.type("#");
    await page.waitForTimeout(150);
    await page.keyboard.type(tag, { delay: 50 });
    await waitForTopicSuggestion(page, tag, true);
    await page.keyboard.press("Enter");
    await waitForTopicSuggestion(page, tag, false);
    await page.keyboard.type(" ");
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags
    .map((tag) => String(tag).replace(/^#+|#+$/g, "").trim())
    .filter(Boolean))];
}

async function placeCursorAtEnd(editor) {
  await editor.click();
  await editor.evaluate((element) => {
    element.focus();
    if ("setSelectionRange" in element && typeof element.setSelectionRange === "function") {
      const length = typeof element.value === "string" ? element.value.length : 0;
      element.setSelectionRange(length, length);
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function waitForTopicSuggestion(page, tag, expectedVisible) {
  try {
    await page.waitForFunction(
      topicSuggestionVisibilityMatches,
      { tag, expectedVisible },
      { timeout: expectedVisible ? 5000 : 3000 },
    );
  } catch {
    if (expectedVisible) {
      throw new Error(`未找到小红书话题候选：#${tag}`);
    }
    throw new Error(`小红书话题绑定失败：#${tag}`);
  }
}

function topicSuggestionVisibilityMatches({ tag, expectedVisible }) {
  const editor = document.querySelector(
    ".tiptap.ProseMirror[contenteditable=\"true\"], .ProseMirror[contenteditable=\"true\"]",
  );
  const normalizedTag = tag.replace(/^#/, "").trim();
  const visible = [...document.querySelectorAll("body *")].some((element) => {
    if (editor && editor.contains(element)) return false;
    const text = (element.textContent || "").replace(/^#/, "").trim();
    if (!text.startsWith(normalizedTag)) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden" || style.display === "none") {
      return false;
    }

    if (element.closest('[role="listbox"], [role="menu"], [role="option"]')) return true;
    let ancestor = element;
    while (ancestor && ancestor !== document.body) {
      const ancestorStyle = window.getComputedStyle(ancestor);
      if (ancestorStyle.position === "absolute" || ancestorStyle.position === "fixed") return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  });
  return visible === expectedVisible;
}

async function fillFirst(locators, value, label) {
  let lastError;
  for (const locator of locators) {
    try {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await locator.click();
      await locator.fill(value);
      return locator;
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
        return locator;
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

module.exports = {
  fillTopics,
  normalizeTags,
};
