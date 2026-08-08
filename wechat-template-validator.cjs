#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const validation = require("./wechat-template-validation.cjs");

function validateTemplateDirectory(directory) {
  const manifestPath = path.join(directory, "template.json");
  const cssPath = path.join(directory, "style.css");
  const errors = [];

  if (!fs.existsSync(manifestPath)) errors.push("缺少 template.json。");
  if (!fs.existsSync(cssPath)) errors.push("缺少 style.css。");
  if (errors.length > 0) return { manifest: null, errors };

  const result = validation.validateTemplateFiles(
    fs.readFileSync(manifestPath, "utf8"),
    fs.readFileSync(cssPath, "utf8"),
  );
  if (result.manifest && path.basename(directory) !== result.manifest.id) {
    result.errors.push("模板目录名必须与 template.json 的 id 一致。");
  }
  return result;
}

function runCli(args) {
  const directory = args[0];
  if (!directory) {
    console.error("用法：node wechat-template-validator.cjs <模板目录>");
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
  ...validation,
  runCli,
  validateTemplateDirectory,
};
