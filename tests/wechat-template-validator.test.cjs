const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  validateTemplateDirectory,
  validateTemplateFiles,
} = require("../wechat-template-validator.cjs");

const projectRoot = path.join(__dirname, "..");

test("accepts the bundled Agent starter template", () => {
  const result = validateTemplateDirectory(path.join(
    projectRoot,
    "skills",
    "create-windpost-wechat-template",
    "assets",
    "custom-template",
  ));
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.id, "custom-template");
});

test("accepts the Her stylesheet through the public template contract", () => {
  const css = fs.readFileSync(
    path.join(projectRoot, "src", "themes", "wechat", "her.css"),
    "utf8",
  );
  const result = validateTemplateFiles(JSON.stringify({
    schemaVersion: 1,
    id: "her",
    name: "Her",
    description: "Built-in editorial template.",
    layout: "editorial",
  }), css);
  assert.deepEqual(result.errors, []);
});

test("rejects an unsupported template layout", () => {
  const result = validateTemplateFiles(JSON.stringify({
    schemaVersion: 1,
    id: "bad-layout",
    name: "Bad layout",
    description: "Invalid layout.",
    layout: "magazine",
  }), "#bm-md { color: #222; }");
  assert.ok(result.errors.some((error) => error.includes("layout")));
});

test("rejects unsafe and unscoped custom stylesheets", () => {
  const manifest = JSON.stringify({
    schemaVersion: 1,
    id: "unsafe",
    name: "Unsafe",
    description: "Invalid external stylesheet.",
  });
  const result = validateTemplateFiles(
    manifest,
    '@import "https://example.com/style.css"; body { background: url(https://example.com/a.png); }',
  );
  assert.ok(result.errors.some((error) => error.includes("#bm-md")));
  assert.ok(result.errors.some((error) => error.includes("@import")));
  assert.ok(result.errors.some((error) => error.includes("外部资源")));
});
