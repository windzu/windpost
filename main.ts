import { Notice, Plugin, requestUrl, WorkspaceLeaf } from "obsidian";
import { PreviewView, VIEW_TYPE_WINDPOST } from "./src/view";
import {
  DEFAULT_SETTINGS,
  WindPostSettings,
  WindPostSettingTab,
} from "./src/settings";
import type { BlogPost } from "./src/blog/prepare";
import {
  publishFilesToGitHub,
  verifyGitHubRepository,
  type GitHubConnectionResult,
  type GitHubPublishResult,
} from "./src/blog/github";
import {
  getWindPostWorkspaceStatus,
  initializeWindPostWorkspace,
  type WindPostWorkspaceStatus,
} from "./src/workspace/initialize";
import { WechatApiClient } from "./src/wechat/api";
import { publishWechatDraft } from "./src/wechat/publish";
import { createHerTemplateSample } from "./src/wechat/sample";
import type {
  WechatConnectionResult,
  WechatDraftResult,
  WechatPost,
} from "./src/wechat/types";

export default class WindPostPlugin extends Plugin {
  settings!: WindPostSettings;
  private wechatPreviewListeners = new Set<(templateId: string) => void>();
  private pendingWechatPreviewTemplateId = "";

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_WINDPOST, (leaf) => new PreviewView(leaf, this));

    this.addSettingTab(new WindPostSettingTab(this.app, this));

    this.addRibbonIcon("send", "WindPost: 打开发布中心", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-windpost-preview",
      name: "打开 WindPost 发布中心",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "create-her-template-sample",
      name: "创建并预览 Her 示例文章",
      callback: () => void this.openHerTemplateSample(),
    });

    this.addCommand({
      id: "initialize-windpost-workspace",
      name: "初始化 WindPost 工作区",
      callback: () => void this.initializeWorkspace(),
    });
  }

  async onunload() {
    this.wechatPreviewListeners.clear();
    this.pendingWechatPreviewTemplateId = "";
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null =
      workspace.getLeavesOfType(VIEW_TYPE_WINDPOST)[0] ?? null;

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_WINDPOST, active: true });
      }
    }

    if (leaf) workspace.revealLeaf(leaf);
  }

  onWechatPreviewRequest(listener: (templateId: string) => void): () => void {
    this.wechatPreviewListeners.add(listener);
    if (this.pendingWechatPreviewTemplateId) {
      const templateId = this.pendingWechatPreviewTemplateId;
      this.pendingWechatPreviewTemplateId = "";
      listener(templateId);
    }
    return () => this.wechatPreviewListeners.delete(listener);
  }

  getWorkspaceStatus(): Promise<WindPostWorkspaceStatus> {
    return getWindPostWorkspaceStatus(this.app);
  }

  async initializeWorkspace(): Promise<boolean> {
    try {
      const result = await initializeWindPostWorkspace(this.app);
      await this.app.workspace.getLeaf("tab").openFile(result.baseFile);
      const detail = result.createdFiles > 0
        ? `创建 ${result.createdFiles} 个文件`
        : "现有文件均已保留";
      const assets = result.restoredAssets > 0
        ? `，补齐 ${result.restoredAssets} 张示例配图`
        : "";
      new Notice(`WindPost: 工作区已就绪，${detail}${assets}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`WindPost: 初始化失败：${message}`, 8000);
      return false;
    }
  }

  async openHerTemplateSample(): Promise<void> {
    try {
      const result = await createHerTemplateSample(this.app);
      this.settings.wechatTemplateId = "builtin:her";
      await this.saveSettings();
      await this.app.workspace.getLeaf("tab").openFile(result.file);
      await this.activateView();
      this.requestWechatPreview("builtin:her");

      const action = result.created ? "已创建" : "已存在，已打开";
      const restored = result.restoredAssets > 0
        ? `，补齐 ${result.restoredAssets} 张配图`
        : "";
      new Notice(`WindPost: Her 示例文章${action}${restored}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`WindPost: 创建 Her 示例文章失败：${message}`, 8000);
    }
  }

  async publishBlog(post: BlogPost): Promise<GitHubPublishResult> {
    const token = this.app.secretStorage.getSecret(this.settings.githubTokenSecret);
    if (!token) throw new Error("请先在 WindPost 设置中配置 GitHub Token。");
    return publishFilesToGitHub({
      owner: this.settings.githubOwner,
      repo: this.settings.githubRepo,
      branch: this.settings.githubBranch,
      token,
      files: post.files,
      message: `publish: ${post.title}`,
    });
  }

  async testBlogConnection(): Promise<GitHubConnectionResult> {
    const token = this.app.secretStorage.getSecret(this.settings.githubTokenSecret);
    if (!token) throw new Error("未找到 GitHub Token，请检查 SecretStorage 配置。");
    return verifyGitHubRepository({
      owner: this.settings.githubOwner,
      repo: this.settings.githubRepo,
      token,
    });
  }

  async publishWechatDraft(post: WechatPost): Promise<WechatDraftResult> {
    return publishWechatDraft({
      app: this.app,
      client: this.getWechatClient(),
      post,
    });
  }

  async testWechatConnection(): Promise<WechatConnectionResult> {
    return { draftCount: await this.getWechatClient().getDraftCount() };
  }

  private getWechatClient(): WechatApiClient {
    if (!this.settings.wechatAppId.trim()) {
      throw new Error("请先在 WindPost 设置中填写微信公众号 AppID。");
    }
    const appSecret = this.app.secretStorage.getSecret(this.settings.wechatAppSecretName);
    if (!appSecret) {
      throw new Error("未找到微信公众号 AppSecret，请检查 SecretStorage 配置。");
    }
    return new WechatApiClient(this.settings.wechatAppId, appSecret, requestUrl);
  }

  private requestWechatPreview(templateId: string): void {
    if (this.wechatPreviewListeners.size === 0) {
      this.pendingWechatPreviewTemplateId = templateId;
      return;
    }
    for (const listener of this.wechatPreviewListeners) listener(templateId);
  }
}
