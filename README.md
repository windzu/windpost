# WindPost

> 基于 Obsidian 的个人多渠道内容发布工作台。

WindPost 以本地 Obsidian vault 为唯一内容源，将同一篇 Markdown 笔记转换并发布到 Blog、微信公众号和小红书。项目目标不是建设一个通用社交媒体管理平台，而是为个人长期内容创作提供一条可控、可维护、可迁移的发布链路。

## 背景

过去的内容生产链路以 Notion 为知识库，并依赖多个浏览器插件分别发布公众号、小红书和 Blog。随着知识库迁移到 Obsidian，原有工具出现了几个问题：

- 内容源和发布工具分散，渠道之间缺少统一状态；
- 同一篇文章需要被不同插件重复解析和处理；
- 浏览器自动化与内容转换耦合，页面变化后难以维护；
- Blog 仍依赖 Notion，尚未真正以本地 Markdown 为源。

现有项目中，`wepost` 已实现部分 Obsidian Markdown 渲染、平台预览和小红书自动填写能力；`windscroll` 已实现 Astro 静态 Blog。WindPost 将在这些验证结果上重新划分边界，建立统一的发布工作流。

## 产品定位

WindPost 在 Obsidian 中提供一个统一的「发布中心」：

1. 读取当前笔记及其 frontmatter、附件和 wikilink；
2. 转换为渠道无关的内容模型；
3. 分别生成 Blog、公众号和小红书产物；
4. 预览、校验并执行发布；
5. 记录各渠道的发布状态，支持独立重试。

## 初步架构

```text
Obsidian Note
    -> Document Resolver
    -> Publish Document
    -> Channel Builder
        -> Blog Artifact    -> WindScroll / Git / Vercel
        -> WeChat Artifact  -> HTML / Draft API
        -> XHS Artifact     -> Cards / Browser Driver
```

核心模块暂定为：

- `source`：解析 Obsidian 笔记、frontmatter、wikilink 和附件；
- `core`：定义 `PublishDocument`、校验规则和发布任务状态；
- `channels`：生成各平台需要的独立产物；
- `publishers`：负责 API、Git 或浏览器自动化等外部交互；
- `ui`：提供渠道选择、预览、发布进度和失败重试。

## 与 WindScroll 的关系

WindPost 是发布端，WindScroll 是 Blog 渲染与部署端，二者保持为独立项目。

WindPost 只导出明确标记为 Blog 发布的文章及相关附件到 WindScroll 内容目录，再通过 Git push 触发静态站部署。私人 vault 不直接进入公开仓库，WindScroll 也不再依赖 Notion 作为长期内容源。

## 第一阶段范围

- 建立统一的 `PublishDocument` 和渠道接口；
- 保留并整理现有公众号 HTML 渲染能力；
- 打通 Obsidian 到 WindScroll 的静态 Blog 发布闭环；
- 抽离小红书卡片生成与浏览器自动化；
- 默认保留最终人工确认，不自动执行不可逆发布。

## 暂不处理

- 团队协作、审批流和内容日历；
- 多用户、多租户或云端 CMS；
- 数据分析、评论管理和账号运营；
- 为尚未确认的渠道提前建设通用插件系统。

## 项目状态

当前处于架构设计和工程初始化阶段。
