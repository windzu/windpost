import { App, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type WindPostPlugin from "../main";

export interface WindPostSettings {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubTokenSecret: string;

  xiaohongshuMaxImages: number;
  xiaohongshuPublishUrl: string;

  defaultMarkdownStyle: string;
  enableFootnoteLinks: boolean;
  editDebounceMs: number;
}

export const DEFAULT_SETTINGS: WindPostSettings = {
  githubOwner: "windzu",
  githubRepo: "windscroll",
  githubBranch: "main",
  githubTokenSecret: "",
  xiaohongshuMaxImages: 9,
  xiaohongshuPublishUrl: "https://creator.xiaohongshu.com/publish/publish?source=official",
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
      .setName("登录方式")
      .setDesc("使用独立 Chrome 保存公众号后台登录态；首次创建草稿时按提示扫码登录，不需要 AppID、AppSecret 或 IP 白名单。");

    new Setting(containerEl)
      .setName("登录检查")
      .setDesc("打开公众号专用 Chrome；未登录时扫码，已登录时只验证会话，不创建草稿。")
      .addButton((button) => button
        .setButtonText("登录/检查")
        .onClick(async () => {
          button.setDisabled(true).setButtonText("检查中…");
          try {
            await this.plugin.connectWechat();
            new Notice("WindPost: 公众号登录会话有效");
            button.setButtonText("登录正常");
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

    // ---------- 小红书 ----------
    containerEl.createEl("h3", { text: "小红书" });

    new Setting(containerEl)
      .setName("最多生成卡片")
      .setDesc("包含封面。超出卡片容量的文字仍会保留在正文中。")
      .addText((text) => text
        .setPlaceholder("9")
        .setValue(String(this.plugin.settings.xiaohongshuMaxImages))
        .onChange(async (value) => {
          const n = parseInt(value, 10);
          if (Number.isFinite(n) && n >= 1 && n <= 18) {
            this.plugin.settings.xiaohongshuMaxImages = n;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName("创作服务平台地址")
      .setDesc("用于打开图文发布页。WindPost 只自动填写，不会点击最终发布。")
      .addText((text) => text
        .setPlaceholder("https://creator.xiaohongshu.com/publish/publish?source=official")
        .setValue(this.plugin.settings.xiaohongshuPublishUrl)
        .onChange(async (value) => {
          this.plugin.settings.xiaohongshuPublishUrl = value.trim();
          await this.plugin.saveSettings();
        }));

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
