# WindPost

> 基于 Obsidian 的个人多渠道内容发布工作台。

WindPost 以本地 Obsidian vault 为唯一内容源，将同一篇 Markdown 笔记转换并发布到 Blog、微信公众号和小红书。项目目标不是建设一个通用社交媒体管理平台，而是为个人长期内容创作提供一条可控、可维护、可迁移的发布链路。

## 背景

过去的内容生产链路以 Notion 为知识库，并依赖多个浏览器插件分别发布公众号、小红书和 Blog。随着知识库迁移到 Obsidian，原有工具出现了几个问题：

- 内容源和发布工具分散，渠道之间缺少统一状态；
- 同一篇文章需要被不同插件重复解析和处理；
- 浏览器自动化与内容转换耦合，页面变化后难以维护；
- Blog 仍依赖 Notion，尚未真正以 Obsidian 为发布源。

现有项目中，`wepost` 已实现部分 Obsidian Markdown 渲染、平台预览和小红书自动填写能力；`windscroll` 已实现 Astro 静态 Blog。WindPost 将在这些验证结果上重新划分边界，建立统一的发布工作流。

## 产品定位

WindPost 是 Obsidian 中唯一面向作者的多渠道发布入口。作者继续在
Obsidian 中写作，完成后从当前笔记打开 WindPost，分别处理 Blog、
微信公众号和小红书。

WindPost 不是独立 CMS，也不接管写作和知识管理。它只负责把一篇已经写好的
Obsidian 笔记变成各渠道可发布的内容，并完成发布前确认、外部交互和结果反馈。

WePost 不再作为 Obsidian 插件继续使用。它只作为现有 Markdown 渲染、平台预览
和小红书自动填写能力的迁移来源，WindPost 不依赖 WePost 运行。

## 使用方式

首次打开发布中心时，点击「一键初始化」。WindPost 会创建：

- 根目录 `WindPost.base` 内容入口；
- `Content/` 内容目录；
- 通用长内容、Her 完整文章、小红书短内容三篇示例；
- Her 示例所需的四张配图。

初始化只补齐缺失文件，不覆盖用户已有内容，也可以从命令面板或设置页重复执行。
之后的典型流程围绕当前笔记展开：

1. 从 `WindPost.base` 选择示例并改写，或在 `Content/` 中新建文章；
2. 打开 WindPost，选择 Blog、公众号或小红书；
3. 查看该渠道的最终效果和必要提示；
4. 确认后生成或提交到对应渠道；
5. WindPost 展示每个渠道的结果，失败渠道可以单独重试。

不同渠道可以有不同的确认方式：Blog 可以展示将要同步的文章与附件，公众号
可以预览最终富文本，小红书可以预览标题、正文和卡片。默认停在不可逆操作之前，
由作者完成最终确认。

小红书与 Blog、公众号共用文件名、一级标题和 Markdown 正文，只额外读取可选的
`cover_text` 与 `tags`。未设置 `cover_text` 时使用标题渲染封面。WindPost
生成 3:4 图文卡片后打开创作服务平台，上传图片并填写标题、正文和标签，但不会
点击最终发布，也不要求笔记维护平台专属章节。

图文卡片采用 Anthropic 式的暖白、墨色与赭色配色，封面使用无衬线字体，正文统一
使用衬线字体。卡片按段落与实际排版高度分页，并避免拆分英文单词和产生行首标点；
预览与最终 PNG 共用分页后的行数据，不根据段落长度自动改变正文样式。封面文案会
自动缩小字号以完整显示，无法容纳时明确报错，不会静默截断。

`WindPost.base` 的基础契约只有三个字段：`stage` 表示创作阶段，`channels` 表示计划
发布渠道，`published_to` 记录已经完成的渠道。标题从文件名或一级标题推导，日期使用
文件时间或发布时生成；账号名称、作者等账户信息放在插件设置中。其他 Properties
只有在真实发布需求出现时才添加。

## 项目边界

### WindPost 负责

- 读取当前 Obsidian 笔记、metadata、wikilink 和本地附件；
- 为 Blog、公众号和小红书生成各自需要的内容；
- 提供渠道预览、发布前检查、人工确认和结果反馈；
- 执行 Git、平台 API 或浏览器自动化等发布动作；
- 保存插件配置、登录会话、临时产物和必要的发布记录。

### WindScroll 负责

- Blog 的页面结构、视觉样式、站点配置和 Astro 构建；
- 接收 WindPost 导出的公开文章与附件；
- 通过 Git 和 Vercel 完成 Blog 部署。

WindScroll 可以根据发布链路需要直接调整，不把当前 Notion adapter 或既有内容模型
当成固定边界。私人 vault 不进入 WindScroll 仓库。

### 外部平台负责

- 微信公众号、小红书的账号、草稿与最终线上内容；
- 平台自身无法稳定自动化的确认步骤。

平台页面变化造成的适配问题应隔离在对应发布实现中，不影响 Obsidian 内容读取和
其他渠道。

