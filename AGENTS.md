# 开发流程

- 所有功能、重构和缺陷修复都必须从最新的远端 `main` 创建独立分支。
- 禁止直接向 `main` 提交或推送代码。
- 每个变更都必须提交 Pull Request，并在远端完成合并。
- Pull Request 合并时启用「合并后删除分支」；合并完成后同步本地 `main`，再删除对应本地分支。
- 缺陷修复开始前必须先创建 GitHub Issue，并在 Pull Request 中关联该 Issue。
- 功能开发不强制创建 Issue，除非任务另有要求。
- PR 标题使用 Conventional Commits；`fix:`、`feat:` 与 breaking change 分别驱动
  patch、minor 与 major 版本。
- 正式版本必须由 GitHub Release Action 自动维护 Release PR、版本号、tag、构建产物与
  GitHub Release；除故障恢复外，禁止手工修改版本号、推送版本 tag 或创建 Release。
- 后续版本从 GitHub Release 被 Obsidian 自动获取，不把打开 Community 管理页作为发版步骤。
