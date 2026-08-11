const fs = require("node:fs");
const path = require("node:path");
const { resolveMinAppVersion } = require("./release-version.cjs");

const root = path.resolve(__dirname, "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const requiredFiles = ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE"];

const failures = [];
if (packageJson.version !== manifest.version) {
  failures.push(`package.json (${packageJson.version}) 与 manifest.json (${manifest.version}) 版本不一致`);
}
if (resolveMinAppVersion(versions, manifest.version) !== manifest.minAppVersion) {
  failures.push(`versions.json 缺少 minAppVersion ${manifest.minAppVersion} 的版本边界`);
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  failures.push(`版本号不是标准 SemVer：${manifest.version}`);
}
for (const name of requiredFiles) {
  const file = path.join(root, name);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    failures.push(`缺少发布文件或文件为空：${name}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`WindPost ${manifest.version} 发布产物校验通过。`);
}