## 初步实现分层

```text
Current Obsidian Note
    -> Note Reader
    -> Channel Preparation
        -> Blog Content     -> WindScroll / Git / Vercel
        -> WeChat Content   -> HTML / Draft API
        -> XHS Content      -> Cards / Browser Driver
```

实现可以按实际开发逐步拆分，暂不要求固定的数据模型或目录层级。需要长期保持的
只有三类职责：

- 笔记读取：理解当前笔记及其本地资源；
- 渠道准备：生成各渠道最终需要的内容和预览；
- 渠道交付：封装 Git、API 和浏览器等外部交互。

## 与 WindScroll 的关系

WindPost 是发布端，WindScroll 是 Blog 渲染与部署端，二者保持为独立项目。

WindPost 只把用户确认发布的文章及相关附件通过 GitHub API提交到 WindScroll，
由 GitHub commit 触发 Vercel 静态站部署。使用 WindPost 不要求本地安装或 clone
WindScroll，私人 vault 也不会进入公开仓库。

## 第一阶段范围

- 用 WindPost 替换 Obsidian 中的 WePost 插件入口；
- 打通 Obsidian 到 WindScroll 的静态 Blog 发布闭环；
- 迁移并整理现有公众号 HTML 渲染能力；
- 迁移小红书卡片生成与浏览器自动填写能力；
- 默认保留最终人工确认，不自动执行不可逆发布。

## 暂不处理

- 团队协作、审批流和内容日历；
- 多用户、多租户或云端 CMS；
- 批量管理整个 vault 的内容后台；
- 数据分析、评论管理和账号运营；
- 知乎、掘金等尚未进入真实发布流程的渠道；
- 为未来渠道提前建设通用插件系统。

## 项目状态

已完成第一轮工程初始化：

- WindPost 已作为独立 Obsidian 插件构建并接入当前 vault；
- WePost 的 Markdown 渲染能力已迁入，知乎与掘金入口已移除；
- 发布中心已拆分为 Blog、公众号和小红书三个独立渠道；
- Blog 预览不会修改 WindScroll 或其他外部状态；
- 用户确认后，Blog 文章与附件通过 GitHub Git Database API组成一个 commit；
- GitHub Token 使用 Obsidian SecretStorage 保存；
- WindScroll 已支持 Notion 与 WindPost 文章并存，同 slug 时使用 WindPost 版本；
- 小红书已支持从公共标题、正文、`cover_text` 和 `tags` 生成 3:4 图文卡片并执行发布前检查；
- 小红书已接入持久化登录浏览器，可以自动上传卡片并填写标题、正文和标签；
- 小红书最终发布保留人工确认，不由 WindPost 自动点击；
- 公众号已接入持久化登录浏览器：自动上传正文图片和封面并创建草稿；
- 公众号最终群发保留人工确认，不由 WindPost 自动执行。

公众号可在 Properties 中使用以下可选字段：

- `wechat_cover`：本地图片 wikilink、vault 路径或公开图片 URL；未设置时使用正文首图；
- `wechat_author`、`wechat_digest`、`wechat_source_url`：作者、摘要和「阅读原文」地址；
- `wechat_open_comment`、`wechat_fans_only_comment`：评论开关。

首次创建公众号草稿时，WindPost 会打开独立 Chrome，扫码登录后把登录态保存在插件
目录的 `.windpost-browser/wechat` 中。后续发布复用该会话，不需要 AppID、AppSecret
或公网 IP 白名单。WindPost 使用公众号后台的浏览器接口，因此微信后台页面或接口
变化后可能需要更新适配。

公众号排版开箱内置 `Anthropic` 和 `Her` 两个模板，可在公众号预览区直接切换；
初始化提供对应的完整示例，普通用户无需自行设计。高级用户仍可让 Agent 按
[公众号模板规范](docs/WECHAT_TEMPLATE_SPEC.md) 创建模板，并放到 Vault 的
`WindPost/Templates/WeChat/<template-id>/`。模板创建 Skill 位于
[`skills/create-windpost-wechat-template`](skills/create-windpost-wechat-template/)。

需要刊头的 `editorial` 模板从 WindPost 设置读取公众号名称和默认作者，不要求每篇
文章重复填写。前言、说明、阅读要点、Podcast 与结尾卡片可使用模板规范中的
WindPost 语义块；这些标记由 Agent 生成，不增加必填 Properties，并可在普通模板中
降级为可读内容。

Her 示例为完整文章「我花了两年，才走出那段狼狈的日子」及四张配图，用于
展示刊头、PREFACE、六个章节、说明卡片、引语、阅读列表、Podcast、图片裁切和结尾
卡片。工作区初始化会自动创建该示例，也可从命令面板单独执行「创建并预览 Her
模板示例」；重复执行不会覆盖已有笔记或配图。内置图片已压缩并移除 EXIF/GPS 元数据。

下一步是在真实平台页面和账号权限差异中持续收敛错误提示与发布体验。
