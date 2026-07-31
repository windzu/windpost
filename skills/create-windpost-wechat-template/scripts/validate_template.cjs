#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const MAX_CSS_BYTES = 128 * 1024;
const TEMPLATE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function validateTemplateFiles(manifestText, css) {
  const errors = [];
  let manifest = null;

  try {
    manifest = JSON.parse(manifestText);
  } catch {
    errors.push("template.json 不是有效的 JSON。");
  }

  if (manifest) {
    if (manifest.schemaVersion !== 1) {
      errors.push("schemaVersion 必须为 1。");
    }
    if (typeof manifest.id !== "string" || !TEMPLATE_ID.test(manifest.id)) {
      errors.push("id 必须由小写字母、数字和连字符组成，且不超过 64 个字符。");
    }
    if (typeof manifest.name !== "string" || !manifest.name.trim() || manifest.name.length > 50) {
      errors.push("name 必须为 1–50 个字符。");
    }
    if (
      typeof manifest.description !== "string"
      || !manifest.description.trim()
      || manifest.description.length > 160
    ) {
      errors.push("description 必须为 1–160 个字符。");
    }
    if (
      manifest.layout !== undefined
      && manifest.layout !== "default"
      && manifest.layout !== "editorial"
    ) {
      errors.push("layout 只能是 default 或 editorial。");
    }
  }

  if (typeof css !== "string" || !css.trim()) {
    errors.push("style.css 不能为空。");
  } else {
    if (Buffer.byteLength(css, "utf8") > MAX_CSS_BYTES) {
      errors.push("style.css 不能超过 128 KB。");
    }
    if (!css.includes("#bm-md")) {
      errors.push("style.css 必须使用 #bm-md 作为模板根选择器。");
    }
    if (/@import\b/i.test(css)) {
      errors.push("style.css 不允许使用 @import。");
    }
    if (/expression\s*\(|javascript\s*:/i.test(css)) {
      errors.push("style.css 包含不安全的 CSS 表达式。");
    }
    if (/url\s*\(\s*(['"])?\s*(?:https?:|\/\/|file:|app:)/i.test(css)) {
      errors.push("style.css 不允许加载外部资源。");
    }
    if (!hasBalancedBraces(css)) {
      errors.push("style.css 的花括号不匹配。");
    }
  }

  return { manifest, errors };
}

function validateTemplateDirectory(directory) {
  const manifestPath = path.join(directory, "template.json");
  const cssPath = path.join(directory, "style.css");
  const errors = [];

  if (!fs.existsSync(manifestPath)) errors.push("缺少 template.json。");
  if (!fs.existsSync(cssPath)) errors.push("缺少 style.css。");
  if (errors.length > 0) return { manifest: null, errors };

  const result = validateTemplateFiles(
    fs.readFileSync(manifestPath, "utf8"),
    fs.readFileSync(cssPath, "utf8"),
  );
  if (result.manifest && path.basename(directory) !== result.manifest.id) {
    result.errors.push("模板目录名必须与 template.json 的 id 一致。");
  }
  return result;
}

function hasBalancedBraces(css) {
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
  let depth = 0;
  for (const character of stripped) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function runCli(args) {
  const directory = args[0];
  if (!directory) {
    console.error("用法：node validate_template.cjs <模板目录>");
    process.exitCode = 2;
    return;
  }
  const result = validateTemplateDirectory(path.resolve(directory));
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`模板 ${result.manifest.name}（${result.manifest.id}）校验通过。`);
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = {
  MAX_CSS_BYTES,
  runCli,
  validateTemplateDirectory,
  validateTemplateFiles,
};
