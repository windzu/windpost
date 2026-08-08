import { App, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type WindPostPlugin from "../main";

export interface WindPostSettings {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubTokenSecret: string;

  wechatAppId: string;
  wechatAppSecretName: string;
  wechatTemplateId: string;
  wechatAccountName: string;
  wechatDefaultAuthor: string;

  defaultMarkdownStyle: string;
  enableFootnoteLinks: boolean;
  editDebounceMs: number;
}

export const DEFAULT_SETTINGS: WindPostSettings = {
  githubOwner: "windzu",
  githubRepo: "windscroll",
  githubBranch: "main",
  githubTokenSecret: "",
  wechatAppId: "",
  wechatAppSecretName: "",
  wechatTemplateId: "builtin:anthropic",
  wechatAccountName: "",
  wechatDefaultAuthor: "",
  defaultMarkdownStyle: "anthropic",
  enableFootnoteLinks: true,
  editDebounceMs: 400,
};

export class WindPostSettingTab extends PluginSettingTab {
  private plugin: WindPostPlugin;

  constructor(app: App, plugin: WindPostPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "WindPost 工作区" });

    new Setting(containerEl)
      .setName("首次使用初始化")
      .setDesc("创建根目录 WindPost.base、WindPost 内容目录和两篇渠道示例。只补齐缺失文件，不覆盖已有内容。")
      .addButton((button) => button
        .setButtonText("初始化/补齐")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true).setButtonText("初始化中…");
          await this.plugin.initializeWorkspace();
          button.setDisabled(false).setButtonText("初始化/补齐");
        }));

    containerEl.createEl("h3", { text: "Blog" });

    new Setting(containerEl)
      .setName("GitHub owner")
      .addText((text) =>
        text
          .setPlaceholder("windzu")
          .setValue(this.plugin.settings.githubOwner)
          .onChange(async (value) => {
            this.plugin.settings.githubOwner = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("GitHub repository")
      .addText((text) => text
        .setPlaceholder("windscroll")
        .setValue(this.plugin.settings.githubRepo)
        .onChange(async (value) => {
          this.plugin.settings.githubRepo = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("发布分支")
      .addText((text) => text
        .setPlaceholder("main")
        .setValue(this.plugin.settings.githubBranch)
        .onChange(async (value) => {
          this.plugin.settings.githubBranch = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("GitHub Token")
      .setDesc("选择一个仅对 WindScroll 仓库具有 Contents: write 权限的 secret。")
      .addComponent((el) => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.githubTokenSecret)
        .onChange(async (value) => {
          this.plugin.settings.githubTokenSecret = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("连接检查")
      .setDesc("只读取仓库信息并检查 push 权限，不创建 commit。")
      .addButton((button) => button
        .setButtonText("测试 GitHub 连接")
        .onClick(async () => {
          button.setDisabled(true).setButtonText("检查中…");
          try {
            const result = await this.plugin.testBlogConnection();
            if (!result.canPush) throw new Error("Token 没有 Contents 写权限。");
            new Notice(`WindPost: GitHub 连接正常，默认分支 ${result.defaultBranch}`);
            button.setButtonText("连接正常");
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`WindPost: ${message}`, 8000);
            button.setButtonText("检查失败");
          } finally {
            button.setDisabled(false);
          }
        }));

    // ---------- 微信公众号 ----------
    containerEl.createEl("h3", { text: "微信公众号" });

    new Setting(containerEl)
      .setName("AppID")
      .setDesc("微信开发者平台 → 我的业务 → 公众号 → 基础信息。")
      .addText((text) => text
        .setPlaceholder("微信公众号 AppID")
        .setValue(this.plugin.settings.wechatAppId)
        .onChange(async (value) => {
          this.plugin.settings.wechatAppId = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("AppSecret")
      .setDesc("保存在 Obsidian SecretStorage 中，不写入 WindPost 普通配置。")
      .addComponent((el) => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.wechatAppSecretName)
        .onChange(async (value) => {
          this.plugin.settings.wechatAppSecretName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("接口 IP 白名单")
      .setDesc("在微信开发者平台 → 我的业务 → 公众号 → 基础信息 → 开发密钥中，添加运行 Obsidian 这台设备当前网络的出口公网 IP。不需要公网服务器或入站端口。");

    new Setting(containerEl)
      .setName("连接检查")
      .setDesc("调用官方草稿数量接口，只读验证 AppID、AppSecret、IP 白名单和草稿权限，不创建草稿。")
      .addButton((button) => button
        .setButtonText("测试官方 API")
        .onClick(async () => {
          button.setDisabled(true).setButtonText("检查中…");
          try {
            const result = await this.plugin.testWechatConnection();
            new Notice(`WindPost: 公众号连接正常，当前共有 ${result.draftCount} 篇草稿`);
            button.setButtonText("连接正常");
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`WindPost: ${message}`, 10000);
            button.setButtonText("检查失败");
          } finally {
            button.setDisabled(false);
          }
        }));

    new Setting(containerEl)
      .setName("草稿字段")
      .setDesc("封面使用 wechat_cover（缺省时取正文首图）；可选字段：wechat_author、wechat_digest、wechat_source_url、wechat_open_comment、wechat_fans_only_comment。");

    new Setting(containerEl)
      .setName("公众号名称")
      .setDesc("用于需要刊头的公众号模板，不写入文章 Properties。")
      .addText((text) => text
        .setPlaceholder("公众号名称")
        .setValue(this.plugin.settings.wechatAccountName)
        .onChange(async (value) => {
          this.plugin.settings.wechatAccountName = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("默认作者")
      .setDesc("用于公众号草稿作者和刊头；文章显式设置 wechat_author 时优先使用文章值。")
      .addText((text) => text
        .setPlaceholder("作者名称")
        .setValue(this.plugin.settings.wechatDefaultAuthor)
        .onChange(async (value) => {
          this.plugin.settings.wechatDefaultAuthor = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("公众号模板")
      .setDesc("开箱内置 Anthropic 与 Her，初始化工作区后可直接通过示例文章体验，无需自行设计模板。");

    // ---------- 默认行为 ----------
    containerEl.createEl("h3", { text: "默认行为" });

    new Setting(containerEl)
      .setName("外链转脚注")
      .setDesc("把正文里的 http(s) 链接转成上标编号 + 末尾参考列表。HTML 平台始终生效，公众号平台另有专用处理。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFootnoteLinks)
          .onChange(async (value) => {
            this.plugin.settings.enableFootnoteLinks = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("编辑防抖时长")
      .setDesc("编辑器内打字后多久重新渲染（毫秒）。太小会卡，太大反馈慢。建议 200-800。重开面板生效。")
      .addText((text) =>
        text
          .setPlaceholder("400")
          .setValue(String(this.plugin.settings.editDebounceMs))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (Number.isFinite(n) && n >= 50 && n <= 5000) {
              this.plugin.settings.editDebounceMs = n;
              await this.plugin.saveSettings();
            }
          }),
      );
  }
}
