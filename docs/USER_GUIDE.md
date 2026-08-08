# WindPost 使用说明

WindPost 是运行在 Obsidian 桌面端中的个人内容发布插件。目前支持将当前 Markdown
笔记发布到 Blog，或通过微信官方 API 创建公众号草稿。

当前支持范围：

- macOS；
- Obsidian Desktop 1.12.0 及以上版本；
- Blog 与微信公众号两个渠道；
- 公众号只创建草稿，不自动群发。

## 1. 安装

WindPost 尚未进入 Obsidian 社区插件市场，也没有正式 Release。当前需要从源码构建：

1. 获取本仓库最新的 `main` 分支；
2. 执行 `pnpm install` 和 `pnpm build`；
3. 在 Vault 的 `.obsidian/plugins/windpost/` 中放入 `main.js`、`manifest.json` 和
   `styles.css`；
4. 重新加载 Obsidian，在「设置 → 第三方插件」中启用 WindPost。

升级源码版本后，重新构建并替换以上三个文件，再重新加载插件。

## 2. 初始化内容库

第一次启用后，可以通过以下任一入口初始化：

- WindPost 发布中心中的「一键初始化」；
- 「设置 → WindPost → 首次使用初始化」；
- 命令面板中的「WindPost: 初始化 WindPost 工作区」。

初始化会创建：

- 根目录的 `WindPost.base`；
- `WindPost/` 内容目录；
- 「通用长内容」与「Her 公众号」两篇示例；
- Her 示例使用的四张本地配图。

初始化只补齐缺失文件，不会覆盖已有文章或配图。示例文章与实际内容位于同一目录，
可以直接改写、重命名或删除。

## 3. 首次配置微信公众号

### 3.1 账号条件

配置前需要确认：

- 登录微信开发者平台的微信号是目标公众号的管理员或开发者；仅有「运营者」身份
  无法查看开发信息；
- 公众号已经启用 AppSecret；个人主体需要完成管理员实名，非个人主体可能需要按
  平台提示完成主体认证；
- 账号可以调用草稿、素材管理相关接口。WindPost 的「测试官方 API」会直接验证
  当前账号是否具备所需的草稿读取权限。

WindPost 不需要配置服务器地址、消息推送、JS 接口安全域名，也不需要公网服务器、
入站端口或域名。

### 3.2 获取 AppID、AppSecret 和白名单

