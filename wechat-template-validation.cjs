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
    if (new TextEncoder().encode(css).byteLength > MAX_CSS_BYTES) {
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

module.exports = {
  MAX_CSS_BYTES,
  validateTemplateFiles,
};
