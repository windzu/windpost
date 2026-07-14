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

典型流程围绕当前笔记展开：

1. 在 Obsidian 中完成文章，打开 WindPost；
2. 选择 Blog、公众号或小红书，按需同时处理多个渠道；
3. 查看该渠道的最终效果和必要提示；
4. 确认后生成或提交到对应渠道；
5. WindPost 展示每个渠道的结果，失败渠道可以单独重试。

不同渠道可以有不同的确认方式：Blog 可以展示将要同步的文章与附件，公众号
可以预览最终富文本，小红书可以预览标题、正文和卡片。默认停在不可逆操作之前，
由作者完成最终确认。

小红书优先读取笔记中「### 小红书」下的「标题」、「封面文案」、「正文」和
「标签」；正文留空或指向「发布版本」时，会自动使用「## 发布版本」，其次是
「## 正文草稿」。WindPost 生成 3:4 图文卡片后打开创作服务平台，上传图片并填写
标题、正文和标签，但不会点击最终发布。

WindPost 不要求作者为了统一模型而维护固定 frontmatter。需要什么信息，就从
当前笔记、Obsidian metadata、插件配置或发布时输入中获取；具体字段随真实需求演进。

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
- GitHub Token 和公众号 AppSecret 使用 Obsidian SecretStorage 保存；
- WindScroll 已支持 Notion 与 WindPost 文章并存，同 slug 时使用 WindPost 版本；
- 小红书已支持平台版本解析、发布前检查、3:4 图文卡片预览与生成；
- 小红书已接入持久化登录浏览器，可以自动上传卡片并填写标题、正文和标签；
- 小红书最终发布保留人工确认，不由 WindPost 自动点击；
- 公众号草稿 API 尚未接入。

下一步是在真实小红书页面变化中持续收敛选择器和错误提示，再完成公众号草稿发布。
