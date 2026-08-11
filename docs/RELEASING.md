# 自动发版

WindPost 的正式版本由 GitHub Actions 自动发布。正常开发不手工修改版本号、不手工推送
版本 tag，也不需要打开 Obsidian Community 页面。

## 正常流程

1. 功能、修复或重构从最新远端 `main` 创建独立分支，通过 Pull Request 合入；
2. PR 标题使用 Conventional Commits：`fix:` 产生 patch，`feat:` 产生 minor，带 `!`
   或 `BREAKING CHANGE` 产生 major；
3. `main` 更新后，Release Action 使用 Release Please 创建或更新 Release PR；
4. Action 显式调度 CI，检查 Release PR 的版本文件与完整工程；
5. CI 通过后，Action squash 合并 Release PR 并删除远程分支；
6. Action 创建不带 `v` 前缀的版本 tag 和 GitHub Release，重新执行 `pnpm check`，为
   `main.js`、`manifest.json`、`styles.css` 生成 provenance 并上传；
7. Obsidian 根据仓库根目录的 `manifest.json` 和同名 GitHub Release 提供更新，无需手工
   点击 Community 管理页的「Check for new releases」。

只修改文档、测试或 CI 且没有 `fix:`、`feat:` 或 breaking commit 时，Release Please
可以不产生新版本。

## Obsidian 版本兼容性

Release Please 自动同步 `package.json` 与 `manifest.json` 的插件版本。`versions.json`
只在 `minAppVersion` 发生变化时增加一条新的版本边界，不需要为每个插件版本重复登记。

## 故障恢复

发布任务可以安全重跑。如果 GitHub Release 已创建但产物上传失败，在 Actions 中手工运行
`Release` workflow，并把 `repair_tag` 设置为需要修复的版本，例如 `1.1.0`。任务会检出
该 tag，重新检查、生成 provenance，并用 `--clobber` 补齐三个发布文件。

`finalize` 是自动编排内部使用的恢复开关，正常情况下无需手工设置。不得通过本地命令
直接向 `main` 推送版本提交或 tag。