1. 打开[微信开发者平台](https://developers.weixin.qq.com/platform/)，扫码登录；
2. 进入「我的业务 → 公众号/服务号」，选择需要发布的账号；
3. 在「基础信息」中复制开发者 ID（AppID）；
4. 进入「基础信息 → 开发密钥」，启用或重置 AppSecret，并立即妥善保存；微信平台
   不会再次显示已经生成的 AppSecret；
5. 仍在「开发密钥」页面，将当前网络的出口公网 IP 添加到「API IP 白名单」。

白名单中的 IP 是 Obsidian 请求 `api.weixin.qq.com` 时被微信看到的来源 IP：

- 直连网络通常是家庭宽带或公司网络的公网出口；
- 使用代理时通常是代理节点的出口 IP；
- `192.168.x.x`、`10.x.x.x` 等局域网地址无效；
- 更换网络、代理节点或运营商重新分配公网 IP 后，可能需要更新白名单。

如果不确定实际出口 IP，可以先完成 WindPost 配置并点击「测试官方 API」。微信返回
错误码 `40164` 时，WindPost 会保留微信响应中的 IP 信息；将该 IP 加入白名单后重试。

### 3.3 填写 WindPost 设置

进入「Obsidian 设置 → WindPost → 微信公众号」：

| 设置项 | 是否必填 | 说明 |
| --- | --- | --- |
| AppID | 是 | 填写公众号的开发者 ID，不要填写小程序或其他业务的 AppID |
| AppSecret | 是 | 新建或选择一个 Obsidian SecretStorage secret，并将 AppSecret 保存为其值 |
| 公众号名称 | 否 | 用于 Her 等带刊头的模板，不需要在每篇文章中重复填写 |
| 默认作者 | 否 | 用于草稿作者与刊头；文章中的 `wechat_author` 优先 |

AppSecret 不会写入 WindPost 的普通 `data.json`。不要把 AppSecret 放入 Markdown、
截图、Issue、日志或 Git 仓库。如果在微信平台重置 AppSecret，需要同步更新
SecretStorage 中的值。

填写完成后点击「测试官方 API」。该操作只读取当前草稿数量，不会上传图片、创建
草稿或修改公众号内容。看到「连接正常」后再进行第一次发布。

如果开发者平台的权限页面没有单独显示「新增草稿」，不要只根据这一项判断账号
不可用；先以「测试官方 API」的实际结果为准。测试通过但首次发布仍返回权限错误时，
再根据微信错误码检查素材和新增草稿权限。

## 4. 准备公众号文章

最简文章只需要一级标题、正文和一张可用图片：

```markdown
---
stage: ready
channels:
  - wechat
published_to: []
---

# 文章标题

![封面](Attachments/cover.jpg)

正文从这里开始。
```

### 4.1 标题与封面

标题按以下顺序推导：

1. `title` Property；
2. 正文第一个一级标题；
3. 文件名。

微信草稿必须有封面，但文章不必强制维护 `wechat_cover` Property。WindPost 按以下
顺序选择封面：

1. `wechat_cover`；
2. 正文第一张图片。

`wechat_cover` 支持 Obsidian 图片 wikilink、本地 Vault 路径和公开的 HTTP(S) 图片
地址。例如：

```yaml
wechat_cover: "[[Attachments/cover.jpg]]"
```

封面只会上传为微信永久素材并绑定到草稿的封面字段，不会被额外插入正文。正文中
原本存在的同一张图片仍按正文内容正常保留。

### 4.2 可选 Properties

| Property | 用途 | 缺省行为 |
| --- | --- | --- |
| `wechat_cover` | 草稿封面 | 使用正文第一张图片 |
| `wechat_author` | 作者 | 使用通用 `author`，再回退到 WindPost 默认作者 |
| `wechat_digest` | 摘要 | 使用 `summary` 或 `description`；均为空时由微信从正文提取 |
| `wechat_source_url` | 「阅读原文」地址 | 不显示「阅读原文」链接 |
| `wechat_open_comment` | 是否开启留言，填写 `true` 或 `false` | `false` |
| `wechat_fans_only_comment` | 是否仅允许粉丝留言 | `false` |

通常不需要给每篇文章增加公众号名称、默认作者、日期、模板等字段；这些内容可以从
设置、文件信息或当前选择自动推导。

### 4.3 当前限制

- 标题不超过 32 个字；
- 作者不超过 16 个字；
- 摘要不超过 120 个字；
- 正文可见字符少于 20,000，最终 HTML 小于 1 MB；
- `wechat_source_url` 必须是 HTTP(S) 地址且不超过 1 KB；
- 文章必须能解析出封面；
- 本地图片和外部图片会在发布时转存到微信。WindPost 会将图片转换为微信接受的
  JPEG/PNG，并压缩到 1 MB 以下。

## 5. 预览并创建草稿

1. 在 Obsidian 中打开需要发布的 Markdown 笔记；
2. 点击左侧 Ribbon 的发送图标，或在命令面板执行「WindPost: 打开 WindPost 发布中心」；
3. 选择「公众号」渠道；
4. 在 `Anthropic` 与 `Her` 模板之间选择，并检查标题、封面状态、正文图片和预览；
5. 点击「发布至公众号草稿」，阅读确认信息后选择「创建草稿」；
6. 等待「公众号草稿已创建」提示；
7. 打开微信公众号后台，在草稿箱检查封面裁切、摘要、留言设置与最终排版；
8. 最终群发仍由用户在公众号后台人工执行。

发布时 WindPost 会依次获取 access token、上传正文图片、上传封面永久素材并调用
「新增草稿」接口。任何一步失败都会停止，不会自动群发。

## 6. 配置并发布 Blog

Blog 发布需要一个与 WindScroll 内容结构兼容的 GitHub 仓库。进入「Obsidian 设置 →
WindPost → Blog」，填写：

- GitHub owner；
- GitHub repository；
- 目标分支；
- 仅对目标仓库具有 `Contents: write` 权限的 GitHub Token，并通过 Obsidian
  SecretStorage 保存。

点击「测试 GitHub 连接」只会读取仓库信息和检查 push 权限，不会创建 commit。

打开文章后，在发布中心选择 `Blog` 并确认预览。发布时 WindPost 会把文章写入
`src/content/posts/<slug>.md`，把引用的本地图片复制到
`public/windpost-assets/<slug>/`，然后在目标分支创建一个非强制更新的 commit。
如果仓库已经配置 Vercel，可以由该 commit 继续触发站点部署。

Blog 可以选用 `slug`、`date`、`summary`、`tags`、`category`、`icon` 和 `coverUrl`
等 Properties；标题、slug 和日期未填写时会从一级标题、文件名或发布时间推导。

## 7. 排版模板

WindPost 内置：

- `Anthropic`：适合普通长文；
- `Her`：带刊头、前言、章节、阅读列表和结尾卡片的完整编辑模板。

首次体验可以直接打开初始化生成的示例。需要自定义模板时，让 Agent 按
[公众号模板规范](WECHAT_TEMPLATE_SPEC.md) 创建文件，并保存到 Vault 的
`WindPost/Templates/WeChat/<template-id>/`。

## 8. 常见问题

| 提示或现象 | 原因与处理 |
| --- | --- |
| `40164` 或「出口 IP 不在白名单」 | 将错误信息中微信看到的 IP 加入 API IP 白名单；代理或网络变化后重新确认 |
| `40001`、`40125` 或「AppSecret 无效」 | 检查 AppID 与 AppSecret 是否属于同一个公众号；重置过 AppSecret 时更新 SecretStorage |
| `48001` 或「没有草稿接口权限」 | 在「接口管理 → 接口权限与额度」检查账号权限；账号类型或认证状态不满足时需按微信平台要求处理 |
| `89503` 或「需要管理员确认」 | 由公众号管理员按微信提示确认本次 API 调用，然后重试 |
| 「未找到 AppSecret」 | WindPost 中保存的是 SecretStorage 条目引用；确认所选 secret 仍存在且值不为空 |
| 「公众号草稿需要封面」 | 设置 `wechat_cover`，或在正文中加入至少一张可读取的图片 |
| 「找不到公众号正文图片」 | 检查 wikilink 或 Markdown 图片路径是否能从当前笔记正确解析 |
| 图片下载或解码失败 | 检查外部图片是否可公开访问，或改用 Vault 内的 JPG/PNG 图片 |
| 换网络后突然连接失败 | 家庭宽带、公司网络或代理出口已变化，重新测试并更新 API IP 白名单 |

## 9. 安全与边界

- AppSecret 保存在 Obsidian SecretStorage；
- WindPost 从本机直接请求微信官方 API，不经过 WindPost 自建服务器；
- 不需要安装浏览器扩展，也不使用 Playwright 控制公众号后台；
- 封面会作为永久素材写入公众号素材库；
- WindPost 只创建草稿，不执行最终群发。

## 10. 微信官方资料

- [「开发接口管理」模块升级与入口迁移](https://developers.weixin.qq.com/doc/subscription/guide/dev/migration.html)
- [获取稳定版接口调用凭据](https://developers.weixin.qq.com/doc/subscription/api/base/api_getstableaccesstoken.html)
- [上传发表内容中的图片](https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_uploadimage.html)
- [上传永久素材](https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_addmaterial.html)
- [获取草稿总数](https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_count.html)
- [新增草稿](https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html)
